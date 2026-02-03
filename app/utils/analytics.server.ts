// ~/services/analysis.server.ts
import { getTransactionModel, TransactionType, TransactionStatus } from '~/models/transaction.server';
import { getUserModel } from '~/models/user.server';
import { getCardModel } from '~/models/card.server';
import mongoose from 'mongoose';

export interface AnalysisData {
  monthlyCredits: number[];
  monthlyDebits: {
    paypal: number[];
    card: number[];
    transfer: number[]; // Added transfer debits
  };
  paymentMethods: {
    credit: number;
    paypal: number;
    card: number;
    transfer: number; // Added transfer debits
  };
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    type: "debit" | "credit";
    method?: "paypal" | "card" | "transfer";
  }>;
}

export class AnalysisService {
  static async getUserAnalysis(userId: string, months: number = 12): Promise<AnalysisData> {
    try {
      const Transaction = await getTransactionModel();
      const User = await getUserModel();
      const Card = await getCardModel();

      // Get user to ensure they exist
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - months);

      // Get all transactions for the user within the date range
      const transactions = await Transaction.find({
        $or: [
          { fromAccount: new mongoose.Types.ObjectId(userId) },
          { toAccount: new mongoose.Types.ObjectId(userId) }
        ],
        createdAt: { $gte: startDate, $lte: endDate },
        status: TransactionStatus.COMPLETED
      }).sort({ createdAt: -1 });

      // Get card transactions
      const cards = await Card.find({ user: new mongoose.Types.ObjectId(userId) });
      const cardTransactions = cards.flatMap(card => 
        card.transactions.filter(t => 
          t.date >= startDate && 
          t.date <= endDate && 
          t.status === 'completed'
        ).map(t => ({
          ...t,
          cardId: card._id,
          fromAccount: userId,
          type: this.mapCardTransactionType(t.type as any),
          createdAt: t.date
        }))
      );

      // Combine all transactions
      const allTransactions = [...transactions, ...cardTransactions as any[]];

      // Generate monthly data
      const monthlyCredits = this.generateMonthlyCredits(allTransactions, userId, months);
      const monthlyDebits = this.generateMonthlyDebits(transactions, cardTransactions, userId, months);
      const paymentMethods = this.calculatePaymentMethods(transactions, cardTransactions, userId);
      const recentTransactions = this.formatRecentTransactions(
        [...transactions.slice(0, 6), ...cardTransactions.slice(0, 6)]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 6),
        userId
      );

