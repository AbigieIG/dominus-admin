import mongoose, { Document, Schema } from 'mongoose';
import { CardGenerator, generateBankReference } from '~/utils/banknumber';
import dbConnect from '~/utils/db.server';

export enum CardType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export enum CardStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  EXPIRED = 'expired',
}

export enum TransactionType {
  PURCHASE = 'purchase',
  ATM_WITHDRAWAL = 'atm_withdrawal',
  ONLINE_PAYMENT = 'online_payment',
  TRANSFER = 'transfer',
  REFUND = 'refund',
  FEE = 'fee',
}

interface ICardTransaction {
  _id?: mongoose.Types.ObjectId;
  amount: number;
  type: TransactionType;
  merchant?: string;
  location?: string;
  date: Date;
  reference: string;
  status: 'pending' | 'completed' | 'failed';
  currency: string;
}

// Document interface (for instances)
interface ICard extends Document {
  cardNumber: string;
  user: mongoose.Types.ObjectId;
  account: mongoose.Types.ObjectId;
  type: CardType;
  pin: string;
  expiryDate: Date;
  cvv: string;
  status: CardStatus;
  dailyLimit: number;
  monthlyLimit: number;
  issuedAt: Date;
  lastUsed?: Date;
  transactions: ICardTransaction[];
  currentSpend: {
    daily: number;
    monthly: number;
  };
  // Timestamps added by Mongoose
  createdAt: Date;
  updatedAt: Date;
  
  // Instance method
  addTransaction(transactionData: Omit<ICardTransaction, 'reference' | 'date'>): Promise<ICard>;
   toObject(): any;
}

// Model interface (for statics)
interface ICardModel extends mongoose.Model<ICard> {
  resetDailySpend(): Promise<void>;
  resetMonthlySpend(): Promise<void>;
}

const CardTransactionSchema: Schema = new Schema({
  amount: { type: Number, required: true },
  type: {
    type: String,
    enum: Object.values(TransactionType),
    required: true,
  },
  merchant: { type: String },
  location: { type: String },
  date: { type: Date, default: Date.now },
  reference: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed',
  },
  currency: { type: String, default: 'USD' },
});

const CardSchema: Schema = new Schema(
  {
    // Make cardNumber not required since it's auto-generated
    cardNumber: { type: String, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    type: {
      type: String,
      enum: Object.values(CardType),
      required: true,
    },
    // Make expiryDate not required since it's auto-generated
    expiryDate: { type: Date },
    // Make cvv not required since it's auto-generated
    cvv: { type: String },
    // Make pin not required initially
    pin: { type: String },
    status: {
      type: String,
      enum: Object.values(CardStatus),
      default: CardStatus.ACTIVE,
    },
    dailyLimit: { type: Number, default: 1000 },
    monthlyLimit: { type: Number, default: 5000 },
    issuedAt: { type: Date, default: Date.now },
    lastUsed: { type: Date },
    transactions: [CardTransactionSchema],
    currentSpend: {
      daily: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

CardSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.cardNumber = obj.cardNumber;
  delete obj.cvv;
  return obj;
};

// Pre-save hook to generate card number, CVV, expiry date, and PIN
CardSchema.pre<ICard>('save', async function (next) {
  if (!this.isNew) return next();
  
  try {
    // Generate a unique 16-digit card number
    let cardNumber: string;
    let isUnique = false;
    
    while (!isUnique) {
      cardNumber = CardGenerator.generateCard(this.type);
      
      // Check if this card number already exists
      const existingCard = await mongoose.models.Card?.findOne({ cardNumber });
      if (!existingCard) {
        isUnique = true;
        this.cardNumber = cardNumber;
      }
    }
    
    // Set expiry date to 3 years from now
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 3);
    this.expiryDate = expiry;
    
    // Generate CVV (3 digits)
    this.cvv = CardGenerator.generateCVV();
    
    // Generate PIN (4 digits) if not provided
    if (!this.pin) {
      this.pin = CardGenerator.generatePIN();
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to add a transaction
CardSchema.methods.addTransaction = async function (
  transactionData: Omit<ICardTransaction, 'reference' | 'date'>
) {
  const reference = generateBankReference();
  
  this.transactions.push({
    ...transactionData,
    reference,
    date: new Date(),
  });
  
  // Update spend tracking
  if (transactionData.status === 'completed') {
    this.currentSpend.daily += transactionData.amount;
    this.currentSpend.monthly += transactionData.amount;
    this.lastUsed = new Date();
  }
  
  await this.save();
  return this;
};



// Static method to reset daily spend
CardSchema.statics.resetDailySpend = async function () {
  await this.updateMany(
    {},
    { $set: { 'currentSpend.daily': 0 } }
  );
};

// Static method to reset monthly spend
CardSchema.statics.resetMonthlySpend = async function () {
  await this.updateMany(
    {},
    { $set: { 'currentSpend.monthly': 0 } }
  );
};

export async function getCardModel(): Promise<ICardModel> {
  await dbConnect();
  return (mongoose.models.Card || mongoose.model<ICard, ICardModel>('Card', CardSchema)) as ICardModel;
}