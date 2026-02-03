// ~/services/transaction.service.ts
import mongoose from 'mongoose';
import { getUserModel, type IUser } from '~/models/user.server';
import { getTransactionModel, TransactionType, TransactionStatus } from '~/models/transaction.server';
import { emailReceiptService } from '~/services/email-receipt.server';

export interface TransferRequest {
  fromUserId: string;
  recipientName: string;
  bankName?: string;
  country: string;
  accountType: string;
  accountNumber: string;
  routingNumber?: string;
  sortCode?: string;
  iban?: string;
  swiftCode?: string;
  currency: string;
  bankAddress?: string;
  amount: number;
  description?: string;
  pin: string;
  date: string;
  status: TransactionStatus;
  sendEmail: boolean;
  transferType: 'domestic' | 'international';
}

export interface WithdrawalRequest {
  userId: string;
  amount: number;
  description: string;
  pin: string;
}

export interface PaypalRequest {
  userId: string;
  amount: number;
  email: string;
  description: string | null;
  pin: string;
  name: string | null;
}

export interface DepositRequest {
  userId: string;
  amount: number;
  description: string;
  source?: string;
}

export interface TransactionResult {
  success: boolean;
  message: string;
  error?: string;
  transactionId?: string;
  reference?: string;
  balance?: number;
  status?: TransactionStatus;
  amount?: number;
  currency?: string;
  receiverName?: string;
  receiverBankName?: string;
 
}

export interface WireTransferRequest {
  fromUserId: string;
  amount: number;
  currency: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryBankName: string;
  beneficiaryBankSwift: string;
  country: string;
  iban?: string;
  sortCode?: string;
  routingNumber?: string;
  purpose: string;
  instructions?: string;
  feesOption: string;
  pin: string;
}

type CardTranRequest = {
  amount: number;
  currency: string;
  fromAccount: string;
  description: string;
  initiatedBy: string;
}

