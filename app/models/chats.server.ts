import mongoose, { Document, Schema } from 'mongoose';
import dbConnect from '~/utils/db.server';

// ===== CHAT MESSAGE MODEL =====
export interface IChatMessage extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Only store user ID
  senderType: 'user' | 'admin';
  message: string;
  status: 'sent' | 'delivered' | 'read';
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  toObject(): any;
}

interface IChatMessageModel extends mongoose.Model<IChatMessage> {
  // Get conversation with specific user
  getUserConversation(userId: string): Promise<IChatMessage[]>;
  
  // Get all user conversations for admin dashboard (any admin can see all)
  getAllUserConversations(): Promise<any[]>;
  
  // Get user conversation with user details
  getUserConversationWithDetails(userId: string): Promise<any>;
  
  // Get recent conversations with limit
  getRecentConversations(limit?: number): Promise<any[]>;
  
  // Mark messages as read
  markAsRead(messageIds: string[]): Promise<void>;
  
  // Mark user messages as read (when admin reads them)
  markUserMessagesAsRead(userId: string): Promise<void>;
  
  // Get unread count for specific user's conversation
  getUnreadCount(userId: string, readerType: 'user' | 'admin'): Promise<number>;
  
  // Send message from admin to user
  sendAdminMessage(userId: string, message: string): Promise<IChatMessage>;
  
  // Send message from user to admin
  sendUserMessage(userId: string, message: string): Promise<IChatMessage>;
}

const ChatMessageSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to your User model
      required: true,
    },
    senderType: {
      type: String,
      enum: ['user', 'admin'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000, // Limit message length
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    readAt: {
      type: Date,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
ChatMessageSchema.index({ userId: 1, createdAt: -1 });
ChatMessageSchema.index({ userId: 1, status: 1 });
ChatMessageSchema.index({ createdAt: -1 });

// Virtual to populate user data
ChatMessageSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Get conversation for specific user
ChatMessageSchema.statics.getUserConversation = async function (userId: string): Promise<IChatMessage[]> {
  return this.find({ userId })
    .sort({ createdAt: 1 })
    .lean();
};

// Get all user conversations for admin dashboard
ChatMessageSchema.statics.getAllUserConversations = async function (): Promise<any[]> {
  const conversations = await this.aggregate([
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$userId',
        lastMessage: { $first: '$$ROOT' },
        totalMessages: { $sum: 1 },
        unreadAdminCount: {
          $sum: {
            $cond: {
              if: {
                $and: [
                  { $eq: ['$senderType', 'user'] },
                  { $ne: ['$status', 'read'] }
                ]
              },
              then: 1,
              else: 0
            }
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users', // Your user collection name
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $project: {
        userId: '$_id',
        user: {
          _id: '$user._id',
          name: '$user.firstName',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          email: '$user.email',
          avatar: '$user.avatar',
          status: '$user.status',
          lastSeen: '$user.lastSeen'
        },
        lastMessage: {
          message: '$lastMessage.message',
          createdAt: '$lastMessage.createdAt',
          senderType: '$lastMessage.senderType',
          status: '$lastMessage.status'
        },
        totalMessages: 1,
        unreadCount: '$unreadAdminCount' // Messages from user that admin hasn't read
      }
    },
    {
      $sort: { 'lastMessage.createdAt': -1 }
    }
  ]);

  return conversations;
};

// Mark specific messages as read
ChatMessageSchema.statics.markAsRead = async function (messageIds: string[]): Promise<void> {
  await this.updateMany(
    { _id: { $in: messageIds }, status: { $ne: 'read' } },
    { 
      status: 'read', 
      readAt: new Date() 
    }
  );
};

// Mark all user messages as read (when admin opens conversation)
ChatMessageSchema.statics.markUserMessagesAsRead = async function (userId: string): Promise<void> {
  await this.updateMany(
    { 
      userId, 
      senderType: 'user', 
      status: { $ne: 'read' } 
    },
    { 
      status: 'read', 
      readAt: new Date() 
    }
  );
};

// Get unread count for specific user conversation
ChatMessageSchema.statics.getUnreadCount = async function (
  userId: string, 
  readerType: 'user' | 'admin'
): Promise<number> {
  // For admin: count unread messages from user
  // For user: count unread messages from admin
  const senderTypeToCount = readerType === 'admin' ? 'user' : 'admin';
  
  return this.countDocuments({ 
    userId, 
    senderType: senderTypeToCount, 
    status: { $ne: 'read' } 
  });
};

// Send message from admin to user
ChatMessageSchema.statics.sendAdminMessage = async function (
  userId: string, 
  message: string
): Promise<IChatMessage> {
  const chatMessage = new this({
    userId,
    senderType: 'admin',
    message: message.trim(),
    status: 'sent'
  });

  return chatMessage.save();
};

// Send message from user to admin
ChatMessageSchema.statics.sendUserMessage = async function (
  userId: string, 
  message: string
): Promise<IChatMessage> {
  const chatMessage = new this({
    userId,
    senderType: 'user',
    message: message.trim(),
    status: 'sent'
  });

  return chatMessage.save();
};

// Get all users who have conversations (for admin dashboard)
ChatMessageSchema.statics.getUsersWithConversations = async function (): Promise<any[]> {
  const users = await this.aggregate([
    {
      $group: {
        _id: '$userId',
        lastMessageAt: { $max: '$createdAt' },
        messageCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $project: {
        _id: '$user._id',
        name: '$user.name',
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        email: '$user.email',
        avatar: '$user.avatar',
        status: '$user.status',
        lastSeen: '$user.lastSeen',
        lastMessageAt: 1,
        messageCount: 1
      }
    },
    {
      $sort: { lastMessageAt: -1 }
    }
  ]);

  return users;
};

// Export model getter function
export async function getChatMessageModel(): Promise<IChatMessageModel> {
  await dbConnect();
  return (mongoose.models.ChatMessage || 
    mongoose.model<IChatMessage, IChatMessageModel>('ChatMessage', ChatMessageSchema)) as IChatMessageModel;
}