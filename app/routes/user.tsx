import React from "react";
import { useNavigate, type MetaFunction } from "react-router";
import { AdminUserManagementService } from "~/services/user.server";
import type { IUser } from "~/types";
import type { Route } from "./+types/user";

import settings from "~/assets/settings.json";
export const meta: MetaFunction = () => {
  return [{ title: `User | ${settings.site.title}` }];
};
export async function loader({ params }: Route.LoaderArgs) {
  const { userId } = params;
  try {
    const user = await AdminUserManagementService.getUserById(userId);
    if (!user) {
      throw new Response("User Not Found", { status: 404 });
    }
    return Response.json(user);
  } catch (error) {
    throw new Response("User Not Found", { status: 404 });
  }
}

const AdminUserDetails = ({ loaderData }: Route.ComponentProps) => {
  const user: IUser = loaderData;

  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "dormant":
        return "bg-yellow-100 text-yellow-800";
      case "frozen":
        return "bg-blue-100 text-blue-800";
      case "closed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen">
      <div className="">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div>
              <div className="w-16 h-16  border-2 relative border-white rounded-full overflow-hidden">
                <img
                  className="w-full h-full object-cover"
                  src={
                    user.avatar?.url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`,
                    )}&background=0ea5e9&color=fff&size=200`
                  }
                  alt={`${user.firstName} ${user.lastName} avatar`}
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  user.isVerified
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {user.isVerified ? "Verified" : "Unverified"}
              </span>
              <>
                {user.isSuspended ? (
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800`}
                  >
                    Suspended
                  </span>
                ) : (
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(user.account.status)}`}
                  >
                    {user.account.status.charAt(0).toUpperCase() +
                      user.account.status.slice(1)}
                  </span>
                )}
              </>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Personal Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    First Name
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{user.firstName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Last Name
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{user.lastName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Email
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Phone
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{user.phone}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Date of Birth
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatDate(user.dob)}
                  </p>
                </div>
                {user.nationalId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      National ID
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {user.nationalId}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Address
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500">
                    Street
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.address.street}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    City
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.address.city}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    State
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.address.state}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Postal Code
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.address.postalCode}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Country
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.address.country}
                  </p>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Account Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Account Type
                  </label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">
                    {user.account.type}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Account Number
                  </label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {user.account.number}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Balance
                  </label>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {formatCurrency(
                      user.account.balance,
                      user.account.currency,
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Currency
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {user.account.currency}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    IBAN
                  </label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {user.account.iban}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    SWIFT/BIC
                  </label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {user.account.swiftBic}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Routing Number
                  </label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {user.account.routingNumber}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Sort Code
                  </label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {user.account.sortCode}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    PIN
                  </label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {user.account.pin}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Settings & Activity */}
          <div className="space-y-6">
            {/* Security Settings */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Security
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Password</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium`}>
                    {user?.password}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Two-Factor Authentication
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.security.twoFactorEnabled
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.security.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Notifications
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Email</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.notifications.email
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.notifications.email ? "On" : "Off"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">SMS</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.notifications.sms
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.notifications.sms ? "On" : "Off"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Push</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.notifications.push
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.notifications.push ? "On" : "Off"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Request OTP</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.notifications.requestOtp
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.notifications.requestOtp ? "On" : "Off"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Send Email Receipt
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.notifications.sendEmailReceipt
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.notifications.sendEmailReceipt ? "On" : "Off"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Send Transfer Code
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.notifications.sendOtp
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.notifications.sendOtp ? "On" : "Off"}
                  </span>
                </div>
              </div>
            </div>

            {/* Activity Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Activity
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Join Date
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatDate(user.joinDate)}
                  </p>
                </div>
                {user.lastLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Last Login
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatDate(user.lastLogin)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Last Updated
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatDate(user.updatedAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/admin/edit/${user._id}`)}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Edit User
                </button>
                <button
                  onClick={() => navigate(`/admin/transactions/${user._id}`)}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                >
                  View Transactions
                </button>
                <button
                  onClick={() => navigate(`/admin/notifications/${user._id}`)}
                  className="w-full bg-cyan-700  text-white px-4 py-2 rounded-md hover:bg-cyan-800 transition-colors"
                >
                  View Notifications
                </button>
                <button
                  onClick={() => navigate(`/admin/deposit/${user._id}`)}
                  className="w-full bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
                >
                  Deposit
                </button>
                <button
                  onClick={() => navigate(`/admin/transfer/${user._id}`)}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  Transfer
                </button>
                <button
                  onClick={() => navigate(`/admin/cards/${user._id}`)}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  View Cards
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Banking Details (Sensitive) */}
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg p-6 border-l-4 border-red-400">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800">
                  Sensitive Banking Information
                </h3>
                <p className="text-sm text-red-700">
                  This information should be handled with extreme care
                </p>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-red-700">
                    Account Number
                  </label>
                  <p className="mt-1 text-sm text-red-900 font-mono">
                    {user.account.number}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700">
                    Routing Number
                  </label>
                  <p className="mt-1 text-sm text-red-900 font-mono">
                    {user.account.routingNumber}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700">
                    SWIFT/BIC
                  </label>
                  <p className="mt-1 text-sm text-red-900 font-mono">
                    {user.account.swiftBic}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700">
                    IBAN
                  </label>
                  <p className="mt-1 text-sm text-red-900 font-mono break-all">
                    {user.account.iban}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700">
                    Sort Code
                  </label>
                  <p className="mt-1 text-sm text-red-900 font-mono">
                    {user.account.sortCode}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700">
                    PIN
                  </label>
                  <p className="mt-1 text-sm text-red-900 font-mono">
                    <span className="bg-red-200 px-2 py-1 rounded">
                      {user.account.pin}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Summary Card */}
        <div className="mt-8">
          <div className="bg-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Account </h3>
                <p className="text-blue-100">
                  {user.account.type.charAt(0).toUpperCase() +
                    user.account.type.slice(1)}{" "}
                  Account
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">
                  {formatCurrency(user.account.balance, user.account.currency)}
                </p>
                <p className="text-blue-100">Current Balance</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetails;