      return {
        monthlyCredits,
        monthlyDebits,
        paymentMethods,
        recentTransactions
      };

    } catch (error) {
      console.error('Analysis service error:', error);
      throw new Error('Failed to generate user analysis');
    }
  }

  private static mapCardTransactionType(cardTransactionType: string): TransactionType {
    switch (cardTransactionType) {
      case 'purchase':
      case 'online_payment':
        return TransactionType.BILL_PAYMENT;
      case 'atm_withdrawal':
        return TransactionType.WITHDRAWAL;
      case 'transfer':
        return TransactionType.TRANSFER;
      case 'refund':
        return TransactionType.DEPOSIT;
      default:
        return TransactionType.BILL_PAYMENT;
    }
  }

  private static generateMonthlyCredits(transactions: any[], userId: string, months: number): number[] {
    const monthlyData = new Array(months).fill(0);
    const currentDate = new Date();

    transactions.forEach(transaction => {
      const isCredit = this.isTransactionCredit(transaction, userId);
      if (isCredit) {
        const transactionDate = new Date(transaction.createdAt);
        const monthsDiff = this.getMonthsDifference(transactionDate, currentDate);
        
        if (monthsDiff >= 0 && monthsDiff < months) {
          const index = months - 1 - monthsDiff;
          monthlyData[index] += Math.abs(transaction.amount);
        }
      }
    });

    return monthlyData;
  }

  private static generateMonthlyDebits(transactions: any[], cardTransactions: any[], userId: string, months: number): { paypal: number[]; card: number[]; transfer: number[] } {
    const paypalData = new Array(months).fill(0);
    const cardData = new Array(months).fill(0);
    const transferData = new Array(months).fill(0);
    const currentDate = new Date();

    // Process regular transactions (non-card)
    transactions.forEach(transaction => {
      const isDebit = !this.isTransactionCredit(transaction, userId);
      if (isDebit) {
        const transactionDate = new Date(transaction.createdAt);
        const monthsDiff = this.getMonthsDifference(transactionDate, currentDate);
        
        if (monthsDiff >= 0 && monthsDiff < months) {
          const index = months - 1 - monthsDiff;
          
          // Categorize based on transaction type from transaction.server.ts
          switch (transaction.type) {
            case TransactionType.PAYPAL:
              paypalData[index] += Math.abs(transaction.amount);
              break;
            case TransactionType.TRANSFER:
            case TransactionType.WITHDRAWAL:
            case TransactionType.BILL_PAYMENT:
            case TransactionType.WIRE_TRANSFER:
            case TransactionType.FEE:
              transferData[index] += Math.abs(transaction.amount);
              break;
            default:
              // Any other transaction types go to transfer
              transferData[index] += Math.abs(transaction.amount);
              break;
          }
        }
      }
    });

    // Process card transactions separately - these all go to cardData
    cardTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.createdAt);
      const monthsDiff = this.getMonthsDifference(transactionDate, currentDate);
      
      if (monthsDiff >= 0 && monthsDiff < months) {
        const index = months - 1 - monthsDiff;
        cardData[index] += Math.abs(transaction.amount);
      }
    });

    return { paypal: paypalData, card: cardData, transfer: transferData };
  }

  private static calculatePaymentMethods(transactions: any[], cardTransactions: any[], userId: string): { credit: number; paypal: number; card: number; transfer: number } {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    let credit = 0;
    let paypal = 0;
    let card = 0;
    let transfer = 0;

    // Process regular transactions
    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.createdAt);
      if (transactionDate >= currentMonth) {
        if (this.isTransactionCredit(transaction, userId)) {
          credit += Math.abs(transaction.amount);
        } else {
          // Categorize debits based on transaction type
          switch (transaction.type) {
            case TransactionType.PAYPAL:
              paypal += Math.abs(transaction.amount);
              break;
            case TransactionType.TRANSFER:
            case TransactionType.WITHDRAWAL:
            case TransactionType.BILL_PAYMENT:
            case TransactionType.WIRE_TRANSFER:
            case TransactionType.FEE:
              transfer += Math.abs(transaction.amount);
              break;
            default:
              transfer += Math.abs(transaction.amount);
              break;
          }
        }
      }
    });

    // Process card transactions - these all go to card
    cardTransactions.forEach(transaction => {
      const transactionDate = new Date(transaction.createdAt);
      if (transactionDate >= currentMonth) {
        card += Math.abs(transaction.amount);
      }
    });

    return { credit, paypal, card, transfer };
  }

  private static formatRecentTransactions(transactions: any[], userId: string): any[] {
    return transactions.map(transaction => {
      const isCredit = this.isTransactionCredit(transaction, userId);
      const isCard = !!transaction.cardId;
      
      return {
        id: transaction._id?.toString() || transaction.reference,
        date: new Date(transaction.createdAt).toISOString().split('T')[0],
        description: transaction.description || this.getTransactionDescription(transaction),
        category: this.getTransactionCategory(transaction, isCredit, isCard),
        amount: isCredit ? Math.abs(transaction.amount) : -Math.abs(transaction.amount),
        type: isCredit ? "credit" : "debit",
        method: this.getTransactionMethod(transaction, isCard)
      };
    });
  }

  private static isTransactionCredit(transaction: any, userId: string): boolean {
    if (transaction.cardId) return false; // Card transactions are always debits
    
    return transaction.toAccount?.toString() === userId || 
           (transaction.type === TransactionType.DEPOSIT) ||
           (transaction.type === TransactionType.INTEREST);
  }

  private static getTransactionDescription(transaction: any): string {
    if (transaction.merchant) return transaction.merchant;
    if (transaction.description) return transaction.description;
    
    switch (transaction.type) {
      case TransactionType.DEPOSIT:
        return 'Account Deposit';
      case TransactionType.WITHDRAWAL:
        return 'ATM Withdrawal';
      case TransactionType.TRANSFER:
        return 'Bank Transfer';
      case TransactionType.BILL_PAYMENT:
        return 'Bill Payment';
      case TransactionType.PAYPAL:
        return 'PayPal Payment';
      case TransactionType.WIRE_TRANSFER:
        return 'Wire Transfer';
      case TransactionType.FEE:
        return 'Service Fee';
      case 'purchase':
        return 'Card Purchase';
      case 'online_payment':
        return 'Online Payment';
      default:
        return 'Transaction';
    }
  }

  private static getTransactionCategory(transaction: any, isCredit: boolean, isCard: boolean): string {
    if (isCredit) return 'Income';
    if (isCard) return 'Card Payment';
    if (transaction.type === TransactionType.PAYPAL) return 'PayPal Payment';
    if (transaction.type === TransactionType.TRANSFER || 
        transaction.type === TransactionType.WITHDRAWAL || 
        transaction.type === TransactionType.BILL_PAYMENT ||
        transaction.type === TransactionType.WIRE_TRANSFER ||
        transaction.type === TransactionType.FEE) return 'Bank Transfer';
    return 'Other Payment';
  }

  private static getTransactionMethod(transaction: any, isCard: boolean): "paypal" | "card" | "transfer" | undefined {
    if (isCard) return 'card';
    if (transaction.type === TransactionType.PAYPAL) return 'paypal';
    if (transaction.type === TransactionType.TRANSFER || 
        transaction.type === TransactionType.WITHDRAWAL || 
        transaction.type === TransactionType.BILL_PAYMENT ||
        transaction.type === TransactionType.WIRE_TRANSFER ||
        transaction.type === TransactionType.FEE) return 'transfer';
    return 'transfer'; // Default fallback
  }

  private static getMonthsDifference(date1: Date, date2: Date): number {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months - date1.getMonth() + date2.getMonth();
  }
}