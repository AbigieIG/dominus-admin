/* eslint-disable @typescript-eslint/no-explicit-any */
// ~/services/otp.service.ts
import mongoose, { Document } from 'mongoose';
import crypto from 'crypto';

export interface OTPSession extends Document {

  userId: string;
  transactionData: any;
  otpCode: string;
  otpExpiry: Date;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  sessionToken: string;
  createdAt: Date;
}

const OTPSessionSchema: mongoose.Schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transactionData: { type: mongoose.Schema.Types.Mixed, required: true },
  otpCode: { type: String, required: true },
  otpExpiry: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  verified: { type: Boolean, default: false },
  sessionToken: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

// Auto-delete expired sessions
OTPSessionSchema.index({ otpExpiry: 1 }, { expireAfterSeconds: 0 });

export async function getOTPSessionModel(): Promise<mongoose.Model<OTPSession>> {
  if (mongoose.models.OTPSession) {
    return mongoose.models.OTPSession;
  }
  return mongoose.model<OTPSession>('OTPSession', OTPSessionSchema);
}

class OTPService {
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async createOTPSession(userId: string, transactionData: any): Promise<{
    success: boolean;
    sessionToken?: string;
    otpCode?: string;
    expiryTime?: Date;
    message: string;
  }> {
    try {
      const OTPSession = await getOTPSessionModel();

      // Clean up any existing sessions for this user
      await OTPSession.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });

      const otpCode = this.generateOTP();
      const sessionToken = this.generateSessionToken();
      const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const session = new OTPSession({
        userId: new mongoose.Types.ObjectId(userId),
        transactionData,
        otpCode,
        otpExpiry: expiryTime,
        sessionToken,
      });

      await session.save();

      return {
        success: true,
        sessionToken,
        otpCode, // In production, don't return this - send via SMS/email
        expiryTime,
        message: 'OTP generated successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create OTP session',
      };
    }
  }

  async verifyOTP(sessionToken: string, otpCode: string): Promise<{
    success: boolean;
    transactionData?: any;
    userId?: string;
    message: string;
    remainingAttempts?: number;
  }> {
    try {
      const OTPSession = await getOTPSessionModel();

      const session = await OTPSession.findOne({ 
        sessionToken,
        verified: false,
        otpExpiry: { $gt: new Date() }
      });

      if (!session) {
        return {
          success: false,
          message: 'Invalid or expired OTP session',
        };
      }

      // Check max attempts
      if (session.attempts >= session.maxAttempts) {
        await OTPSession.deleteOne({ sessionToken });
        return {
          success: false,
          message: 'Maximum OTP attempts exceeded',
        };
      }

      // Increment attempts
      session.attempts += 1;
      await session.save();

      // Verify OTP
      if (session.otpCode !== otpCode) {
        const remainingAttempts = session.maxAttempts - session.attempts;
        return {
          success: false,
          message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
          remainingAttempts,
        };
      }

      // OTP is correct - mark as verified
      session.verified = true;
      await session.save();

      return {
        success: true,
        transactionData: session.transactionData,
        userId: session.userId.toString(),
        message: 'OTP verified successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to verify OTP',
      };
    }
  }

  async resendOTP(sessionToken: string): Promise<{
    success: boolean;
    otpCode?: string;
    expiryTime?: Date;
    message: string;
  }> {
    try {
      const OTPSession = await getOTPSessionModel();

      const session = await OTPSession.findOne({ 
        sessionToken,
        verified: false 
      });

      if (!session) {
        return {
          success: false,
          message: 'Invalid OTP session',
        };
      }

      // Generate new OTP and extend expiry
      const newOtpCode = this.generateOTP();
      const newExpiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      session.otpCode = newOtpCode;
      session.otpExpiry = newExpiryTime;
      session.attempts = 0; // Reset attempts
      await session.save();

      return {
        success: true,
        otpCode: newOtpCode, // In production, don't return this
        expiryTime: newExpiryTime,
        message: 'New OTP generated successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to resend OTP',
      };
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const OTPSession = await getOTPSessionModel();
      await OTPSession.deleteMany({ 
        otpExpiry: { $lt: new Date() }
      });
    } catch (error) {
      console.error('Failed to cleanup expired OTP sessions:', error);
    }
  }

  // Admin method to get OTP for a user (for SMS/email sending)
  async getOTPForAdmin(sessionToken: string): Promise<{
    success: boolean;
    otpCode?: string;
    userId?: string;
    userPhone?: string;
    userEmail?: string;
    message: string;
  }> {
    try {
      const OTPSession = await getOTPSessionModel();
    //   const { getUserModel } = await import('~/models/user.server');
    //   const User = await getUserModel();

      const session = await OTPSession.findOne({ 
        sessionToken,
        verified: false,
        otpExpiry: { $gt: new Date() }
      }).populate('userId', 'email phone firstName lastName');

      if (!session || !session.userId) {
        return {
          success: false,
          message: 'Invalid OTP session',
        };
      }

      const user = session.userId as any;

      return {
        success: true,
        otpCode: session.otpCode,
        userId: user._id.toString(),
        userPhone: user.phone,
        userEmail: user.email,
        message: 'OTP retrieved for admin',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to get OTP for admin',
      };
    }
  }
}

export const otpService = new OTPService();