class TransactionService {
  private async validateUser(userId: string): Promise<IUser | null> {
    const User = await getUserModel();
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  private async validatePin(user: IUser, pin: string): Promise<boolean> {
    return user.account.pin === pin;
  }

   async findUserByAccountNumber(accountNumber: string): Promise<IUser | null> {
    const User = await getUserModel();
    return await User.findOne({ 'account.number': accountNumber });
  }

  private async updateBalance(userId: string, newBalance: number): Promise<void> {
    const User = await getUserModel();
    await User.findByIdAndUpdate(userId, { 
      'account.balance': newBalance,
      lastLogin: new Date()
    });
  }


  
  private generateTransactionReference(): string {
    const now = new Date();
  
 
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;

 
  const randomPart = Math.floor(Math.random() * 1_000_000_0000) 
    .toString()
    .padStart(10, "0");

  return `${datePart}${randomPart}`;
  }

  private determineTransactionStatus(transferType: string, country: string): TransactionStatus {
    // Domestic transfers to same country are instant
    if (transferType === 'domestic') {
      return TransactionStatus.COMPLETED;
    }
    
    // International transfers are pending initially
    return TransactionStatus.PENDING;
  }

   async createTransaction(data: {
    type: TransactionType;
    reference: string;
    amount: number;
    currency: string;
    fromAccount: string;
    toAccount?: string;
    description: string;
    status: TransactionStatus;
    initiatedBy: string;
    metadata?: any;
    createdAt?: Date;
  }) {
    const Transaction = await getTransactionModel();
    const transaction = new Transaction({
      reference: data.reference,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      fromAccount: new mongoose.Types.ObjectId(data.fromAccount),
      toAccount: data.toAccount ? new mongoose.Types.ObjectId(data.toAccount) : undefined,
      description: data.description,
      status: data.status,
      initiatedBy: new mongoose.Types.ObjectId(data.initiatedBy),
      metadata: data.metadata,
      createdAt: data.createdAt || new Date(),
    });

    await transaction.save();
    return transaction;
  }


    async sendEmailReceiptIfRequested(
    transaction: any,
    userId: string,
    userEmail: string,
    sendEmailReceipt: boolean
  ): Promise<void> {
    try {
     
      if (!sendEmailReceipt) {
        return;
      }
    
      // Populate the transaction with account details for email
      const populatedTransaction = await this.populateTransactionForEmail(
        transaction
      );

      await emailReceiptService.sendTransactionReceipt({
        transaction: populatedTransaction,
        userEmail,
        currentUserId: userId,
      });
    } catch (error) {
      console.error("Failed to send email receipt:", error);
      // Don't throw error - receipt email failure shouldn't fail the transaction
    }
  }

  private async populateTransactionForEmail(transaction: any): Promise<any> {
    const Transaction = await getTransactionModel();

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate(
        "fromAccount",
        "firstName lastName account.number account.currency email"
      )
      .populate(
        "toAccount",
        "firstName lastName account.number account.currency email"
      )
      .lean();

    return populatedTransaction;
  }

  async transfer(request: TransferRequest): Promise<TransactionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate sender
      const sender = await this.validateUser(request.fromUserId);
      if (!sender) {
        return { success: false, message: 'Sender not found', status: TransactionStatus.FAILED, error: 'Sender not found' };
      }

      // Validate PIN
      if (!(await this.validatePin(sender, request.pin))) {
        return { success: false, message: 'Invalid PIN', status: TransactionStatus.FAILED, error: 'Invalid PIN' };
      }

      // Validate amount
      if (request.amount <= 0) {
        return { success: false, message: 'Amount must be greater than zero', status: TransactionStatus.FAILED, error: 'Amount must be greater than zero' };
      }

      if (sender.account.balance < request.amount) {
        return { success: false, message: 'Insufficient funds', status: TransactionStatus.FAILED, error: 'Insufficient funds' };
      }

      // Determine transaction status based on transfer type
      const transactionStatus = this.determineTransactionStatus(
        request.transferType, 
        request.country
      );

      // For domestic transfers, try to find recipient in our system
      let recipient: IUser | null = null;
      let isInternalTransfer = false;

      if (request.transferType === 'domestic') {
        recipient = await this.findUserByAccountNumber(request.accountNumber);
        if (recipient) {
          isInternalTransfer = true;
          
          // if (recipient.account.status !== 'active') {
          //   throw new Error('Recipient account is not active');
          // }

          // Prevent self-transfer
          if (sender._id.toString() === recipient._id.toString()) {
            return { success: false, message: 'Self-transfer not allowed', status: TransactionStatus.FAILED, error: 'Self-transfer not allowed' };
          }
        }
      }

      // Create transaction reference
      const reference = this.generateTransactionReference();
      

      // Create metadata for transaction
      const metadata = {
        recipientName: request.recipientName,
        bankName: request.bankName,
        country: request.country,
        accountType: request.accountType,
        accountNumber: request.accountNumber,
        routingNumber: request.routingNumber,
        sortCode: request.sortCode,
        iban: request.iban,
        swiftCode: request.swiftCode,
        bankAddress: request.bankAddress,
        transferType: request.transferType,
        isInternalTransfer,
        processingTime: request.transferType === 'domestic' ? 'Instant' : '1-3 business days'
      };

      // For completed domestic internal transfers, update both balances
      if (transactionStatus === TransactionStatus.COMPLETED && isInternalTransfer && recipient) {
        const senderNewBalance = sender.account.balance - request.amount;
        const recipientNewBalance = recipient.account.balance + request.amount;

        await this.updateBalance(sender._id, senderNewBalance);
        await this.updateBalance(recipient._id.toString(), recipientNewBalance);

        // Create transaction record for internal transfer
        const transaction = await this.createTransaction({
          type: TransactionType.TRANSFER,
          reference,
          amount: request.amount,
          currency: request.currency,
          fromAccount: sender._id.toString(),
          toAccount: recipient._id.toString(),
          description: `Transfer to ${recipient.firstName} ${recipient.lastName}`,
          status: request.status,
          initiatedBy: sender._id.toString(),
          metadata,
          createdAt: new Date(request.date) || new Date()
        });

        await session.commitTransaction();

          await this.sendEmailReceiptIfRequested(
            transaction,
            sender._id.toString(),
            sender.email,
            request.sendEmail
          );

           await this.sendEmailReceiptIfRequested(
            transaction,
            recipient._id.toString(),
            recipient.email,
            request.sendEmail
          );

        return {
          success: true,
          message: `Transfer of ${request.currency} ${request.amount.toLocaleString()} completed successfully`,
          transactionId: transaction._id.toString(),
          reference: transaction.reference,
          balance: senderNewBalance,
          status: TransactionStatus.COMPLETED,
        };
      } else {
        // For external or pending transfers, only deduct from sender
        const senderNewBalance = sender.account.balance - request.amount;
        await this.updateBalance(sender._id, senderNewBalance);

        // Create transaction record for external transfer
        const transaction = await this.createTransaction({
          type: TransactionType.TRANSFER,
          reference,
          amount: request.amount,
          currency: request.currency,
          fromAccount: sender._id.toString(),
          description:  `Transfer to ${request.recipientName} (${request.accountNumber}) `,
          status: request.status,
          initiatedBy: sender._id.toString(),
          metadata,
          createdAt: new Date(request.date) || new Date()
        });

        await session.commitTransaction();

           await this.sendEmailReceiptIfRequested(
            transaction,
            sender._id.toString(),
            sender.email,
            request.sendEmail
          );
        

        const statusMessage = transactionStatus === TransactionStatus.PENDING 
          ? `Transfer of ${request.currency} ${request.amount.toLocaleString()} is being processed. It will be completed within 1-3 business days.`
          : `Transfer of ${request.currency} ${request.amount.toLocaleString()} completed successfully`;

        return {
          success: true,
          message: statusMessage,
          transactionId: transaction._id.toString(),
          reference: transaction.reference,
          balance: senderNewBalance,
          status: transactionStatus,
        };
      }

    } catch (error: any) {
      await session.abortTransaction();
      return {
        success: false,
        message: error.message || 'Transfer failed',
      };
    } finally {
      session.endSession();
    }
  }

  async withdraw(request: WithdrawalRequest): Promise<TransactionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await this.validateUser(request.userId);
      if (!user) {
        return { success: false, message: 'User not found', status: TransactionStatus.FAILED, error: 'User not found' };
      }

      if (!(await this.validatePin(user, request.pin))) {
        return { success: false, message: 'Invalid PIN', status: TransactionStatus.FAILED, error: 'Invalid PIN' };
      }

      if (request.amount <= 0) {
       return { success: false, message: 'Amount must be greater than zero', status: TransactionStatus.FAILED, error: 'Amount must be greater than zero' };
      }

      if (user.account.balance < request.amount) {
        return { success: false, message: 'Insufficient funds', status: TransactionStatus.FAILED, error: 'Insufficient funds' };
      }

      const dailyLimit = 5000;
      if (request.amount > dailyLimit) {
       return { success: false, message: 'Daily withdrawal limit exceeded', status: TransactionStatus.FAILED, error: 'Daily withdrawal limit exceeded' };
      }

      const newBalance = user.account.balance - request.amount;
      await this.updateBalance(user._id, newBalance);

      // const metadata = {
      //   bankName: request.bankName,
      //   accountNumber: request.accountNumber,
      //   sortCode: request.sortCode,
      //   iban: request.iban,
      //   swiftCode: request.swiftCode,
      //   bankAddress: request.bankAddress,
      //   transferType: request.transferType,
      //   processingTime: request.transferType === 'domestic' ? 'Instant' : '1-3 business days'
      // }

      const transaction = await this.createTransaction({
        type: TransactionType.WITHDRAWAL,
        reference: this.generateTransactionReference(),
        amount: request.amount,
        currency: user.account.currency,
        fromAccount: user._id.toString(),
        description: request.description || `Withdrawal of ${user.account.currency} ${request.amount}`,
        status: TransactionStatus.COMPLETED,
        initiatedBy: user._id.toString(),
      });

      await session.commitTransaction();

      return {
        success: true,
        message: `Withdrawal of ${user.account.currency} ${request.amount.toLocaleString()} completed successfully`,
        transactionId: transaction._id.toString(),
        reference: transaction.reference,
        balance: newBalance,
        status: TransactionStatus.COMPLETED,
      };

    } catch (error: any) {
      await session.abortTransaction();
      return {
        success: false,
        message: error.message || 'Withdrawal failed',
      };
    } finally {
      session.endSession();
    }
  }
  async paypal(request: PaypalRequest): Promise<TransactionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await this.validateUser(request.userId);
      if (!user) {
        return { success: false, message: 'User not found', status: TransactionStatus.FAILED, error: 'User not found' };
      }

      if (!(await this.validatePin(user, request.pin))) {
        return { success: false, message: 'Invalid PIN', status: TransactionStatus.FAILED, error: 'Invalid PIN' };
      }

      if (request.amount <= 0) {
       return { success: false, message: 'Amount must be greater than zero', status: TransactionStatus.FAILED, error: 'Amount must be greater than zero' };
      }

      if (user.account.balance < request.amount) {
         return { success: false, message: 'Insufficient funds', status: TransactionStatus.FAILED, error: 'Insufficient funds' };
      }

      const dailyLimit = 5000;
      if (request.amount > dailyLimit) {
       return { success: false, message: 'Daily withdrawal limit exceeded', status: TransactionStatus.FAILED, error: 'Daily withdrawal limit exceeded' };
      }

      const newBalance = user.account.balance - request.amount;
      await this.updateBalance(user._id, newBalance);

      const metadata = {
        email: request.email,
        name: request.name,
        description: request.description,
      }

      const transaction = await this.createTransaction({
        type: TransactionType.PAYPAL,
        reference: this.generateTransactionReference(),
        amount: request.amount,
        currency: user.account.currency,
        fromAccount: user._id.toString(),
        description:  `PayPal Transfer of ${user.account.currency} ${request.amount} to ${request.email}`,
        status: TransactionStatus.PENDING,
        initiatedBy: user._id.toString(),
        metadata
      });

      await session.commitTransaction();

      return {
        success: true,
        message: `PayPal Transfer of ${user.account.currency} ${request.amount.toLocaleString()} is being processed.`,
        transactionId: transaction._id.toString(),
        reference: transaction.reference,
        balance: newBalance,
        status: TransactionStatus.PENDING,
      };

    } catch (error: any) {
      await session.abortTransaction();
      return {
        success: false,
        message: error.message || 'PayPal Transfer failed',
      };
    } finally {
      session.endSession();
    }
  }

  async deposit(request: DepositRequest): Promise<TransactionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await this.validateUser(request.userId);
      if (!user) {
        return { success: false, message: 'User not found', status: TransactionStatus.FAILED, error: 'User not found' };
      }

      if (request.amount <= 0) {
       return { success: false, message: 'Amount must be greater than zero', status: TransactionStatus.FAILED, error: 'Amount must be greater than zero' };
      }

      const dailyLimit = 50000;
      if (request.amount > dailyLimit) {
       return { success: false, message: 'Daily deposit limit exceeded', status: TransactionStatus.FAILED, error: 'Daily deposit limit exceeded' };
      }

      const newBalance = user.account.balance + request.amount;
      await this.updateBalance(user._id, newBalance);

      const metadata = {
        source: request.source
      }

      const transaction = await this.createTransaction({
        type: TransactionType.DEPOSIT,
        reference: this.generateTransactionReference(),
        amount: request.amount,
        currency: user.account.currency,
        fromAccount: user._id.toString(),
        description: request.description + (request.source ? ` via ${request.source}` : ''),
        status: TransactionStatus.COMPLETED,
        initiatedBy: user._id.toString(),
      });

      await session.commitTransaction();

      return {
        success: true,
        message: `Deposit of ${user.account.currency} ${request.amount.toLocaleString()} completed successfully`,
        transactionId: transaction._id.toString(),
        reference: transaction.reference,
        balance: newBalance,
        status: TransactionStatus.COMPLETED,
      };

    } catch (error: any) {
      await session.abortTransaction();
      return {
        success: false,
        message: error.message || 'Deposit failed',
      };
    } finally {
      session.endSession();
    }
  }

  async getTransactionHistory(
    userId: string, 
    limit: number = 50, 
    page: number = 1,
    type?: TransactionType,
    status?: TransactionStatus
  ) {
    try {
      const Transaction = await getTransactionModel();
      const skip = (page - 1) * limit;

      const filter: any = {
        $or: [
          { fromAccount: new mongoose.Types.ObjectId(userId) },
          { toAccount: new mongoose.Types.ObjectId(userId) }
        ]
      };

      if (type) {
        filter.type = type;
      }

      if (status) {
        filter.status = status;
      }

      const transactions = await Transaction
        .find(filter)
        .populate('fromAccount', 'firstName lastName account.number account.currency')
        .populate('toAccount', 'firstName lastName account.number account.currency')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await Transaction.countDocuments(filter);

      // Format transactions for better display
      const formattedTransactions = transactions.map((transaction: any) => {
        const isOutgoing = transaction.fromAccount._id.toString() === userId;
        
        return {
          ...transaction,
          direction: isOutgoing ? 'outgoing' : 'incoming',
          counterparty: isOutgoing 
            ? transaction.toAccount 
              ? `${transaction.toAccount.firstName} ${transaction.toAccount.lastName}`
              : transaction.metadata?.recipientName || 'External Account'
            : `${transaction.fromAccount.firstName} ${transaction.fromAccount.lastName}`,
          formattedAmount: `${transaction.currency} ${transaction.amount.toLocaleString()}`,
          statusColor: this.getStatusColor(transaction.status),
          processingTime: transaction.metadata?.processingTime || '',
        };
      });

      return {
        success: true,
        data: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch transaction history'
      };
    }
  }

  private getStatusColor(status: TransactionStatus): string {
    switch (status) {
      case TransactionStatus.COMPLETED:
        return 'green';
      case TransactionStatus.PENDING:
        return 'yellow';
      case TransactionStatus.FAILED:
        return 'red';
      case TransactionStatus.REVERSED:
        return 'gray';
      default:
        return 'gray';
    }
  }

  async getTransactionById(transactionId: string, userId: string) {
    try {
      const Transaction = await getTransactionModel();
      
      const transaction = await Transaction
        .findOne({
          _id: new mongoose.Types.ObjectId(transactionId),
          $or: [
            { fromAccount: new mongoose.Types.ObjectId(userId) },
            { toAccount: new mongoose.Types.ObjectId(userId) }
          ]
        })
        .populate('fromAccount', 'firstName lastName account.number account.currency')
        .populate('toAccount', 'firstName lastName account.number account.currency')
        .lean();

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const isOutgoing = transaction.fromAccount._id.toString() === userId;

   const formattedTransaction = {
  ...transaction,
  direction: isOutgoing ? 'outgoing' : 'incoming',
  counterparty: isOutgoing 
    ? transaction.toAccount 
      ? `${(transaction.toAccount as any).firstName} ${(transaction.toAccount as any).lastName}`
      : transaction.metadata?.recipientName || 'External Account'
    : `${(transaction.fromAccount as any).firstName} ${(transaction.fromAccount as any).lastName}`,
  formattedAmount: `${transaction.currency} ${transaction.amount.toLocaleString()}`,
  statusColor: this.getStatusColor(transaction.status),
};

      return {
        success: true,
        data: formattedTransaction
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch transaction'
      };
    }
  }

  async getAccountBalance(userId: string) {
    try {
      const user = await this.validateUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        balance: user.account.balance,
        currency: user.account.currency,
        accountNumber: user.account.number,
        accountStatus: user.account.status
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch balance'
      };
    }
  }

  async getTransactionSummary(userId: string, period: 'week' | 'month' | 'year' = 'month') {
    try {
      const Transaction = await getTransactionModel();
      
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      const summary = await Transaction.aggregate([
        {
          $match: {
            $or: [
              { fromAccount: new mongoose.Types.ObjectId(userId) },
              { toAccount: new mongoose.Types.ObjectId(userId) }
            ],
            createdAt: { $gte: startDate },
            status: TransactionStatus.COMPLETED
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      return {
        success: true,
        data: summary,
        period
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch transaction summary'
      };
    }
  }

  async wireTransfer(request: WireTransferRequest): Promise<TransactionResult> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate sender
    const sender = await this.validateUser(request.fromUserId);
    if (!sender) {
      throw new Error('Sender not found');
    }

    // Validate PIN
    if (!(await this.validatePin(sender, request.pin))) {
      return { 
        success: false, 
        message: 'Invalid PIN', 
        status: TransactionStatus.FAILED, 
        error: 'Invalid PIN' 
      };
    }

    // Validate amount
    if (request.amount <= 0) {
      return { 
        success: false, 
        message: 'Amount must be greater than zero', 
        status: TransactionStatus.FAILED, 
        error: 'Amount must be greater than zero' 
      };
    }

    // Check daily wire transfer limit
    const dailyWireLimit = 100000; // $100,000 daily limit for wire transfers
    if (request.amount > dailyWireLimit) {
      return { 
        success: false, 
        message: `Daily wire transfer limit of ${sender.account.currency} ${dailyWireLimit.toLocaleString()} exceeded`, 
        status: TransactionStatus.FAILED, 
        error: 'Daily wire transfer limit exceeded' 
      };
    }

    // Calculate fees based on feesOption
    let totalDeduction = request.amount;
    let wireTransferFee = 25; // Base wire transfer fee

    // Adjust fee based on destination country
    const isEuroZone = ['GM', 'FR', 'BE', 'LU', 'MC', 'ES', 'IT', 'PT', 'NL', 'DE', 'AT', 'CH'].includes(request.country.toLowerCase());
    const isUSTransfer = ['united states', 'usa', 'US'].includes(request.country.toLowerCase());
    
    if (isEuroZone) {
      wireTransferFee = 15; // Lower fee for Euro zone
    } else if (isUSTransfer) {
      wireTransferFee = 20; // Moderate fee for US
    } else {
      wireTransferFee = 35; // Higher fee for other countries
    }

    // Apply fee based on option
    if (request.feesOption === 'beneficiary' || request.feesOption === 'our') {
      // Sender pays all fees
      totalDeduction = request.amount + wireTransferFee;
    } else if (request.feesOption === 'sender' || request.feesOption === 'ben') {
      // Fees deducted from transfer amount
      totalDeduction = request.amount;
    } else {
      // Shared fees (default)
      totalDeduction = request.amount + (wireTransferFee / 2);
    }

    // Check sufficient balance
    if (sender.account.balance < totalDeduction) {
      return { 
        success: false, 
        message: 'Insufficient funds including wire transfer fees', 
        status: TransactionStatus.FAILED, 
        error: 'Insufficient funds' 
      };
    }

    // Wire transfers are always pending initially for compliance
    const transactionStatus = TransactionStatus.PENDING;

    // Create transaction reference
    const reference = this.generateTransactionReference();

    // Create metadata for wire transfer
    const metadata = {
      beneficiaryName: request.beneficiaryName,
      beneficiaryAccount: request.beneficiaryAccount,
      beneficiaryBankName: request.beneficiaryBankName,
      beneficiaryBankSwift: request.beneficiaryBankSwift,
      country: request.country,
      iban: request.iban,
      sortCode: request.sortCode,
      routingNumber: request.routingNumber,
      purpose: request.purpose,
      instructions: request.instructions,
      feesOption: request.feesOption,
      wireTransferFee,
      totalDeduction,
      transferType: 'international_wire',
      processingTime: '1-5 business days',
      complianceStatus: 'under_review',
      exchangeRate: request.currency !== sender.account.currency ? 'Market rate applied' : null
    };

    // Deduct amount from sender's account
    const senderNewBalance = sender.account.balance - totalDeduction;
    await this.updateBalance(sender._id, senderNewBalance);

    // Create transaction record for wire transfer
    const transaction = await this.createTransaction({
      type: TransactionType.WIRE_TRANSFER, 
      reference,
      amount: request.amount,
      currency: request.currency,
      fromAccount: sender._id.toString(),
      description: `Wire transfer to ${request.beneficiaryName} - ${request.beneficiaryBankName}`,
      status: transactionStatus,
      initiatedBy: sender._id.toString(),
      metadata,
    });

    await session.commitTransaction();

    return {
      success: true,
      message: `Wire transfer of ${request.currency} ${request.amount.toLocaleString()} has been initiated. It will be processed within 1-5 business days.`,
      transactionId: transaction._id.toString(),
      reference: transaction.reference,
      balance: senderNewBalance,
      status: transactionStatus,
      amount: request.amount,
      currency: request.currency,
      receiverName: request.beneficiaryName,
      receiverBankName: request.beneficiaryBankName,
    };

  } catch (error: any) {
    await session.abortTransaction();
    return {
      success: false,
      message: error.message || 'Wire transfer failed',
      status: TransactionStatus.FAILED,
      error: error.message
    };
  } finally {
    session.endSession();
  }
}

async CardTransaction(data: CardTranRequest) {
       const transaction = await this.createTransaction({
        type: TransactionType.FEE,
        reference: this.generateTransactionReference(),
        amount: data.amount,
        currency: data.currency,
        fromAccount: data.fromAccount,
        description: data.description,
        status: TransactionStatus.COMPLETED,
        initiatedBy: data.initiatedBy,
      });

      return transaction
}

}

export const transactionService = new TransactionService();