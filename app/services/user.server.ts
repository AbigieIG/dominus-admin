import { getUserModel, type IUser } from '~/models/user.server';


export interface AdminUserFilters {
  email?: string;
  isVerified?: boolean;
  accountStatus?: string;
  accountType?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
  country?: string;
  hasNationalId?: boolean;
  twoFactorEnabled?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class AdminUserManagementService {
  
  // Get all users with filters and pagination
  static async getAllUsers(
    filters: AdminUserFilters = {}, 
    pagination: PaginationOptions = {}
  ) {
    try {
      const User = await getUserModel();
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      
      // Build query
      const query: any = {};
      
      if (filters.email) {
        query.email = { $regex: filters.email, $options: 'i' };
      }
      
      if (filters.isVerified !== undefined) {
        query.isVerified = filters.isVerified;
      }
      
      if (filters.accountStatus) {
        query['account.status'] = filters.accountStatus;
      }
      
      if (filters.accountType) {
        query['account.type'] = filters.accountType;
      }
      
      if (filters.createdAfter || filters.createdBefore) {
        query.createdAt = {};
        if (filters.createdAfter) query.createdAt.$gte = filters.createdAfter;
        if (filters.createdBefore) query.createdAt.$lte = filters.createdBefore;
      }
      
      if (filters.lastLoginAfter || filters.lastLoginBefore) {
        query.lastLogin = {};
        if (filters.lastLoginAfter) query.lastLogin.$gte = filters.lastLoginAfter;
        if (filters.lastLoginBefore) query.lastLogin.$lte = filters.lastLoginBefore;
      }
      
      if (filters.country) {
        query['address.country'] = filters.country;
      }
      
      if (filters.hasNationalId !== undefined) {
        query.nationalId = filters.hasNationalId ? { $exists: true, $ne: null } : { $exists: false };
      }
      
      if (filters.twoFactorEnabled !== undefined) {
        query['security.twoFactorEnabled'] = filters.twoFactorEnabled;
      }

      const skip = (page - 1) * limit;
      const sortObj: any = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -verificationToken -passwordResetToken')
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(query)
      ]);

      return {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error}`);
    }
  }

  // Get user by ID with full details
  static async getUserById(userId: string) {
    try {
      const User = await getUserModel();
      const user = await User.findById(userId)
        .select('-verificationToken -passwordResetToken')
        .lean();
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      throw new Error(`Failed to fetch user: ${error}`);
    }
  }

  // Update user details
  static async updateUser(userId: string, updates: Partial<IUser>) {
    try {
      const User = await getUserModel();
      
      // Remove sensitive fields that shouldn't be updated directly
      const { password, verificationToken, passwordResetToken, ...safeUpdates } = updates;
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: safeUpdates },
        { new: true, runValidators: true }
      ).select('-password -verificationToken -passwordResetToken -account');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      throw new Error(`Failed to update user: ${error}`);
    }
  }

  // delete user (hard delete)
  static async deleteUser(userId: string) {
    try {
      const User = await getUserModel();
      const user = await User.findByIdAndDelete(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return { message: 'User successfully deleted', success: true };
    } catch (error) {
      throw new Error(`Failed to delete user: ${error}`);
    }
  }
  // Verify user account
  static async verifyUser(userId: string) {
    try {
      const User = await getUserModel();
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { isVerified: true }, $unset: { verificationToken: 1 } },
        { new: true }
      ).select('-password -verificationToken -passwordResetToken');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      throw new Error(`Failed to verify user: ${error}`);
    }
  }

  // Delete user (soft delete by deactivating account)
  static async deactivateUser(userId: string, reason?: string) {
    try {
      const User = await getUserModel();
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          $set: { 
            'account.status': 'closed',
            deactivatedAt: new Date(),
            deactivationReason: reason || 'Admin action'
          }
        },
        { new: true }
      ).select('-password -verificationToken -passwordResetToken');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      throw new Error(`Failed to deactivate user: ${error}`);
    }
  }

  // Get user statistics
  static async getUserStats() {
    try {
      const User = await getUserModel();
      
      const stats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            verifiedUsers: {
              $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
            },
            unverifiedUsers: {
              $sum: { $cond: [{ $eq: ['$isVerified', false] }, 1, 0] }
            },
            activeAccounts: {
              $sum: { $cond: [{ $eq: ['$account.status', 'active'] }, 1, 0] }
            },
            frozenAccounts: {
              $sum: { $cond: [{ $eq: ['$account.status', 'frozen'] }, 1, 0] }
            },
            closedAccounts: {
              $sum: { $cond: [{ $eq: ['$account.status', 'closed'] }, 1, 0] }
            },
            twoFactorEnabled: {
              $sum: { $cond: [{ $eq: ['$security.twoFactorEnabled', true] }, 1, 0] }
            }
          }
        }
      ]);

      const accountTypeStats = await User.aggregate([
        {
          $group: {
            _id: '$account.type',
            count: { $sum: 1 }
          }
        }
      ]);

      const currencyStats = await User.aggregate([
        {
          $group: {
            _id: '$account.currency',
            count: { $sum: 1 },
            totalBalance: { $sum: '$account.balance' }
          }
        }
      ]);

      return {
        overview: stats[0] || {},
        accountTypes: accountTypeStats,
        currencies: currencyStats
      };
    } catch (error) {
      throw new Error(`Failed to fetch user statistics: ${error}`);
    }
  }
}

// ~/services/admin/accountManagement.service.ts
export interface AccountFilters {
  accountType?: string;
  status?: string;
  currency?: string;
  minBalance?: number;
  maxBalance?: number;
  country?: string;
}

export class AdminAccountManagementService {
  
  // Freeze account
  static async freezeAccount(userId: string, reason?: string) {
    try {
      const User = await getUserModel();
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          $set: { 
            'account.status': 'frozen',
            freezeReason: reason || 'Admin action',
            frozenAt: new Date()
          }
        },
        { new: true }
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      throw new Error(`Failed to freeze account: ${error}`);
    }
  }

  // Unfreeze account
  static async unfreezeAccount(userId: string) {
    try {
      const User = await getUserModel();
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          $set: { 'account.status': 'active' },
          $unset: { freezeReason: 1, frozenAt: 1 }
        },
        { new: true }
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      throw new Error(`Failed to unfreeze account: ${error}`);
    }
  }

  // Adjust account balance
  static async adjustBalance(userId: string, amount: number, reason: string) {
    try {
      const User = await getUserModel();
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const newBalance = user.account.balance + amount;
      
      if (newBalance < 0) {
        throw new Error('Insufficient balance for this adjustment');
      }

      user.account.balance = newBalance;
      await user.save();

      // Log the balance adjustment (you might want to create a separate audit log)
      console.log(`Balance adjusted for user ${userId}: ${amount > 0 ? '+' : ''}${amount}. Reason: ${reason}`);
      
      return user;
    } catch (error) {
      throw new Error(`Failed to adjust balance: ${error}`);
    }
  }

  // Get accounts with filters
  static async getAccounts(filters: AccountFilters = {}, pagination: PaginationOptions = {}) {
    try {
      const User = await getUserModel();
      const { page = 1, limit = 20, sortBy = 'account.balance', sortOrder = 'desc' } = pagination;
      
      const query: any = {};
      
      if (filters.accountType) {
        query['account.type'] = filters.accountType;
      }
      
      if (filters.status) {
        query['account.status'] = filters.status;
      }
      
      if (filters.currency) {
        query['account.currency'] = filters.currency;
      }
      
      if (filters.minBalance !== undefined || filters.maxBalance !== undefined) {
        query['account.balance'] = {};
        if (filters.minBalance !== undefined) query['account.balance'].$gte = filters.minBalance;
        if (filters.maxBalance !== undefined) query['account.balance'].$lte = filters.maxBalance;
      }
      
      if (filters.country) {
        query['address.country'] = filters.country;
      }

      const skip = (page - 1) * limit;
      const sortObj: any = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [accounts, total] = await Promise.all([
        User.find(query)
          .select('firstName lastName email account address.country createdAt lastLogin')
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(query)
      ]);

      return {
        accounts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch accounts: ${error}`);
    }
  }

  // Get account balance summary
  static async getBalanceSummary() {
    try {
      const User = await getUserModel();
      
      const summary = await User.aggregate([
        {
          $group: {
            _id: '$account.currency',
            totalBalance: { $sum: '$account.balance' },
            averageBalance: { $avg: '$account.balance' },
            accountCount: { $sum: 1 },
            maxBalance: { $max: '$account.balance' },
            minBalance: { $min: '$account.balance' }
          }
        },
        {
          $sort: { totalBalance: -1 }
        }
      ]);

      return summary;
    } catch (error) {
      throw new Error(`Failed to fetch balance summary: ${error}`);
    }
  }
}

