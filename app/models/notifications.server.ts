import mongoose, { Document, Schema } from 'mongoose';
import dbConnect from '~/utils/db.server';

export enum NotificationActionType {
  VIEW = 'view',
  REDIRECT = 'redirect',
  NONE = 'none',
}


export enum NotificationType {
  MESSAGE = 'message',
  ALERT = 'alert',
  SYSTEM = 'system',
}
interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
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
};

const NotificationSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      default: NotificationType.MESSAGE,
      required: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    sender: { type: String },
    action: {
      type: {
        type: String,
        enum: Object.values(NotificationActionType),
        default: NotificationActionType.NONE,
      },
      url: { type: String },
      name: { type: String },
    },
  },
  { timestamps: true }

);


// Prevent model recompilation error
export async function getNotificationModel() {
  await dbConnect();
  
  // Check if model already exists
  if (mongoose.models.Notification) {
    return mongoose.models.Notification as mongoose.Model<INotification>;
  }
  
  return mongoose.model<INotification>('Notification', NotificationSchema);
}

export type { INotification };