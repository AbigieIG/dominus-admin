import React, { useState } from "react";
import {
  useActionData,
  Form,
  Link,
  useNavigation,
  redirect,
  type MetaFunction,
} from "react-router";
import { AdminUserManagementService } from "~/services/user.server";
import type { Route } from "./+types/edit";
import type { IUser } from "~/types";
import { getUserModel } from "~/models/user.server";
import countries from "~/assets/country.json";
import currencyOptions from '~/assets/currency.json'; 

// Type definitions

interface ActionData {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    [key: string]: string;
  };
}
import settings from "~/assets/settings.json";
import { SquarePen } from "lucide-react";
import { AvatarService } from "~/services/avatar.server";
export const meta: MetaFunction = () => {
  return [{ title: `Edit | ${settings.site.title}` }];
};

// Action function for form submission
export async function action({
  request,
  params,
}: {
  request: Request;
  params: any;
}) {
  const formData = await request.formData();
  const userId = params.userId;

  // Extract form data
  const avatarFile = formData.get("avatar") as File;
  const userData = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    dob: formData.get("dob") as string,
    joinDate: formData.get("joinDate") as string,
    nationalId: formData.get("nationalId") as string,
    password: formData.get("password") as string,
    address: {
      street: formData.get("street") as string,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      postalCode: formData.get("postalCode") as string,
      country: formData.get("country") as string,
    },
    isVerified: formData.get("isVerified") === "on",
    isSuspended: formData.get("isSuspended") === "on",
    security: {
      twoFactorEnabled: formData.get("twoFactorEnabled") === "on",
    },
    notifications: {
      email: formData.get("emailNotifications") === "on",
      sms: formData.get("smsNotifications") === "on",
      push: formData.get("pushNotifications") === "on",
      sendOtp: formData.get("sendOtp") === "on",
      sendEmailReceipt: formData.get("sendEmailReceipt") === "on",
      requestOtp: formData.get("requestOtp") === "on",
    },
    account: {
      type: formData.get("accountType") as string,
      balance: parseFloat(formData.get("balance") as string),
      currency: formData.get("currency") as string,
      status: formData.get("accountStatus") as string,
    },
    avatar: undefined as string | undefined,
  };

  // Basic validation
  const fieldErrors: { [key: string]: string } = {};

  if (!userData.firstName?.trim()) {
    fieldErrors.firstName = "First name is required";
  }
  if (!userData.lastName?.trim()) {
    fieldErrors.lastName = "Last name is required";
  }
  if (!userData.email?.trim()) {
    fieldErrors.email = "Email is required";
  } else if (!/\S+@\S+\.\S+/.test(userData.email)) {
    fieldErrors.email = "Invalid email format";
  }
  if (!userData.phone?.trim()) {
    fieldErrors.phone = "Phone number is required";
  }
  if (!userData.dob) {
    fieldErrors.dob = "Date of birth is required";
  }
  if (!userData.joinDate) {
    fieldErrors.joinDate = "Join date is required"; // Fixed: was checking dob instead of joinDate
  }
  if (isNaN(userData.account.balance)) {
    fieldErrors.balance = "Balance must be a valid number";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    const User = await getUserModel();

    // Handle avatar upload if file is provided
    if (avatarFile && avatarFile.size > 0) {
      try {
        const avatarUrl = await AvatarService.updateAvatar(userId, {
          file: avatarFile,
        });
        userData.avatar = avatarUrl;
      } catch (avatarError) {
        console.error("Avatar upload failed:", avatarError);
        // Continue with user update even if avatar upload fails
        // You might want to return an error here instead, depending on your requirements
        return {
          error:
            "User data updated but avatar upload failed. Please try uploading the avatar again.",
        };
      }
    }

    // Update user data
    const user = await User.findById(userId);
    if (!user) {
      return { error: "User not found" };
    }

    // Update user fields
    user.firstName = userData.firstName;
    user.lastName = userData.lastName;
    user.email = userData.email;
    user.phone = userData.phone;
    user.dob = new Date(userData.dob);
    user.joinDate = new Date(userData.joinDate);
    user.address = userData.address;
    user.isVerified = userData.isVerified;
    user.isSuspended = userData.isSuspended;
    user.security.twoFactorEnabled = userData.security.twoFactorEnabled;
    user.notifications.email = userData.notifications.email;
    user.notifications.sms = userData.notifications.sms;
    user.notifications.push = userData.notifications.push;
    user.notifications.sendOtp = userData.notifications.sendOtp;
    user.notifications.sendEmailReceipt =
      userData.notifications.sendEmailReceipt;
    user.notifications.requestOtp = userData.notifications.requestOtp;
    user.account.type = userData.account.type;
    user.account.balance = userData.account.balance;
    user.account.currency = userData.account.currency;
    user.account.status = userData.account.status;
    user.nationalId = userData.nationalId;

    // Only update password if it's provided and not empty
    if (userData.password && userData.password.trim()) {
      user.password = userData.password;
    }

    await user.save();

    // Redirect to user details page after successful update
    return redirect(`/admin/user/${userId}`);
  } catch (error) {
    console.error("Error updating user:", error);
    return { error: "Failed to update user. Please try again." };
  }
}

