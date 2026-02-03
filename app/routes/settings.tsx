import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
} from "react-router";
import { useState } from "react";
import { getAdminModel } from "~/models/admin.server";
import { getAdminSession, AdminService } from "~/utils/admin.server";
import { LockKeyhole, UserRound } from "lucide-react";
import settings from "~/assets/settings.json";
import type { IAdmin } from "~/types";

// Types for the page
interface LoaderData {
  admin: IAdmin | null;
  error?: string;
}

interface ActionData {
  success?: boolean;
  error?: string;
  admin?: IAdmin;
  type?: "profile" | "password";
}

export const meta: MetaFunction = () => {
  return [{ title: `Settings | ${settings.site.title}` }];
};
// Loader function to get admin data
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const adminData = await getAdminSession(request);
    const AdminModel = await getAdminModel();
    const adminId = adminData?.adminId;

    if (!adminId) {
      return Response.json({ admin: null, error: "Admin ID is required" });
    }

    const admin = await AdminModel.findById(adminId);

    if (!admin) {
      return Response.json({ admin: null, error: "Admin not found" });
    }

    return Response.json({ admin: admin.toObject() });
  } catch (error) {
    console.error("Error loading admin:", error);
    return Response.json({ admin: null, error: "Failed to load admin data" });
  }
}

// Action function to handle form submissions
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  const adminData = await getAdminSession(request);

  try {
    const AdminModel = await getAdminModel();
    const adminId = adminData?.adminId;

    if (!adminId) {
      return Response.json({ error: "Admin ID is required" });
    }

    if (intent === "update") {
      const name = formData.get("name") as string;
      const email = formData.get("email") as string;
      const phone = formData.get("phone") as string;
      const contactEmail = formData.get("contactEmail") as string;
      const usdt = formData.get("usdt") as string;
      const bitcoin = formData.get("bitcoin") as string;

      // Validation
      if (!name || !email || !phone || !contactEmail || !usdt || !bitcoin) {
        return Response.json({
          error: "Name and email are required",
          type: "profile",
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return Response.json({
          error: "Please enter a valid email address",
          type: "profile",
        });
      }

      // Update admin
      const updatedAdmin = await AdminModel.findByIdAndUpdate(
        adminId,
        {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          contact: {
            phone: phone?.trim() || undefined,
            email: contactEmail?.toLowerCase().trim() || undefined,
          },
          payments: {
            usdt: usdt?.trim() || undefined,
            bitcoin: bitcoin?.trim() || undefined,
          },
        },
        { new: true }
      );

      if (!updatedAdmin) {
        return Response.json({ error: "Admin not found", type: "profile" });
      }

      return Response.json({
        success: true,
        admin: updatedAdmin.toObject(),
        type: "profile",
      });
    }

    if (intent === "changePassword") {
      const currentPassword = formData.get("currentPassword") as string;
      const newPassword = formData.get("newPassword") as string;
      const confirmPassword = formData.get("confirmPassword") as string;

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        return Response.json({
          error: "All password fields are required",
          type: "password",
        });
      }

      if (newPassword !== confirmPassword) {
        return Response.json({
          error: "New passwords do not match",
          type: "password",
        });
      }

      if (newPassword.length < 8) {
        return Response.json({
          error: "Password must be at least 8 characters long",
          type: "password",
        });
      }

      // Password strength validation
      //   const hasUpperCase = /[A-Z]/.test(newPassword);
      //   const hasLowerCase = /[a-z]/.test(newPassword);
      //   const hasNumbers = /\d/.test(newPassword);
      //   const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

      //   if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      //     return Response.json({
      //       error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      //       type: 'password'
      //     });
      //   }

      // Get current admin

      const admin = await AdminService.changePassword(
        adminId,
        currentPassword,
        newPassword
      );
      if (!admin.success) {
        return Response.json({
          error: admin.error || "Failed to change password",
          type: "password",
        });
      }

      return Response.json({
        success: true,
        type: "password",
      });
    }

    return Response.json({ error: "Invalid action" });
  } catch (error) {
    console.error("Error in admin action:", error);
    return Response.json({
      error: "An unexpected error occurred. Please try again.",
    });
  }
}

