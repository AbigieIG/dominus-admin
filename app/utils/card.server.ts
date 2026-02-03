import mongoose from 'mongoose';
import { getCardModel, CardType, CardStatus, TransactionType } from '~/models/card.server';
import { getUserModel, type IUser } from '~/models/user.server';
import { transactionService  } from './transactions.server';
import { notificationService } from './notification.server';
import { NotificationActionType, NotificationType } from '~/models/notifications.server';
import { generateBankReference } from './banknumber';
import settings from '~/assets/settings.json';


export interface CardRequestOptions {
  userId: string;
  cardType: CardType;
  requestedLimit?: number;
  expedited?: boolean;
}

export interface TransactionOptions {
  amount: number;
  type: TransactionType;
  merchant?: string;
  location?: string;
  currency?: string;
  description?: string;
  date?: Date | string; // Add date support
  status?: 'pending' | 'completed' | 'failed';
}

// Interface for editing transactions
export interface EditTransactionOptions {
  amount?: number;
  type?: TransactionType;
  merchant?: string;
  location?: string;
  currency?: string;
  date?: Date | string;
  status?: 'pending' | 'completed' | 'failed';
}

export interface CardUpdateOptions {
  status?: CardStatus;
  dailyLimit?: number;
  monthlyLimit?: number;
  pin?: string;
}

enum ITransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  BILL_PAYMENT = 'bill_payment',
  INTEREST = 'interest',
  PAYPAL = 'paypal',
  WIRE_TRANSFER = 'wire_transfer',
  FEE = 'fee',
}

export class CardService {
  private static instance: CardService;
  
  // Card fees configuration
  private static readonly CARD_FEES = {
    [CardType.DEBIT]: 25.00,
    [CardType.CREDIT]: 50.00,
  };

  private static readonly EXPEDITED_FEE = 35.00;

  public static getInstance(): CardService {
    if (!CardService.instance) {
      CardService.instance = new CardService();
    }
    return CardService.instance;
  }

  /**
   * Request a new card for a user
   */
async requestCard(options: CardRequestOptions) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { userId, cardType, requestedLimit = 1000, expedited = false } = options;

      // Get models
      const Card = await getCardModel();
      const User = await getUserModel();

      // Find user with account details
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Calculate total fees
      const cardFee = CardService.CARD_FEES[cardType];
      const expeditedFee = expedited ? CardService.EXPEDITED_FEE : 0;
      const totalFee = cardFee + expeditedFee;

      // Check if user has sufficient balance
      if (user.account.balance < totalFee) {
        throw new Error(`Insufficient balance. Required: $${totalFee}, Available: $${user.account.balance}`);
      }

      // Check if user already has a card of this type that's active
      const existingCard = await Card.findOne({
        user: userId,
        type: cardType,
        status: { $in: [CardStatus.ACTIVE, CardStatus.INACTIVE] }
      }).session(session);

      if (existingCard) {
        throw new Error(`You already have an ${cardType} card. Please manage your existing card instead.`);
      }

      // Debit the card fee from user's account
      user.account.balance -= totalFee;
      await user.save({ session });

      // Create new card with proper ObjectId
      const newCard = new Card({
        user: new mongoose.Types.ObjectId(userId),
        account: user._id || new mongoose.Types.ObjectId(user._id), 
        type: cardType,
        dailyLimit: Math.min(requestedLimit * 0.1, 500), // 10% of limit or $500 max
        monthlyLimit: requestedLimit,
        status: CardStatus.ACTIVE,
      });

      // Save the card first to trigger the pre-save hook
      await newCard.save({ session });

      // Add the fee transaction to card (after card is saved and has all required fields)
      await newCard.addTransaction({
        amount: totalFee,
        type: TransactionType.FEE,
        merchant: 'BANK',
        location: 'CARD REQUEST',
        status: 'completed',
        currency: user.account.currency,
      });

      await transactionService.CardTransaction({
        amount: totalFee,
        currency: user.account.currency,
        fromAccount: user._id.toString(),
        description:'Card Request',
        initiatedBy: user._id.toString(),
      });

      await notificationService.createNotification({
        type: NotificationType.MESSAGE,
        userId: user._id.toString(),
        title: `Card request for ${cardType} card has been approved.`,
        content: `Your ${cardType} card request has been approved. You can now use your card to make transactions.`,
        action: {
          name: 'View Card',
          type: NotificationActionType.REDIRECT,
          url: `/admin/cards/${user._id.toString()}?card=${newCard._id}`,
        },
        sender: settings.site.name,
        date: new Date().toISOString(),  
      }) 

      await session.commitTransaction();