// ~/services/admin/security.service.ts
export interface SecurityFilters {
  twoFactorEnabled?: boolean;
  recentLogin?: boolean; // Last 30 days
  suspiciousActivity?: boolean;
}

export class AdminSecurityService {
  
  // Get security overview
  static async getSecurityOverview() {
    try {
      const User = await getUserModel();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const overview = await User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            twoFactorEnabled: {
              $sum: { $cond: [{ $eq: ['$security.twoFactorEnabled', true] }, 1, 0] }
            },
            recentLogins: {
              $sum: { $cond: [{ $gte: ['$lastLogin', thirtyDaysAgo] }, 1, 0] }
            },
            verifiedUsers: {
              $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
            },
            frozenAccounts: {
              $sum: { $cond: [{ $eq: ['$account.status', 'frozen'] }, 1, 0] }
            }
          }
        }
      ]);

      return overview[0] || {};
    } catch (error) {
      throw new Error(`Failed to fetch security overview: ${error}`);
    }
  }

  // Force enable 2FA for user
  static async enable2FA(userId: string) {
    try {
      const User = await getUserModel();
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { 'security.twoFactorEnabled': true } },
        { new: true }
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      throw new Error(`Failed to enable 2FA: ${error}`);
    }
  }

  // Reset user password (generates new temp password)
  static async resetUserPassword(userId: string) {
    try {
      const User = await getUserModel();
      const tempPassword = Math.random().toString(36).slice(-8);
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      user.password = tempPassword;
      await user.save();
      
      // In production, you'd send this via secure channel
      return {
        userId,
        tempPassword,
        message: 'Temporary password generated. User should change it on next login.'
      };
    } catch (error) {
      throw new Error(`Failed to reset password: ${error}`);
    }
  }

  // Get users with security issues
  static async getSecurityAlerts() {
    try {
      const User = await getUserModel();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const alerts = await User.find({
        $or: [
          { 'security.twoFactorEnabled': false },
          { lastLogin: { $lt: thirtyDaysAgo } },
          { isVerified: false },
          { 'account.status': 'frozen' }
        ]
      })
      .select('firstName lastName email security.twoFactorEnabled lastLogin isVerified account.status')
      .lean();

      return alerts;
    } catch (error) {
      throw new Error(`Failed to fetch security alerts: ${error}`);
    }
  }
}

// ~/services/admin/analytics.service.ts


// ~/services/admin/audit.service.ts
export interface AuditLog {
  adminId: string;
  action: string;
  targetUserId?: string;
  targetUserEmail?: string;
  details: any;
  timestamp: Date;
  ipAddress?: string;
}

