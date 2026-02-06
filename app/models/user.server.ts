import mongoose, { Document, Schema } from "mongoose";
import dbConnect from "~/utils/db.server";
import {
  generateUniqueRoutingNumber,
  generateUniqueAccountNumber,
  generateUniqueSwiftBic,
  generateUniqueIBAN,
  generateUniqueSortCode,
  generateUniquePin,
} from "~/utils/banknumber";
import currencyOptions from '~/assets/currency.json'; 

export interface IUser extends Document {
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
  isSuspended: boolean;
  nationalId?: string;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  joinDate?: Date;
  security: {
    twoFactorEnabled: boolean;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    requestOtp: boolean;
    sendOtp: boolean;
    sendEmailReceipt: boolean;
  };
  avatar: {
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
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    dob: { type: Date, required: true },
    joinDate: { type: Date, required: true, default: Date.now },
    security: {
      twoFactorEnabled: { type: Boolean, required: true, default: false },
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    notifications: {
      email: { type: Boolean, required: true, default: true },
      sms: { type: Boolean, required: true, default: false },
      push: { type: Boolean, required: true, default: true },
      requestOtp: { type: Boolean, default: true },
      sendOtp: { type: Boolean, default: false },
      sendEmailReceipt: { type: Boolean, default: true },
    },
    avatar: {
      url: { type: String },
      publicId: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    },
    account: {
      type: {
        type: String,
        required: true,
        enum: ["checking", "savings", "business", "student"],
        default: "savings",
      },
      number: {
        type: String,
        unique: true,
        required: true,
        // Add sparse index to handle uniqueness properly
        sparse: true,
      },
      routingNumber: {
        type: String,
        unique: true,
        required: true,
        sparse: true,
      },
      swiftBic: {
        type: String,
        unique: true,
        required: true,
        sparse: true,
      },
      iban: {
        type: String,
        unique: true,
        required: true,
        sparse: true,
      },
      balance: {
        type: Number,
        required: true,
        default: 0,
      },
      currency: {
        type: String,
        default: "USD",
        required: true,
        enum: [...currencyOptions.map(c => c.value)],
      },
      status: {
        type: String,
        enum: ["active", "dormant", "frozen", "closed"],
        required: true,
        default: "active",
      },
      pin: { type: String, required: true },
      sortCode: { type: String, required: true },
    },
    nationalId: { type: String, unique: true, sparse: true },
    isVerified: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    verificationToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

UserSchema.pre<IUser>("save", async function (next) {
  try {
    if (!this.account.number) {
      this.account.number = generateUniqueAccountNumber({
        length: 10,
        prefix: "475",
      });
    }

    if (!this.account.routingNumber) {
      this.account.routingNumber = generateUniqueRoutingNumber();
    }

    if (!this.account.swiftBic) {
      this.account.swiftBic = generateUniqueSwiftBic();
    }

    if (!this.account.iban) {
      this.account.iban = generateUniqueIBAN(
        this.account.swiftBic,
        this.account.number,
        this.address.country
      );
    }

    if (!this.account.pin) {
      this.account.pin = generateUniquePin();
    }

    if (!this.account.sortCode) {
      this.account.sortCode = generateUniqueSortCode();
    }

    next();
  } catch (error: any) {
    console.error("Pre-save hook error:", error);
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return candidatePassword === this.password;
};

// Prevent model overwrite in dev hot-reload
let User: mongoose.Model<IUser>;
try {
  User = mongoose.model<IUser>("User");
} catch {
  User = mongoose.model<IUser>("User", UserSchema);
}

export async function getUserModel() {
  await dbConnect();
  return User;
}
