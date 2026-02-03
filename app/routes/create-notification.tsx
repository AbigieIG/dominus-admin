import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, useActionData, useNavigation } from "react-router";
import mongoose from "mongoose";
import { getNotificationModel } from "~/models/notifications.server";
import { NotificationType, NotificationActionType } from "~/types";
import { getUserModel } from "~/models/user.server";

type ActionData = {
  errors?: Record<string, string>;
  success?: string;
  error?: string;
};

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Create Notifications | ${settings.site.title}`},
  ];
};

// Action function to handle notification creation
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();

  const { userId } = params;
  const type = formData.get("type") as NotificationType;
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const sender = formData.get("sender") as string;
  const actionType = formData.get("actionType") as NotificationActionType;
  const actionUrl = formData.get("actionUrl") as string;
  const actionName = formData.get("actionName") as string;
  const sendToAll = formData.get("sendToAll") === "on";
  const date = formData.get("date") as string;

  const errors: Record<string, string> = {};

  // Validation
  if (!sendToAll && (!userId || !mongoose.Types.ObjectId.isValid(userId))) {
    errors.user = "Please select a valid user";
  }

  if (!type || !Object.values(NotificationType).includes(type)) {
    errors.type = "Please select a valid notification type";
  }

  if (!title?.trim()) {
    errors.title = "Title is required";
  }

  if (!content?.trim()) {
    errors.content = "Content is required";
  }

  if (actionType && actionType !== NotificationActionType.NONE) {
    if (!actionUrl?.trim()) {
      errors.actionUrl = "Action URL is required when action type is selected";
    }
  }

  if (Object.keys(errors).length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const NotificationModel = await getNotificationModel();

    const notificationData = {
      type,
      title: title.trim(),
      content: content.trim(),
      sender: sender?.trim() || undefined,
      ...(actionType !== NotificationActionType.NONE && {
        action: {
          type: actionType,
          url: actionUrl.trim(),
          name: actionName?.trim() || undefined,
        },
      }),
     date: date ? new Date(date) : new Date(),
    };

    if (sendToAll) {
      const UserModel = await getUserModel();
      const users = await UserModel.find({}, { _id: 1 }).lean();

      const userIds = users.map((user) => user._id.toString());

      const notifications = userIds.map((id) => ({
        ...notificationData,
        user: new mongoose.Types.ObjectId(id),
      }));

      await NotificationModel.insertMany(notifications);

      return Response.json({
        success: `Notification sent to ${userIds.length} users successfully`,
      });
    } else {
      // Send to specific user
      const notification = new NotificationModel({
        ...notificationData,
        user: new mongoose.Types.ObjectId(userId),
      });

      await notification.save();

      return Response.json({ success: "Notification sent successfully" });
    }
  } catch (error) {
    console.error("Error creating notification:", error);
    return Response.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}

export default function CreateNotification() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto ">
        <div className="bg-white shadow-lg rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Create Notification
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Send a notification to users in your system
            </p>
          </div>

          {/* Success/Error Messages */}
          {actionData?.success && (
            <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-green-800 text-sm">{actionData.success}</p>
                </div>
              </div>
            </div>
          )}

          {actionData?.error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-red-800 text-sm">{actionData.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="px-6 py-6">
            <Form method="post" className="space-y-6">
              {/* Recipient Selection */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    id="sendToAll"
                    name="sendToAll"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="sendToAll"
                    className="text-sm font-medium text-gray-700"
                  >
                    Send to all users
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Notification Type */}
                <div>
                  <label
                    htmlFor="type"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Notification Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select type...</option>
                    {Object.values(NotificationType).map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                  {actionData?.errors?.type && (
                    <p className="mt-1 text-sm text-red-600">
                      {actionData.errors.type}
                    </p>
                  )}
                </div>

                {/* Sender */}
                <div>
                  <label
                    htmlFor="sender"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Sender (Optional)
                  </label>
                  <input
                    type="text"
                    id="sender"
                    name="sender"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="System, Admin, etc."
                  />
                </div>
                <div>
                  <label
                    htmlFor="sender"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Date
                  </label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    id="date"
                    name="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="System, Admin, etc."
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter notification title"
                  required
                />
                {actionData?.errors?.title && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.errors.title}
                  </p>
                )}
              </div>

              {/* Content */}
              <div>
                <label
                  htmlFor="content"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Content
                </label>
                <textarea
                  id="content"
                  name="content"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter notification content"
                  required
                />
                {actionData?.errors?.content && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.errors.content}
                  </p>
                )}
              </div>

              {/* Action Section */}
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  Action Settings (Optional)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Action Type */}
                  <div>
                    <label
                      htmlFor="actionType"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Action Type
                    </label>
                    <select
                      id="actionType"
                      name="actionType"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Object.values(NotificationActionType).map(
                        (actionType) => (
                          <option key={actionType} value={actionType}>
                            {actionType.charAt(0).toUpperCase() +
                              actionType.slice(1)}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* Action URL */}
                  <div>
                    <label
                      htmlFor="actionUrl"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Action URL
                    </label>
                    <input
                      type="url"
                      id="actionUrl"
                      name="actionUrl"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/page"
                    />
                    {actionData?.errors?.actionUrl && (
                      <p className="mt-1 text-sm text-red-600">
                        {actionData.errors.actionUrl}
                      </p>
                    )}
                  </div>

                  {/* Action Name */}
                  <div>
                    <label
                      htmlFor="actionName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Action Name
                    </label>
                    <input
                      type="text"
                      id="actionName"
                      name="actionName"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="View Details, Go to Dashboard, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Sending..." : "Send Notification"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
