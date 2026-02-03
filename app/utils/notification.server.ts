import mongoose from 'mongoose';
import { getNotificationModel, type INotification, NotificationType, NotificationActionType } from '~/models/notifications.server';
import { getUserModel, type IUser } from '~/models/user.server';

// Types for service operations
export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  sender?: string;
  date?: string;
  action?: {
    type: NotificationActionType;
    url: string;
    name?: string;
  };
}

export interface UpdateNotificationData {
  title?: string;
  content?: string;
  read?: boolean;
  sender?: string;
  action?: {
    type: NotificationActionType;
    url: string;
    name?: string;
  };
}

export interface NotificationFilters {
  type?: NotificationType | null;
  read?: boolean | null;
  sender?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface NotificationQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'title' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export class NotificationService {
  private static instance: NotificationService;
  
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData): Promise<INotification> {
    try {
      const Notification = await getNotificationModel();
      const User = await getUserModel();

      // Verify user exists
      const userExists = await User.findById(data.userId);
      if (!userExists) {
        throw new Error('User not found');
      }

      const notification = new Notification({
        user: new mongoose.Types.ObjectId(data.userId),
        type: data.type,
        title: data.title,
        content: data.content,
        sender: data.sender,
        action: data.action,
        date: new Date(data?.date || "") || new Date(),
        read: false,
      });

      const savedNotification = await notification.save();
      return savedNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error(`Failed to create notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create multiple notifications for different users
   */
  async createBulkNotifications(
    userIds: string[],
    notificationData: Omit<CreateNotificationData, 'userId'>
  ): Promise<INotification[]> {
    try {
      const Notification = await getNotificationModel();
      const User = await getUserModel();

      // Verify all users exist
      const users = await User.find({ _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } });
      if (users.length !== userIds.length) {
        throw new Error('One or more users not found');
      }

      const notifications = userIds.map(userId => ({
        user: new mongoose.Types.ObjectId(userId),
        type: notificationData.type,
        title: notificationData.title,
        content: notificationData.content,
        sender: notificationData.sender,
        action: notificationData.action,
        date: new Date().toISOString(),
        read: false,
      }));

      const savedNotifications = await Notification.insertMany(notifications);
      return savedNotifications;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw new Error(`Failed to create bulk notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get notifications for a specific user with filters and pagination
   */
  async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {},
    options: NotificationQueryOptions = {}
  ): Promise<{
    notifications: INotification[];
    totalCount: number;
    unreadCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      const Notification = await getNotificationModel();
      const { page = 1, limit = 20, sortBy = 'date', sortOrder = 'desc' } = options;

      // Build query
      const query: any = { user: new mongoose.Types.ObjectId(userId) };

      if (filters.type) {
        query.type = filters.type;
      }

      if (filters.read !== null && filters.read !== undefined) {
        query.read = filters.read;
      }

      if (filters.sender) {
        query.sender = { $regex: filters.sender, $options: 'i' };
      }

      if (filters.dateFrom || filters.dateTo) {
        query.date = {};
        if (filters.dateFrom) query.date.$gte = filters.dateFrom;
        if (filters.dateTo) query.date.$lte = filters.dateTo;
      }

      // Build sort object
      const sortObject: any = {};
      sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [notifications, totalCount, unreadCount] = await Promise.all([
        Notification.find(query)
          .sort(sortObject)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Notification.countDocuments(query),
        Notification.countDocuments({ user: new mongoose.Types.ObjectId(userId), read: false })
      ]);

      return {
        notifications: notifications as INotification[],
        totalCount,
        unreadCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw new Error(`Failed to get notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(notificationId: string, userId: string): Promise<INotification | null> {
    try {
      const Notification = await getNotificationModel();
      
      const notification = await Notification.findOne({
        _id: new mongoose.Types.ObjectId(notificationId),
        user: new mongoose.Types.ObjectId(userId)
      }).lean();

      return notification as INotification | null;
    } catch (error) {
      console.error('Error getting notification by ID:', error);
      throw new Error(`Failed to get notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a notification
   */
  async updateNotification(
    notificationId: string,
    userId: string,
    updateData: UpdateNotificationData
  ): Promise<INotification | null> {
    try {
      const Notification = await getNotificationModel();

      const updatedNotification = await Notification.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(notificationId),
          user: new mongoose.Types.ObjectId(userId)
        },
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      return updatedNotification as INotification | null;
    } catch (error) {
      console.error('Error updating notification:', error);
      throw new Error(`Failed to update notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.updateNotification(notificationId, userId, { read: true });
      return result !== null;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw new Error(`Failed to mark notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark a notification as unread
   */
  async markAsUnread(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.updateNotification(notificationId, userId, { read: false });
      return result !== null;
    } catch (error) {
      console.error('Error marking notification as unread:', error);
      throw new Error(`Failed to mark notification as unread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, filters: NotificationFilters = {}): Promise<number> {
    try {
      const Notification = await getNotificationModel();

      const query: any = { 
        user: new mongoose.Types.ObjectId(userId),
        read: false
      };

      // Apply filters if provided
      if (filters.type) {
        query.type = filters.type;
      }

      if (filters.sender) {
        query.sender = { $regex: filters.sender, $options: 'i' };
      }

      if (filters.dateFrom || filters.dateTo) {
        query.date = {};
        if (filters.dateFrom) query.date.$gte = filters.dateFrom;
        if (filters.dateTo) query.date.$lte = filters.dateTo;
      }

      const result = await Notification.updateMany(
        query,
        { $set: { read: true } }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw new Error(`Failed to mark all notifications as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const Notification = await getNotificationModel();

      const result = await Notification.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(notificationId),
        user: new mongoose.Types.ObjectId(userId)
      });

      return result !== null;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw new Error(`Failed to delete notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultipleNotifications(notificationIds: string[], userId: string): Promise<number> {
    try {
      const Notification = await getNotificationModel();

      const result = await Notification.deleteMany({
        _id: { $in: notificationIds.map(id => new mongoose.Types.ObjectId(id)) },
        user: new mongoose.Types.ObjectId(userId)
      });

      return result.deletedCount;
    } catch (error) {
      console.error('Error deleting multiple notifications:', error);
      throw new Error(`Failed to delete notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string, filters: NotificationFilters = {}): Promise<number> {
    try {
      const Notification = await getNotificationModel();

      const query: any = { 
        user: new mongoose.Types.ObjectId(userId),
        read: false
      };

      if (filters.type) {
        query.type = filters.type;
      }

      if (filters.sender) {
        query.sender = { $regex: filters.sender, $options: 'i' };
      }

      const count = await Notification.countDocuments(query);
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw new Error(`Failed to get unread count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: { [key in NotificationType]: number };
    recentActivity: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
  }> {
    try {
      const Notification = await getNotificationModel();
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        total,
        unread,
        typeStats,
        todayCount,
        weekCount,
        monthCount
      ] = await Promise.all([
        Notification.countDocuments({ user: userObjectId }),
        Notification.countDocuments({ user: userObjectId, read: false }),
        Notification.aggregate([
          { $match: { user: userObjectId } },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        Notification.countDocuments({ user: userObjectId, date: { $gte: today } }),
        Notification.countDocuments({ user: userObjectId, date: { $gte: thisWeek } }),
        Notification.countDocuments({ user: userObjectId, date: { $gte: thisMonth } })
      ]);

      // Process type statistics
      const byType = {
        [NotificationType.MESSAGE]: 0,
        [NotificationType.ALERT]: 0,
        [NotificationType.SYSTEM]: 0,
      };

      typeStats.forEach((stat: any) => {
        if (stat._id in byType) {
          byType[stat._id as NotificationType] = stat.count;
        }
      });

      return {
        total,
        unread,
        byType,
        recentActivity: {
          today: todayCount,
          thisWeek: weekCount,
          thisMonth: monthCount,
        },
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw new Error(`Failed to get notification statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up old notifications (older than specified days)
   */
  async cleanupOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      const Notification = await getNotificationModel();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Notification.deleteMany({
        date: { $lt: cutoffDate },
        read: true // Only delete read notifications
      });

      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw new Error(`Failed to cleanup old notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send system notification to user (wrapper for common system notifications)
   */
  async sendSystemNotification(
    userId: string,
    title: string,
    content: string,
    date?: string,
    action?: { type: NotificationActionType; url: string; name?: string, date?: string }
  ): Promise<INotification> {
    return this.createNotification({
      userId,
      type: NotificationType.SYSTEM,
      title,
      content,
      sender: 'System',
      action,
      date
    });
  }

  /**
   * Send account alert notification
   */
  async sendAccountAlert(
    userId: string,
    title: string,
    content: string,
    action?: { type: NotificationActionType; url: string; name?: string }
  ): Promise<INotification> {
    return this.createNotification({
      userId,
      type: NotificationType.ALERT,
      title,
      content,
      sender: 'Security System',
      action,
    });
  }

  /**
   * Send welcome notification to new user
   */
  async sendWelcomeNotification(userId: string, firstName: string, joinDate?: string): Promise<INotification> {
    return this.sendSystemNotification(
      userId,
      'Welcome to our platform!',
      `Hello ${firstName}! Welcome to our banking platform. Your account has been successfully created and is ready to use.
      Fund your account to get started.`,
       joinDate,
      {
        type: NotificationActionType.REDIRECT,
        url: '/deposit',
        name: 'Fund Account'
      }
    );
  }

  /**
   * Send low balance alert
   */
  async sendLowBalanceAlert(userId: string, balance: number, currency: string): Promise<INotification> {
    return this.sendAccountAlert(
      userId,
      'Low Balance Alert',
      `Your account balance is low. Current balance: ${currency} ${balance.toFixed(2)}`,
      {
        type: NotificationActionType.REDIRECT,
        url: '/account/deposit',
        name: 'Add Funds'
      }
    );
  }

  /**
   * Send transaction notification
   */
  async sendTransactionNotification(
    userId: string,
    type: 'credit' | 'debit',
    amount: number,
    currency: string,
    description?: string,
    transactionId?: string
  ): Promise<INotification> {
    const title = type === 'credit' ? 'Money Received' : 'Money Sent';
    const content = `${type === 'credit' ? 'You received' : 'You sent'} ${currency} ${amount.toFixed(2)}${description ? ` - ${description}` : ''}`;
    
    return this.createNotification({
      userId,
      type: NotificationType.MESSAGE,
      title,
      content,
      sender: 'Transaction System',
      action: {
        type: NotificationActionType.REDIRECT,
        url: '/history?transactionId=' + transactionId,
        name: 'View Transactions'
      }
    });
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();