// ~/utils/validation.ts
import { z } from 'zod';

export const transferSchema = z.object({
  fromUserId: z.string().min(1, 'User ID is required'),
  toAccountNumber: z.string().min(8, 'Account number must be at least 8 characters'),
  amount: z.number().positive('Amount must be positive').max(1000000, 'Amount too large'),
  description: z.string().min(1, 'Description is required').max(200, 'Description too long').optional(),
  pin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d{4}$/, 'PIN must be numeric'),
  transferType: z.enum(['domestic', 'international'], { error: 'Transfer type is required' }),
  country: z.string().min(1, 'Country is required'),
  currency: z.string().min(1, 'Currency is required'),
  bankName: z.string().min(1, 'Bank name is required').optional(),
  recipientName: z.string().min(1, 'Recipient name is required'),
  bankAddress: z.string().min(1, 'Bank address is required').optional(),
  accountType: z.string().min(1, 'Account type is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  routingNumber: z.string().min(1, 'Routing number is required').optional(),
  sortCode: z.string().min(1, 'Sort code is required').optional(),
  iban: z.string().min(1, 'IBAN is required').optional(),
  swiftCode: z.string().min(1, 'SWIFT code is required').optional(),
});

export const withdrawalSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Amount must be positive').max(10000, 'Daily limit exceeded'),
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  pin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d{4}$/, 'PIN must be numeric'),
});
export const paypalSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Amount must be positive').max(10000, 'Daily limit exceeded'),
  description: z.string().min(1, 'Description is required').max(200, 'Description too long').nullable(),
  pin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d{4}$/, 'PIN must be numeric'),
  email: z.string().email('Invalid email address'),
  name: z.string().nullable(),
});

export const depositSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Amount must be positive').max(100000, 'Amount too large'),
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  source: z.string().optional(),
});

export function validateTransfer(data: unknown) {
  return transferSchema.safeParse(data);
}

export function validateWithdrawal(data: unknown) {
  return withdrawalSchema.safeParse(data);
}
export function validatePaypal(data: unknown) {
  return paypalSchema.safeParse(data);
}

export function validateDeposit(data: unknown) {
  return depositSchema.safeParse(data);
}