// Loader function to fetch user data
export async function loader({ params }: Route.LoaderArgs) {
  const { userId } = params;
  try {
    const user = await AdminUserManagementService.getUserById(userId);
    if (!user) {
      throw new Response("User Not Found", { status: 404 });
    }
    console.log(user);
    return Response.json(user);
  } catch (error) {
    throw new Response("User Not Found", { status: 404 });
  }
}

const AdminEditUser: React.FC<Route.ComponentProps> = ({ loaderData }) => {
  const user: IUser = loaderData;

  const actionData = useActionData() as ActionData;
  const navigation = useNavigation();
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  const [avatar, setAvatar] = useState<File | undefined>(undefined);

  const isSubmitting = navigation.state === "submitting";

  const formatDateForInput = (dateString: string) => {
    return new Date(dateString).toISOString().split("T")[0];
  };

  return (
    <div className="min-h-screen ">
      <div className="max-w-4xl mx-auto ">
        {/* Error/Success Messages */}
        {actionData?.error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{actionData.error}</p>
              </div>
            </div>
          </div>
        )}

        <Form method="post" encType="multipart/form-data" className="space-y-8">
          <div className="flex justify-center">
            <div className="w-32 h-32  border-2 relative border-white rounded-full overflow-hidden">
              <img
                className="w-full h-full object-cover"
                src={
                  avatar
                    ? URL.createObjectURL(avatar)
                    : user.avatar?.url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`
                      )}&background=0ea5e9&color=fff&size=200`
                }
                alt={`${user.firstName} ${user.lastName} avatar`}
              />
              <label
                htmlFor="avatar"
                className="absolute bottom-[10%] text-sm  gap-1.5 right-[50%] translate-1/2 w-full h-8 bg-black/50 text-white rounded flex items-center justify-center cursor-pointer"
              >
                <SquarePen className="w-4 h-4" /> Edit
              </label>
              <input
                onChange={(e) => setAvatar(e.target.files?.[0])}
                type="file"
                name="avatar"
                id="avatar"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
            </div>
          </div>
          {/* Personal Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700"
                >
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  id="firstName"
                  defaultValue={user.firstName}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    actionData?.fieldErrors?.firstName ? "border-red-500" : ""
                  }`}
                  required
                />
                {actionData?.fieldErrors?.firstName && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.fieldErrors.firstName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  id="lastName"
                  defaultValue={user.lastName}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    actionData?.fieldErrors?.lastName ? "border-red-500" : ""
                  }`}
                  required
                />
                {actionData?.fieldErrors?.lastName && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.fieldErrors.lastName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  defaultValue={user.email}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    actionData?.fieldErrors?.email ? "border-red-500" : ""
                  }`}
                  required
                />
                {actionData?.fieldErrors?.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700"
                >
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  defaultValue={user.phone}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    actionData?.fieldErrors?.phone ? "border-red-500" : ""
                  }`}
                  required
                />
                {actionData?.fieldErrors?.phone && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.fieldErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="dob"
                  className="block text-sm font-medium text-gray-700"
                >
                  Date of Birth *
                </label>
                <input
                  type="date"
                  name="dob"
                  id="dob"
                  defaultValue={formatDateForInput(user.dob)}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    actionData?.fieldErrors?.dob ? "border-red-500" : ""
                  }`}
                  required
                />
                {actionData?.fieldErrors?.dob && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.fieldErrors.dob}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="joinDate"
                  className="block text-sm font-medium text-gray-700"
                >
                  Join Date *
                </label>
                <input
                  type="date"
                  name="joinDate"
                  id="joinDate"
                  defaultValue={formatDateForInput(user.joinDate)}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    actionData?.fieldErrors?.joinDate ? "border-red-500" : ""
                  }`}
                  required
                />
                {actionData?.fieldErrors?.joinDate && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.fieldErrors.joinDate}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="nationalId"
                  className="block text-sm font-medium text-gray-700"
                >
                  National ID
                </label>
                <input
                  type="text"
                  name="nationalId"
                  id="nationalId"
                  defaultValue={user.nationalId || ""}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <input
                  type="text"
                  name="password"
                  id="password"
                  defaultValue={user.password || ""}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Address
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label
                  htmlFor="street"
                  className="block text-sm font-medium text-gray-700"
                >
                  Street Address *
                </label>
                <input
                  type="text"
                  name="street"
                  id="street"
                  defaultValue={user.address.street}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="block text-sm font-medium text-gray-700"
                >
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  id="city"
                  defaultValue={user.address.city}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="state"
                  className="block text-sm font-medium text-gray-700"
                >
                  State/Province *
                </label>
                <input
                  type="text"
                  name="state"
                  id="state"
                  defaultValue={user.address.state}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="postalCode"
                  className="block text-sm font-medium text-gray-700"
                >
                  Postal Code *
                </label>
                <input
                  type="text"
                  name="postalCode"
                  id="postalCode"
                  defaultValue={user.address.postalCode}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="country"
                  className="block text-sm font-medium text-gray-700"
                >
                  Country *
                </label>
                <select
                  name="country"
                  id="country"
                  defaultValue={user.address.country}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value={user.address.country}>
                    {
                      countries.find(
                        (country) => country.value === user.address.country
                      )?.label
                    }
                  </option>
                  {countries.map((country) => (
                    <option key={country.value} value={country.label}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Account Settings */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Account Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="accountType"
                  className="block text-sm font-medium text-gray-700"
                >
                  Account Type
                </label>
                <select
                  name="accountType"
                  id="accountType"
                  defaultValue={user.account.type}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="business">Business</option>
                  <option value="student">Student</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="currency"
                  className="block text-sm font-medium text-gray-700"
                >
                  Currency
                </label>
                <select
                  name="currency"
                  id="currency"
                  defaultValue={user.account.currency}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                 {currencyOptions.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="balance"
                  className="block text-sm font-medium text-gray-700"
                >
                  Account Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="balance"
                  id="balance"
                  defaultValue={user.account.balance}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    actionData?.fieldErrors?.balance ? "border-red-500" : ""
                  }`}
                />
                {actionData?.fieldErrors?.balance && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.fieldErrors.balance}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="accountStatus"
                  className="block text-sm font-medium text-gray-700"
                >
                  Account Status
                </label>
                <select
                  name="accountStatus"
                  id="accountStatus"
                  defaultValue={user.account.status}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="dormant">Dormant</option>
                  <option value="frozen">Frozen</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security & Verification */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Security & Verification
            </h2>
            <div className="space-y-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isVerified"
                  id="isVerified"
                  defaultChecked={user.isVerified}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="isVerified"
                  className="ml-2 block text-sm text-gray-900"
                >
                  User is verified
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isSuspended"
                  id="isSuspended"
                  defaultChecked={user.isSuspended}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="isSuspended"
                  className="ml-2 block text-sm text-gray-900"
                >
                  User is suspended
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="twoFactorEnabled"
                  id="twoFactorEnabled"
                  defaultChecked={user.security.twoFactorEnabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="twoFactorEnabled"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Two-factor authentication enabled
                </label>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Notification Preferences
            </h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="emailNotifications"
                  id="emailNotifications"
                  defaultChecked={user.notifications.email}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="emailNotifications"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Email notifications
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="smsNotifications"
                  id="smsNotifications"
                  defaultChecked={user.notifications.sms}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="smsNotifications"
                  className="ml-2 block text-sm text-gray-900"
                >
                  SMS notifications
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="pushNotifications"
                  id="pushNotifications"
                  defaultChecked={user.notifications.push}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="pushNotifications"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Push notifications
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="sendOtp"
                  id="sendOtp"
                  defaultChecked={user.notifications.sendOtp}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="pushNotifications"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Send Transfer OTP
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="requestOtp"
                  id="requestOtp"
                  defaultChecked={user.notifications.requestOtp}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="pushNotifications"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Request Transfer OTP
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="sendEmailReceipt"
                  id="sendEmailReceipt"
                  defaultChecked={user.notifications.sendEmailReceipt}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="pushNotifications"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Send Email Receipt
                </label>
              </div>
            </div>
          </div>

          {/* Sensitive Information Toggle */}
          <div className="bg-white shadow rounded-lg p-6 border-l-4 border-yellow-400">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Sensitive Information
                </h2>
                <p className="text-sm text-gray-600">
                  Banking details and security information
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-yellow-200 transition-colors"
              >
                {showSensitiveInfo ? "Hide" : "Show"} Details
              </button>
            </div>

            {showSensitiveInfo && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-yellow-700">
                      Account Number
                    </label>
                    <p className="mt-1 text-sm text-yellow-900 font-mono">
                      *** Readonly ***
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700">
                      Routing Number
                    </label>
                    <p className="mt-1 text-sm text-yellow-900 font-mono">
                      *** Readonly ***
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700">
                      SWIFT/BIC
                    </label>
                    <p className="mt-1 text-sm text-yellow-900 font-mono">
                      *** Readonly ***
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-yellow-700">
                      IBAN
                    </label>
                    <p className="mt-1 text-sm text-yellow-900 font-mono">
                      *** Readonly ***
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-yellow-100 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Banking identifiers are
                    auto-generated and cannot be modified through this form for
                    security reasons.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <span className="text-red-500">*</span> Required fields
              </div>
              <div className="flex space-x-4">
                <Link
                  to={`/admin/user/${user._id}`}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    isSubmitting
                      ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default AdminEditUser;
