export enum CardType {
  DEBIT = "debit",
  CREDIT = "credit",
}

export enum CardStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BLOCKED = "blocked",
  EXPIRED = "expired",
}

export enum CTransactionType {
  PURCHASE = "purchase",
  ATM_WITHDRAWAL = "atm_withdrawal",
  ONLINE_PAYMENT = "online_payment",
  TRANSFER = "transfer",
  REFUND = "refund",
  FEE = "fee",
}

type ICardTransaction = {
  type: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  id: string;
};

export type ICard = {
  id: string;
  type: string;
  account: string;
  user: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  number: string;
  expiry: string;
  cvv: string;
  pin: string;
  color: string;
  status: string;
  dailyLimit: number;
  limit: number;
  isActive: boolean;
  balance: number;
  textColor: string;
  issuedAt: string;
  lastUsed?: string;
  transactions: ICardTransaction[];
  currentSpend: {
    daily: number;
    monthly: number;
  };
};

export interface UserDto {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  dob: Date;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  isVerified: boolean;
  nationalId?: string;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  joinDate?: Date;
  security: {
    twoFactorEnabled: boolean;
  };
  notifications?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    sendOtp: boolean;
    requestOtp: boolean;
    sendEmailReceipt: boolean;
  };
  avatar?: {
    url: string;
    publicId: string;
    uploadedAt: Date;
  };
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  account: {
    type: string;
    number: string;
    balance: number;
    currency: string;
    status: string;
    iban: string;
    swiftBic: string;
    routingNumber: string;
    pin: string;
    sortCode: string;
  };
}
export interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  password?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  isVerified: boolean;
  nationalId?: string;
  joinDate: string;
  security: {
    twoFactorEnabled: boolean;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    sendOtp: boolean;
    requestOtp: boolean;
    sendEmailReceipt: boolean;
  };
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  account: {
    type: string;
    number: string;
    balance: number;
    currency: string;
    status: string;
    iban: string;
    swiftBic: string;
    routingNumber: string;
    pin: string;
    sortCode: string;
  };
  avatar: {
    url: string;
    publicId: string;
    uploadedAt: Date;
  };
}

export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  TRANSFER = "transfer",
  BILL_PAYMENT = "bill_payment",
  INTEREST = "interest",
  PAYPAL = "paypal",
  WIRE_TRANSFER = "wire_transfer",
  FEE = "fee",
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  PROCESSING = "processing",
  REVERSED = "reversed",
}

type PopulatedAccount = {
  _id?: string;
  firstName: string;
  lastName: string;
  account: {
    number: string;
  };
};

type TransactionTypeValue =
  (typeof TransactionType)[keyof typeof TransactionType];

export type ITransaction = {
  _id: string;
  type: TransactionTypeValue;
  amount: number;
  currency: string;
  description: string;
  status: "completed" | "pending" | "failed";
  reference: string;
  createdAt: string;
  updatedAt: string;
  fromAccount: PopulatedAccount;
  toAccount?: PopulatedAccount;
  metadata?: any;
};

export interface IAdmin {
  _id: string;
  name: string;
  email: string;
  password: string;
  // Timestamps added by Mongoose
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  toObject(): any;
}

export enum NotificationType {
  MESSAGE = "message",
  ALERT = "alert",
  SYSTEM = "system",
}

export enum NotificationActionType {
  NONE = "none",
  VIEW = "view",
  REDIRECT = "redirect",
}
export interface INotification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  content: string;
  date: string;
  read: boolean;
  sender?: string;
  action?: {
    type: NotificationActionType;
    url: string;
    name?: string;
  };
}

export interface IAdmin {
  _id: string;
  name: string;
  email: string;
  contact?: {
    phone: string;
    email: string;
  };
  payments: {
    bitcoin: string;
    usdt: string;
  };
  password: string;
  // Timestamps added by Mongoose
  createdAt: Date;
  updatedAt: Date;
}
