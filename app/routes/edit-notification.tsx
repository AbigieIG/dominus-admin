import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  redirect,
} from "react-router";
import mongoose from "mongoose";
import {
  getNotificationModel,
  type INotification,
} from "~/models/notifications.server";
import { NotificationType, NotificationActionType } from "~/types";


type ActionData = {
  errors?: Record<string, string>;
  success?: string;
  error?: string;
};

type LoaderData = {
  notification: {
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
    createdAt: string;
    updatedAt: string;
  };
  users: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
};

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Edit Notification | ${settings.site.title}`},
  ];
};
// Loader function to fetch notification and users data
export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    throw new Response("Notification ID is required", { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Response("Invalid notification ID", { status: 400 });
  }

  try {
    const NotificationModel = await getNotificationModel();
    const notification = await NotificationModel.findById(id).lean();

    if (!notification) {
      throw new Response("Notification not found", { status: 404 });
    }


    // Convert ObjectIds to strings for serialization
    const serializedNotification = {
      ...notification,
      _id: notification._id.toString(),
      user: notification.user.toString(),
      // date: notification.date.toISOString(),
      // createdAt: notification.createdAt.toISOString(),
      // updatedAt: notification.updatedAt.toISOString(),
    };

    return Response.json({
      notification: serializedNotification,    });
  } catch (error) {
    console.error("Error loading notification:", error);
    throw new Response("Failed to load notification", { status: 500 });
  }
}

// Action function to handle notification update and deletion
export async function action({ request, params }: ActionFunctionArgs) {
  const { id, userId } = params;

  if (!id) {
    return Response.json(
      { error: "Notification ID is required" },
      { status: 400 }
    );
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid notification ID" }, { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    try {
      const NotificationModel = await getNotificationModel();
      await NotificationModel.findByIdAndDelete(id);
      return redirect("/admin/notifications/" + userId);
    } catch (error) {
      console.error("Error deleting notification:", error);
      return Response.json(
        { error: "Failed to delete notification" },
        { status: 500 }
      );
    }
  }

  // Handle update
  const type = formData.get("type") as NotificationType;
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const sender = formData.get("sender") as string;
  const read = formData.get("read") === "on";
  const actionType = formData.get("actionType") as NotificationActionType;
  const actionUrl = formData.get("actionUrl") as string;
  const actionName = formData.get("actionName") as string;

  const errors: Record<string, string> = {};

  // Validation
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
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

    const updateData: Partial<INotification> = {
      user: new mongoose.Types.ObjectId(userId),
      type,
      title: title.trim(),
      content: content.trim(),
      read,
      sender: sender?.trim() || undefined,
    };

    // Handle action data
    if (actionType === NotificationActionType.NONE) {
      updateData.action = undefined;
    } else {
      updateData.action = {
        type: actionType,
        url: actionUrl.trim(),
        name: actionName?.trim() || undefined,
      };
    }

    await NotificationModel.findByIdAndUpdate(id, updateData, { new: true });

    return Response.json({ success: "Notification updated successfully" });
  } catch (error) {
    console.error("Error updating notification:", error);
    return Response.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}

export default function EditNotification() {
  const { notification, users } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";
  const isDeleting = navigation.formData?.get("intent") === "delete";

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto ">
        <div className="bg-white shadow-lg rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-2 md:gap-0 items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Edit Notification
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  ID: {notification._id}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    notification.read
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {notification.read ? "Read" : "Unread"}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    notification.type === "message"
                      ? "bg-blue-100 text-blue-800"
                      : notification.type === "alert"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {notification.type.charAt(0).toUpperCase() +
                    notification.type.slice(1)}
                </span>
              </div>
            </div>
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
                    defaultValue={notification.type}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
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
                    defaultValue={notification.sender || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="System, Admin, etc."
                  />
                </div>

                {/* Read Status */}
                <div className="flex items-center space-x-3">
                  <input
                    id="read"
                    name="read"
                    type="checkbox"
                    defaultChecked={notification.read}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="read"
                    className="text-sm font-medium text-gray-700"
                  >
                    Mark as read
                  </label>
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
                  defaultValue={notification.title}
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
                  defaultValue={notification.content}
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
                  Action Settings
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
                      defaultValue={
                        notification.action?.type || NotificationActionType.NONE
                      }
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
                      defaultValue={notification.action?.url || ""}
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
                      defaultValue={notification.action?.name || ""}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="View Details, Go to Dashboard, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Notification Info */}
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Notification Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(notification.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Last Updated:</span>{" "}
                    {new Date(notification.updatedAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Original Date:</span>{" "}
                    {new Date(notification.date).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    <span
                      className={
                        notification.read ? "text-green-600" : "text-yellow-600"
                      }
                    >
                      {notification.read ? "Read" : "Unread"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap-reverse gap-3 items-center justify-between pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  name="intent"
                  value="delete"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    if (
                      !confirm(
                        "Are you sure you want to delete this notification? This action cannot be undone."
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  {isDeleting ? "Deleting..." : "Delete Notification"}
                </button>

                <div className="flex flex-wrap items-center space-x-3">
                    <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting && !isDeleting
                      ? "Updating..."
                      : "Update Notification"}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                
                </div>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
