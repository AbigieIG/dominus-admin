import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import dbConnect from '~/utils/db.server';

// Document interface (for instances)
export interface IAdmin extends Document {
 _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  contact?: {
    phone: string;
    email: string;
  }
  payments: {
    bitcoin: string;
    usdt: string;
  }
  password: string;
  // Timestamps added by Mongoose
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  toObject(): any;
}

// Model interface (for statics)
interface IAdminModel extends mongoose.Model<IAdmin> {
  findByEmail(email: string): Promise<IAdmin | null>;
}

const AdminSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    contact: {
      phone: {
        type: String,
      },
      email: {
        type: String,
      },
    },
    payments: {
      bitcoin: {
        type: String,
      },
      usdt: {
        type: String,
      },
    },
  },
  { timestamps: true }
);

// Remove password from JSON output
AdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Pre-save hook to hash password
AdminSchema.pre<IAdmin>('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare password
AdminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to find admin by email
AdminSchema.statics.findByEmail = async function (email: string): Promise<IAdmin | null> {
  return this.findOne({ email: email.toLowerCase() });
};

export async function getAdminModel(): Promise<IAdminModel> {
  await dbConnect();
  return (mongoose.models.Admin || mongoose.model<IAdmin, IAdminModel>('Admin', AdminSchema)) as IAdminModel;
}