      return {
        success: true,
        message: `${cardType} card requested successfully`,
        card: newCard.toJSON(),
        feesCharged: totalFee,
        newBalance: user.account.balance,
        fullCardNumber: newCard.cardNumber,
        pin: newCard.pin, // Return PIN for initial setup
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } 

  /**
   * Get all cards for a user
   */
  async getUserCards(userId: string) {
    try {
      const Card = await getCardModel();
      
      const cards = await Card.find({ user: userId })
        .sort({ createdAt: -1 })
        .lean();

      return {
        success: true,
        cards
      };
    } catch (error) {
      throw new Error(`Failed to fetch user cards: ${error}`);
    }
  }

  /**
   * Get card details with full information (for authenticated requests)
   */
  async getCardDetails(cardId: string, userId: string) {
    try {
      const Card = await getCardModel();
      
      const card = await Card.findOne({ 
        _id: cardId, 
        user: userId 
      });

      if (!card) {
        throw new Error('Card not found or access denied');
      }

      return {
        success: true,
        card: card.toJSON(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch card details: ${error}`);
    }
  }

  /**
   * Update card settings
   */
  async updateCard(cardId: string, userId: string, updates: CardUpdateOptions) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const Card = await getCardModel();
      
      const card = await Card.findOne({ 
        _id: cardId, 
        user: userId 
      }).session(session);

      if (!card) {
        throw new Error('Card not found or access denied');
      }

      // Apply updates
      if (updates.status !== undefined) {
        card.status = updates.status;
      }
      if (updates.dailyLimit !== undefined) {
        card.dailyLimit = updates.dailyLimit;
      }
      if (updates.monthlyLimit !== undefined) {
        card.monthlyLimit = updates.monthlyLimit;
      }
      if (updates.pin !== undefined) {
        // In production, you'd want to hash the PIN
        card.pin = updates.pin;
      }

      await card.save({ session });
      await session.commitTransaction();

      return {
        success: true,
        message: 'Card updated successfully',
        card: card.toJSON(),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Block/Unblock card
   */


  async addTransaction(cardId: string, userId: string, options: TransactionOptions) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const Card = await getCardModel();
    const User = await getUserModel();
    
    const card = await Card.findOne({ 
      _id: cardId, 
      user: userId 
    }).session(session);

    if (!card) {
      throw new Error('Card not found or access denied');
    }

    // Check card status
    if (card.status !== CardStatus.ACTIVE) {
      throw new Error('Card is not active');
    }

    // Check if card is expired
    if (card.expiryDate < new Date()) {
      card.status = CardStatus.EXPIRED;
      await card.save({ session });
      throw new Error('Card has expired');
    }

    const user = await User.findById(card.user).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    // Parse the transaction date
    const transactionDate = options.date ? new Date(options.date) : new Date();
    
    // Validate date is not in the future
    if (transactionDate > new Date()) {
      throw new Error('Transaction date cannot be in the future');
    }

    // For debit transactions, check limits and balance (only for completed transactions)
    const isDebitTransaction = [TransactionType.PURCHASE, TransactionType.ATM_WITHDRAWAL, TransactionType.ONLINE_PAYMENT].includes(options.type);
    const transactionStatus = options.status || 'completed';

    if (isDebitTransaction && transactionStatus === 'completed') {
      // Check daily limit
      if (card.currentSpend.daily + options.amount > card.dailyLimit) {
        throw new Error('Daily limit exceeded');
      }

      // Check monthly limit
      if (card.currentSpend.monthly + options.amount > card.monthlyLimit) {
        throw new Error('Monthly limit exceeded');
      }

      // Check account balance
      if (user.account.balance < options.amount) {
        throw new Error('Insufficient account balance');
      }

      // Debit from account
      user.account.balance -= options.amount;
      await user.save({ session });
    }

    // Generate reference
    const reference = generateBankReference();

    // Add transaction to card
    const newTransaction = {
      amount: options.amount,
      type: options.type,
      merchant: options.merchant || 'BANK',
      location: options.location || 'ONLINE PURCHASE',
      date: transactionDate,
      reference,
      status: transactionStatus,
      currency: options.currency || user.account.currency,
    };

    card.transactions.push(newTransaction);

    // Update spend tracking (only for completed transactions)
    if (transactionStatus === 'completed' && isDebitTransaction) {
      card.currentSpend.daily += options.amount;
      card.currentSpend.monthly += options.amount;
      card.lastUsed = new Date();
    }

    await card.save({ session });
    await session.commitTransaction();

    return {
      success: true,
      message: 'Transaction added successfully',
      transaction: newTransaction,
      newBalance: user.account.balance,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

  async deleteTransaction(cardId: string, userId: string, transactionId: string) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const Card = await getCardModel();
    const User = await getUserModel();
    
    const card = await Card.findOne({ 
      _id: cardId, 
      user: userId 
    }).session(session);

    if (!card) {
      throw new Error('Card not found or access denied');
    }

    const user = await User.findById(card.user).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    // Find the transaction
    const transactionIndex = card.transactions.findIndex(
      (t: any) => t._id?.toString() === transactionId
    );

    if (transactionIndex === -1) {
      throw new Error('Transaction not found');
    }

    const transactionToDelete = card.transactions[transactionIndex];
    const wasCompleted = transactionToDelete.status === 'completed';
    const isDebitTransaction = [TransactionType.PURCHASE, TransactionType.ATM_WITHDRAWAL, TransactionType.ONLINE_PAYMENT].includes(transactionToDelete.type);

    // If this was a completed debit transaction, reverse the spending tracking and balance changes
    if (wasCompleted && isDebitTransaction) {
      card.currentSpend.daily -= transactionToDelete.amount;
      card.currentSpend.monthly -= transactionToDelete.amount;
      user.account.balance += transactionToDelete.amount;
    }

    // Remove the transaction from the array
    card.transactions.splice(transactionIndex, 1);

    await card.save({ session });
    await user.save({ session });
    await session.commitTransaction();

    return {
      success: true,
      message: 'Transaction deleted successfully',
      deletedTransaction: {
        reference: transactionToDelete.reference,
        amount: transactionToDelete.amount,
        type: transactionToDelete.type,
        date: transactionToDelete.date,
      },
      newBalance: user.account.balance,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}


async editTransaction(cardId: string, userId: string, transactionId: string, updates: EditTransactionOptions) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const Card = await getCardModel();
    const User = await getUserModel();
    
    const card = await Card.findOne({ 
      _id: cardId, 
      user: userId 
    }).session(session);

    if (!card) {
      throw new Error('Card not found or access denied');
    }

    const user = await User.findById(card.user).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    // Find the transaction
    const transactionIndex = card.transactions.findIndex(
      (t: any) => t._id?.toString() === transactionId
    );

    if (transactionIndex === -1) {
      throw new Error('Transaction not found');
    }

    const originalTransaction = card.transactions[transactionIndex];
    const wasCompleted = originalTransaction.status === 'completed';
    const isDebitTransaction = [TransactionType.PURCHASE, TransactionType.ATM_WITHDRAWAL, TransactionType.ONLINE_PAYMENT].includes(originalTransaction.type);

    // Validate date if provided
    if (updates.date) {
      const newDate = new Date(updates.date);
      if (newDate > new Date()) {
        throw new Error('Transaction date cannot be in the future');
      }
    }

    // If this was a completed debit transaction, we need to reverse the spending tracking and balance changes
    if (wasCompleted && isDebitTransaction) {
      card.currentSpend.daily -= originalTransaction.amount;
      card.currentSpend.monthly -= originalTransaction.amount;
      user.account.balance += originalTransaction.amount;
    }

    // Apply updates while preserving all existing fields (including required ones like reference)
    const updatedTransaction = { 
      // @ts-ignore
      ...originalTransaction.toObject(), // Convert to plain object to avoid Mongoose document issues
    };
    
    // Only update fields that are explicitly provided
    if (updates.amount !== undefined) updatedTransaction.amount = updates.amount;
    if (updates.type !== undefined) updatedTransaction.type = updates.type;
    if (updates.merchant !== undefined) updatedTransaction.merchant = updates.merchant;
    if (updates.location !== undefined) updatedTransaction.location = updates.location;
    if (updates.currency !== undefined) updatedTransaction.currency = updates.currency;
    if (updates.date !== undefined) updatedTransaction.date = new Date(updates.date);
    if (updates.status !== undefined) updatedTransaction.status = updates.status;

    // Check if the updated transaction is a debit transaction
    const updatedIsDebitTransaction = [TransactionType.PURCHASE, TransactionType.ATM_WITHDRAWAL, TransactionType.ONLINE_PAYMENT].includes(updatedTransaction.type);
    const willBeCompleted = updatedTransaction.status === 'completed';

    // If the updated transaction will be completed and is a debit transaction, apply new limits and balance changes
    if (willBeCompleted && updatedIsDebitTransaction) {
      // Check daily limit
      if (card.currentSpend.daily + updatedTransaction.amount > card.dailyLimit) {
        throw new Error('Daily limit would be exceeded with these changes');
      }

      // Check monthly limit
      if (card.currentSpend.monthly + updatedTransaction.amount > card.monthlyLimit) {
        throw new Error('Monthly limit would be exceeded with these changes');
      }

      // Check account balance
      if (user.account.balance < updatedTransaction.amount) {
        throw new Error('Insufficient account balance for updated amount');
      }

      // Apply new spending tracking and balance changes
      card.currentSpend.daily += updatedTransaction.amount;
      card.currentSpend.monthly += updatedTransaction.amount;
      user.account.balance -= updatedTransaction.amount;
      card.lastUsed = new Date();
    }

    // Update the transaction in the array
    card.transactions[transactionIndex] = updatedTransaction;

    await card.save({ session });
    await user.save({ session });
    await session.commitTransaction();

    return {
      success: true,
      message: 'Transaction updated successfully',
      transaction: updatedTransaction,
      newBalance: user.account.balance,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
async getTransactionById(cardId: string, userId: string, transactionId: string) {
  try {
    const Card = await getCardModel();
    
    const card = await Card.findOne({ 
      _id: cardId, 
      user: userId 
    });

    if (!card) {
      throw new Error('Card not found or access denied');
    }

    // Find the transaction
    const transaction = card.transactions.find(
      (t: any) => t._id?.toString() === transactionId
    );

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return {
      success: true,
      transaction,
    };
  } catch (error) {
    throw new Error(`Failed to fetch transaction: ${error}`);
  }
}
  async toggleCardStatus(cardId: string, userId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const Card = await getCardModel();
      
      const card = await Card.findOne({ 
        _id: cardId, 
        user: userId 
      }).session(session);

      if (!card) {
        throw new Error('Card not found or access denied');
      }

      // Toggle status
      if (card.status === CardStatus.ACTIVE) {
        card.status = CardStatus.BLOCKED;
      } else if (card.status === CardStatus.BLOCKED) {
        card.status = CardStatus.ACTIVE;
      } else {
        throw new Error('Cannot toggle status of inactive or expired card');
      }

      await card.save({ session });
      await session.commitTransaction();

      return {
        success: true,
        message: `Card ${card.status === CardStatus.ACTIVE ? 'activated' : 'blocked'} successfully`,
        card: card.toJSON(),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Report card as lost or stolen
   */
  async reportCard(cardId: string, userId: string, reason: 'lost' | 'stolen') {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const Card = await getCardModel();
      const User = await getUserModel();
      
      const card = await Card.findOne({ 
        _id: cardId, 
        user: userId 
      }).session(session);

      if (!card) {
        throw new Error('Card not found or access denied');
      }

      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Report card as lost or stolen and delete it
      await Card.findByIdAndDelete(cardId).session(session);
      
      // Add transaction record for the report
    //   await card.addTransaction({
    //     amount: 0,
    //     type: TransactionType.FEE,
    //     merchant: 'BANK',
    //     location: `CARD REPORTED ${reason.toUpperCase()}`,
    //     status: 'completed',
    //     currency: user.account.currency,
    //   });

    //   await card.save({ session });

      // In a real system, you might want to automatically request a replacement card
      // For now, we'll just block the current one
          await notificationService.createNotification({
        type: NotificationType.SYSTEM,
        userId: user._id.toString(),
        title: `Card reported as ${reason}`,
        content: `Your card has been reported as ${reason}. We have removed it from your account for security reasons. Please request a replacement card.`,
        action: {
          name: 'Request replacement card',
          type: NotificationActionType.REDIRECT,
          url: `/cards`,
        },
        sender: 'System',
        date: new Date().toISOString(), 
      }) 

      await session.commitTransaction();

      return {
        success: true,
        message: `Card reported as ${reason} and has been blocked. Please request a replacement card.`,
        card: card.toJSON(),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process a card transaction
   */
  async processTransaction(cardId: string, options: TransactionOptions) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const Card = await getCardModel();
      const User = await getUserModel();
      
      const card = await Card.findById(cardId).session(session);
      if (!card) {
        throw new Error('Card not found');
      }

      // Check card status
      if (card.status !== CardStatus.ACTIVE) {
        throw new Error('Card is not active');
      }

      // Check if card is expired
      if (card.expiryDate < new Date()) {
        card.status = CardStatus.EXPIRED;
        await card.save({ session });
        throw new Error('Card has expired');
      }

      const user = await User.findById(card.user).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // For debit transactions, check limits and balance
      if ([TransactionType.PURCHASE, TransactionType.ATM_WITHDRAWAL, TransactionType.ONLINE_PAYMENT].includes(options.type)) {
        // Check daily limit
        if (card.currentSpend.daily + options.amount > card.dailyLimit) {
          throw new Error('Daily limit exceeded');
        }

        // Check monthly limit
        if (card.currentSpend.monthly + options.amount > card.monthlyLimit) {
          throw new Error('Monthly limit exceeded');
        }

        // Check account balance
        if (user.account.balance < options.amount) {
          throw new Error('Insufficient account balance');
        }

        // Debit from account
        user.account.balance -= options.amount;
        await user.save({ session });
      }

      // Add transaction to card
      await card.addTransaction({
        amount: options.amount,
        type: options.type,
        merchant: options.merchant || 'Unknown Merchant',
        location: options.location || 'Unknown Location',
        status: 'completed',
        currency: options.currency || user.account.currency,
      });

      await session.commitTransaction();

      return {
        success: true,
        message: 'Transaction processed successfully',
        transaction: {
          amount: options.amount,
          type: options.type,
          merchant: options.merchant,
          balance: user.account.balance,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get card transaction history
   */
  async getCardTransactions(cardId: string, userId: string, limit: number = 50, offset: number = 0) {
    try {
      const Card = await getCardModel();
      
      const card = await Card.findOne({ 
        _id: cardId, 
        user: userId 
      });

      if (!card) {
        throw new Error('Card not found or access denied');
      }

      // Sort transactions by date (newest first) and apply pagination
      const transactions = card.transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(offset, offset + limit);

      return {
        success: true,
        transactions,
        total: card.transactions.length,
        hasMore: offset + limit < card.transactions.length,
      };
    } catch (error) {
      throw new Error(`Failed to fetch transactions: ${error}`);
    }
  }

  /**
   * Change card PIN
   */
  async changePin(cardId: string, userId: string, newPin: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const Card = await getCardModel();
      
      // Validate PIN format (4 digits)
      if (!/^\d{4}$/.test(newPin)) {
        throw new Error('PIN must be exactly 4 digits');
      }

      const card = await Card.findOne({ 
        _id: cardId, 
        user: userId 
      }).session(session);

      if (!card) {
        throw new Error('Card not found or access denied');
      }

      // In production, hash the PIN before storing
      card.pin = newPin;
      await card.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        message: 'PIN changed successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get card statistics
   */
  async getCardStatistics(cardId: string, userId: string) {
    try {
      const Card = await getCardModel();
      
      const card = await Card.findOne({ 
        _id: cardId, 
        user: userId 
      });

      if (!card) {
        throw new Error('Card not found or access denied');
      }

      // Calculate statistics
      const totalTransactions = card.transactions.length;
      const totalSpent = card.transactions
        .filter(t => [TransactionType.PURCHASE, TransactionType.ATM_WITHDRAWAL, TransactionType.ONLINE_PAYMENT, TransactionType.FEE].includes(t.type))
        .reduce((sum, t) => sum + t.amount, 0);

      const totalReceived = card.transactions
        .filter(t => t.type === TransactionType.REFUND)
        .reduce((sum, t) => sum + t.amount, 0);

      const thisMonthTransactions = card.transactions
        .filter((t: any) => {
          const transactionDate = new Date(t.date);
          const now = new Date();
          return transactionDate.getMonth() === now.getMonth() && 
                 transactionDate.getFullYear() === now.getFullYear();
        });

      return {
        success: true,
        statistics: {
          totalTransactions,
          totalSpent,
          totalReceived,
          netSpent: totalSpent - totalReceived,
          thisMonthTransactions: thisMonthTransactions.length,
          thisMonthSpent: thisMonthTransactions
            .filter((t: any) => [TransactionType.PURCHASE, TransactionType.ATM_WITHDRAWAL, TransactionType.ONLINE_PAYMENT, TransactionType.FEE].includes(t.type))
            .reduce((sum, t) => sum + t.amount, 0),
          dailyLimitUsed: card.currentSpend.daily,
          monthlyLimitUsed: card.currentSpend.monthly,
          dailyLimitRemaining: card.dailyLimit - card.currentSpend.daily,
          monthlyLimitRemaining: card.monthlyLimit - card.currentSpend.monthly,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch card statistics: ${error}`);
    }
  }

  /**
   * Utility method to reset spending limits (typically called by cron jobs)
   */
  
  async resetSpendingLimits(type: 'daily' | 'monthly') {
    try {
      const Card = await getCardModel();
      
      if (type === 'daily') {
        await Card.resetDailySpend();
      } else {
        await Card.resetMonthlySpend();
      }

      return {
        success: true,
        message: `${type} spending limits reset successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to reset ${type} spending limits: ${error}`);
    }
  }
}