export default function AdminPage() {
  const { admin, error: loaderError } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [isEditing, setIsEditing] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  if (loaderError || !admin) {
    return (
      <div className="min-h-screen text-sm bg-gradient-to-br from-gray-50 to-gray-100 p-4 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {loaderError || "Admin Not Found"}
            </h1>
            <p className="text-gray-600">
              The admin profile couldn't be loaded. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-4xl mx-auto py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 p-1 flex space-x-1">
          <button
            onClick={() => {
              setActiveTab("profile");
              setIsEditing(false);
            }}
            className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-200 ${
              activeTab === "profile"
                ? "bg-blue-500 text-white shadow-lg"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <UserRound className="w-5 h-5" />
              <span>Profile</span>
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab("password");
              setIsEditing(false);
            }}
            className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-200 ${
              activeTab === "password"
                ? "bg-blue-500 text-white shadow-lg"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <LockKeyhole className="w-5 h-5" />
              <span>Password</span>
            </div>
          </button>
        </div>

        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-green-800 font-medium">
                {actionData.type === "password"
                  ? "Password changed successfully!"
                  : "Profile updated successfully!"}
              </p>
            </div>
          </div>
        )}

        {actionData?.error && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-red-800 font-medium">{actionData.error}</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-sm">
          {activeTab === "profile" ? (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-500 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <Form method="post" className="space-y-6">
                  <input type="hidden" name="intent" value="update" />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-semibold text-gray-700 mb-3"
                      >
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        defaultValue={admin.name}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-semibold text-gray-700 mb-3"
                      >
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        defaultValue={admin.email}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter your email address"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-semibold text-gray-700 mb-3"
                      >
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        defaultValue={admin.contact?.phone || ""}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter your phone number"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contactEmail"
                        className="block text-sm font-semibold text-gray-700 mb-3"
                      >
                        Contact Email
                      </label>
                      <input
                        type="email"
                        id="contactEmail"
                        name="contactEmail"
                        defaultValue={admin.contact?.email || ""}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter alternative email"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="bitcoin"
                        className="block text-sm font-semibold text-gray-700 mb-3"
                      >
                        Bitcoin
                      </label>
                      <input
                        type="text"
                        id="bitcoin"
                        name="bitcoin"
                        defaultValue={admin.payments?.bitcoin || ""}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter alternative email"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="usdt"
                        className="block text-sm font-semibold text-gray-700 mb-3"
                      >
                        Usdt
                      </label>
                      <input
                        type="text"
                        id="usdt"
                        name="usdt"
                        defaultValue={admin.payments?.usdt || ""}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter alternative email"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-6">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-500 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:hover:transform-none"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center space-x-2">
                          <svg
                            className="animate-spin w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span>Saving...</span>
                        </div>
                      ) : (
                        "Save Changes"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={isSubmitting}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 py-3 px-6 rounded-xl font-medium transition-all duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </Form>
              ) : (
                <div className="space-y-8">
                  <div className="grid  grid-cols-1 lg:grid-cols-2  gap-8">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Full Name
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-4 py-3 rounded-xl">
                        {admin.name}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-4 py-3 rounded-xl">
                        {admin.email}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-4 py-3 rounded-xl">
                        {admin.contact?.phone || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Contact Email
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-4 py-3 rounded-xl">
                        {admin.contact?.email || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Bitcoin
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-4 py-3 rounded-xl">
                        {admin.payments?.bitcoin || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Usdt
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-4 py-3 rounded-xl">
                        {admin.payments?.usdt || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Password Tab
            <div className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  Change Password
                </h2>
                <p className="text-gray-600 mt-1">
                  Update your password to keep your account secure
                </p>
              </div>

              <Form method="post" className="space-y-6 max-w-lg">
                <input type="hidden" name="intent" value="changePassword" />

                <div>
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-semibold text-gray-700 mb-3"
                  >
                    Current Password *
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your current password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-semibold text-gray-700 mb-3"
                  >
                    New Password *
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your new password"
                  />
                  <p className="mt-2 text-sm text-gray-600">
                    Password must be at least 8 characters and contain
                    uppercase, lowercase, number, and special character.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold text-gray-700 mb-3"
                  >
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Confirm your new password"
                  />
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-500 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:hover:transform-none"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center space-x-2">
                        <svg
                          className="animate-spin w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Changing Password...</span>
                      </div>
                    ) : (
                      "Change Password"
                    )}
                  </button>
                </div>
              </Form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
