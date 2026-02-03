// ~/models/transaction.server.ts
import mongoose, { Document, Schema } from 'mongoose';
import { generateBankReference } from '~/utils/banknumber';
import dbConnect from '~/utils/db.server';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  BILL_PAYMENT = 'bill_payment',
  INTEREST = 'interest',
  PAYPAL = 'paypal',
  WIRE_TRANSFER = 'wire_transfer',
  FEE = 'fee',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PROCESSING = 'processing',
  REVERSED = 'reversed',
}

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  reference: string;
  type: TransactionType;
  amount: number;
  currency: string;
  fromAccount: mongoose.Types.ObjectId;
  toAccount?: mongoose.Types.ObjectId;
  description: string;
  status: TransactionStatus;
  metadata?: any;
  initiatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    reference: { 
      type: String, 
      required: true, 
      unique: true 
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'USD' },
    fromAccount: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toAccount: { type: Schema.Types.ObjectId, ref: 'User' },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  // { timestamps: true }
);

// Generate transaction reference before saving
TransactionSchema.pre<ITransaction>('save', function (next) {
  if (!this.isNew || this.reference) return next();
  
  // Generate a unique transaction reference
  this.reference = generateBankReference();
  next();
});

export async function getTransactionModel() {
  await dbConnect();
  return mongoose.model<ITransaction>('Transaction', TransactionSchema);
}