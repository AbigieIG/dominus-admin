// app/routes/notifications.tsx
import {
  useLoaderData,
  useActionData,
  useSearchParams,
  Link,
  useFetcher,
  redirect,
  useNavigate,
  type MetaFunction,
} from "react-router";
import {
  Bell,
  BellOff,
  Mail,
  AlertCircle,
  Check,
  X,
  ArrowLeft,
  Filter,
  Trash2,
  SquarePen,
} from "lucide-react";
import { useState } from "react";
import {
  notificationService,
  type NotificationFilters,
} from "~/utils/notification.server";
import { NotificationType } from "~/models/notifications.server";
import type { Route } from "./+types/notifications";

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Notifications | ${settings.site.title}`},
  ];
};
// Types
type LoaderData = {
  notifications?: any[];
  notification?: any;
  filters: { type: string | null; unread: boolean | null };
  unreadCount: number;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  userId: string;
  stats?: {
    total: number;
    unread: number;
    byType: { [key: string]: number };
    recentActivity: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
  };
};

type ActionData = {
  success: boolean;
  message: string;
};
// Loader function
export async function loader({ request, params }: Route.LoaderArgs) {
  const { userId } = params;
  const url = new URL(request.url);
  const notificationId = url.searchParams.get("id");

  try {
    // Single notification view
    if (notificationId) {
      const notification = await notificationService.getNotificationById(
        notificationId,
        userId
      );
      if (!notification) {
        return redirect(`/admin/notifications/${userId}`);
      }

      // Mark as read when viewing
      // await notificationService.markAsRead(notificationId, userId);

      return Response.json({ notification, userId });
    }

    // Notification list with filters and pagination
    const type = url.searchParams.get("type") as NotificationType | null;
    const unread = url.searchParams.get("unread");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    // Build filters
    const filters: NotificationFilters = {};
    if (type && Object.values(NotificationType).includes(type)) {
      filters.type = type;
    }
    if (unread === "true") {
      filters.read = false;
    }

    // Get notifications with pagination
    const result = await notificationService.getUserNotifications(
      userId,
      filters,
      { page, limit, sortBy: "date", sortOrder: "desc" }
    );

    // Get stats for dashboard-like info
    const stats = await notificationService.getNotificationStats(userId);

    return Response.json({
      notifications: result.notifications,
      filters: { type, unread: unread === "true" },
      unreadCount: result.unreadCount,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      stats,
      userId,
    });
  } catch (error) {
    console.error("Error loading notifications:", error);
    throw new Error("Failed to load notifications");
  }
}

// Action function
export async function action({ request, params }: Route.ActionArgs) {
  const { userId } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    switch (intent) {
      case "mark-as-read": {
        const notificationId = formData.get("id") as string;
        if (notificationId) {
          await notificationService.markAsRead(notificationId, userId);
          return Response.json({
            success: true,
            message: "Notification marked as read",
          });
        }
        break;
      }

      case "mark-as-unread": {
        const notificationId = formData.get("id") as string;
        if (notificationId) {
          await notificationService.markAsUnread(notificationId, userId);
          return Response.json({
            success: true,
            message: "Notification marked as unread",
          });
        }
        break;
      }

      case "mark-all-read": {
        const type = formData.get("type") as NotificationType | null;
        const filters: NotificationFilters = {};
        if (type) filters.type = type;

        const count = await notificationService.markAllAsRead(userId, filters);
        return Response.json({
          success: true,
          message: `${count} notification${count !== 1 ? "s" : ""} marked as read`,
        });
      }

      case "delete": {
        const notificationId = formData.get("id") as string;
        if (notificationId) {
          const deleted = await notificationService.deleteNotification(
            notificationId,
            userId
          );
          if (deleted) {
            return Response.json({
              success: true,
              message: "Notification deleted",
            });
          } else {
            return Response.json({
              success: false,
              message: "Notification not found",
            });
          }
        }
        break;
      }

      case "delete-multiple": {
        const notificationIds = formData.get("ids") as string;
        if (notificationIds) {
          const ids = JSON.parse(notificationIds);
          const deletedCount =
            await notificationService.deleteMultipleNotifications(ids, userId);
          return Response.json({
            success: true,
            message: `${deletedCount} notification${deletedCount !== 1 ? "s" : ""} deleted`,
          });
        }
        break;
      }

      default:
        return Response.json(
          { success: false, message: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error processing notification action:", error);
    return Response.json(
      {
        success: false,
        message: "An error occurred while processing your request",
      },
      { status: 500 }
    );
  }

  return Response.json(
    { success: false, message: "Invalid request" },
    { status: 400 }
  );
}

export default function NotificationsPage() {
  const data = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>(
    []
  );
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const {
    notification,
    notifications,
    filters,
    unreadCount,
    totalCount,
    currentPage,
    totalPages,
    stats,
  } = data;

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "message":
        return <Mail className="w-5 h-5 text-blue-600" />;
      case "alert":
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case "system":
        return <Bell className="w-5 h-5 text-purple-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  // Apply filters
  const applyFilters = (type: string | null, unread: boolean | null) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (unread) params.set("unread", "true");
    setSearchParams(params);
    setShowFilters(false);
  };

  // Handle pagination
  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    setSearchParams(params);
  };

  // Handle bulk selection
  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications((prev) =>
      prev.includes(notificationId)
        ? prev.filter((id) => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const selectAllNotifications = () => {
    if (selectedNotifications.length === notifications?.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(notifications?.map((n) => n._id) || []);
    }
  };

  // Single notification view
  if (notification) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 md:mb-6">
          <Link
            to={`/admin/notifications/${data.userId}`}
            className="flex items-center text-blue-600 hover:text-blue-800 text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Notifications
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 md:p-6">
          <div className="flex flex-col xs:flex-row justify-between items-start gap-3 mb-4 md:mb-6">
            <div className="flex items-center space-x-2 md:space-x-3">
              {getNotificationIcon(notification.type)}
              <h1 className="text-lg md:text-xl font-bold text-slate-900">
                {notification.title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm text-slate-500 whitespace-nowrap">
                {formatDate(notification.date)}
              </span>

              {/* Action buttons */}
              <div className="flex gap-2">
                <fetcher.Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value={
                      notification.read ? "mark-as-unread" : "mark-as-read"
                    }
                  />
                  <input type="hidden" name="id" value={notification._id} />
                  <button
                    type="submit"
                    className="text-slate-500 hover:text-slate-700"
                    title={
                      notification.read ? "Mark as unread" : "Mark as read"
                    }
                  >
                    {notification.read ? (
                      <BellOff className="w-4 h-4" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                  </button>
                </fetcher.Form>

                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={notification._id} />
                  <button
                    type="submit"
                    className="text-red-500 hover:text-red-700"
                    title="Delete notification"
                    onClick={(e) => {
                      if (
                        !confirm(
                          "Are you sure you want to delete this notification?"
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </fetcher.Form>
                <Link
                  to={`/admin/edit-notification/${notification._id}/${data.userId}`}
                  className="text-blue-600 hover:text-blue-700"
                  title="Edit notification"
                >
                  <SquarePen className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-sm md:text-base mb-6 md:mb-8">
            <p>{notification.content}</p>
          </div>

          {notification.sender && (
            <div className="mb-4 md:mb-6">
              <h3 className="text-xs md:text-sm font-medium text-slate-500 mb-1">
                Sender
              </h3>
              <p className="text-sm md:text-base text-slate-900">
                {notification.sender}
              </p>
            </div>
          )}

          {notification.action && (
            <div className="border-t border-slate-200 pt-4 md:pt-6">
              <Link
                to={notification.action.url}
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-medium text-sm md:text-base"
              >
                {notification.action.name || "View"}
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Notification list view
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header with stats */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Notifications
          </h1>
          {stats && (
            <div className="flex gap-4 text-sm text-slate-600">
              <span>{stats.total} total</span>
              <span>{stats.unread} unread</span>
              <span>{stats.recentActivity.today} today</span>
            </div>
          )}
        </div>

        <div className="flex items-center flex-wrap space-y-3 space-x-3 mt-4 md:mt-0">
          {selectedNotifications.length > 0 && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="delete-multiple" />
              <input
                type="hidden"
                name="ids"
                value={JSON.stringify(selectedNotifications)}
              />
              <button
                type="submit"
                className="flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                onClick={(e) => {
                  if (
                    !confirm(
                      `Are you sure you want to delete ${selectedNotifications.length} notification${selectedNotifications.length !== 1 ? "s" : ""}?`
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedNotifications.length})
              </button>
            </fetcher.Form>
          )}

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="mark-all-read" />
            <button
              type="submit"
              className="flex items-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium"
            >
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </button>
          </fetcher.Form>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
          <button 
          onClick={() => navigate(`/admin/create-notification/${data.userId}`)}
          className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">
            Send Notification
          </button>
        </div>
      </div>

      {/* Action feedback */}
      {actionData && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            actionData.success
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {actionData.message}
        </div>
      )}

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Filter Notifications
            </h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => applyFilters(null, filters?.unread === true)}
                  className={`w-full text-left px-3 py-2 rounded-lg ${!filters?.type ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                >
                  All Types
                </button>
                <button
                  onClick={() =>
                    applyFilters("message", filters?.unread === true)
                  }
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center ${filters?.type === "message" ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Messages
                </button>
                <button
                  onClick={() =>
                    applyFilters("alert", filters?.unread === true)
                  }
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center ${filters?.type === "alert" ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Alerts
                </button>
                <button
                  onClick={() =>
                    applyFilters("system", filters?.unread === true)
                  }
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center ${filters?.type === "system" ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  System
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => applyFilters(filters?.type || null, null)}
                  className={`w-full text-left px-3 py-2 rounded-lg ${!filters?.unread ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                >
                  All Notifications
                </button>
                <button
                  onClick={() => applyFilters(filters?.type || null, true)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center ${filters?.unread === true ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Unread Only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-slate-600 mb-1">
        {unreadCount > 0
          ? `${unreadCount} unread notifications`
          : "All caught up!"}
        {totalCount > 0 && ` (${totalCount} total)`}
      </p>

      {/* Notifications list */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {notifications?.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No notifications found matching your filters
          </div>
        ) : (
          <>
            {/* Bulk selection header */}
            {notifications && notifications.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={
                      selectedNotifications.length === notifications.length
                    }
                    onChange={selectAllNotifications}
                    className="rounded border-slate-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-slate-600">
                    Select all ({notifications.length})
                  </span>
                </label>
              </div>
            )}

            <ul className="divide-y divide-slate-200">
              {notifications?.map((notification) => (
                <li
                  key={notification._id}
                  className={`${!notification.read ? "bg-blue-50" : "hover:bg-slate-50"} transition-colors`}
                >
                  <div className="flex items-center p-4 md:p-6">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification._id)}
                      onChange={() =>
                        toggleNotificationSelection(notification._id)
                      }
                      className="rounded border-slate-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 mr-3"
                    />

                    <Link
                      to={`?id=${notification._id}`}
                      className="flex-1 flex items-start space-x-3 md:space-x-4"
                    >
                      <div className="flex-shrink-0 pt-0 md:pt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col xs:flex-row xs:justify-between line-clamp-1 gap-1 xs:gap-0">
                          <p
                            className={`text-sm font-medium ${!notification.read ? "text-blue-800" : "text-slate-900"}`}
                          >
                            {notification.title}
                          </p>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(notification.date)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 truncate w-full mt-1 line-clamp-1">
                          {notification.content}
                        </p>
                        {notification.sender && (
                          <p className="text-xs text-slate-500 mt-1">
                            From: {notification.sender}
                          </p>
                        )}
                      </div>
                      {!notification.read && (
                        <span className="flex-shrink-0 inline-block w-2 h-2 mt-1.5 rounded-full bg-blue-600"></span>
                      )}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages && totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`px-3 py-1 rounded border ${
                  page === currentPage
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
