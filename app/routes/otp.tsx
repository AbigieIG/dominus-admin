import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, useActionData, useNavigation, useLoaderData } from "react-router";
import { getOTPSessionModel, otpService } from "~/models/otp.server";
import { getUserModel } from "~/models/user.server";
import type { UserDto } from "~/types";
import settings from "~/assets/settings.json";

type OTPSessionData = {
  sessionToken: string;
  userId: string;
  otpCode: string;
  userEmail?: string;
  userPhone?: string;
  otpExpiry: Date;
  transactionData: any;
  attempts: number;
  maxAttempts: number;
};

type LoaderData = {
  isAdmin: boolean;
  activeSessions: OTPSessionData[];
  users: UserDto[];
  error?: string;
};

type ActionData = {
  result: {
    success: boolean;
    otpCode?: string;
    userId?: string;
    userPhone?: string;
    userEmail?: string;
    message: string;
    attempts?: number;
    maxAttempts?: number;
    otpExpiry?: Date;
    transactionData?: any;
    verified?: boolean;
  };
  actionType: string;
  error?: string;
  success?: boolean;
  message?: string;
};

export const meta: MetaFunction = () => {
  return [
    {title: `OTP | ${settings.site.title}`},
  ];
};

// Loader to get all active OTP sessions
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const OTPSession = await getOTPSessionModel();
    const User = await getUserModel();

    const activeSessions = await OTPSession.find({ verified: false }).exec();
    
    const userIds = activeSessions.map((session) => session.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select('email phone firstName lastName').exec();

    return Response.json({ 
      activeSessions: activeSessions || [],
      users: users || []
    });
  } catch (error) {
    return Response.json({ 
      activeSessions: [],
      users: [],
      error: "Failed to load active sessions" 
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const sessionToken = formData.get("sessionToken") as string;
  const actionType = formData.get("actionType") as string;

  if (!sessionToken) {
    return Response.json({ error: "Session token is required" }, { status: 400 });
  }

  try {
    if (actionType === "resendOTP") {
      const result = await otpService.resendOTP(sessionToken);
      return Response.json({ result, actionType });
    } else if (actionType === "deleteSession") {
      const result = await otpService.cleanupExpiredSessions();
      return Response.json({ result, actionType });
    }
  } catch (error) {
    return Response.json({ error: "Failed to process request" }, { status: 500 });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}

export default function AdminOTPPage() {
  const { users, activeSessions, error } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const isLoading = navigation.state === "submitting";

  const toggleSessionExpansion = (sessionToken: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionToken)) {
      newExpanded.delete(sessionToken);
    } else {
      newExpanded.add(sessionToken);
    }
    setExpandedSessions(newExpanded);
  };

  const getTransactionType = (transactionData: any) => {
    if (transactionData?.type) return transactionData.type;
    if (transactionData?.request?.amount) return 'Transfer';
    return 'Unknown';
  };

  const getTransactionAmount = (transactionData: any) => {
    if (transactionData?.request?.amount) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: transactionData?.request?.currency || 'USD',
      }).format(transactionData.request.amount);
    }
    return 'N/A';
  };

  // Helper function to find user data
  const getUserData = (userId: string) => {
    return users?.find(user => user._id === userId);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                Active OTP Sessions
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Monitor and manage active OTP verification sessions for transactions.
              </p>
            </div>
            <div className="text-center sm:text-right bg-blue-50 p-4 rounded-lg sm:bg-transparent sm:p-0">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                {activeSessions.length}
              </div>
              <div className="text-sm text-gray-500">Active Sessions</div>
            </div>
          </div>
        </div>

        {/* Action Result */}
        {actionData?.result && (
          <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            {actionData.result.success ? (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      {actionData.result.message}
                    </h3>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {actionData.result.message}
                    </h3>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 sm:mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Active Sessions List */}
        {activeSessions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 sm:p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Active Sessions</h3>
            <p className="mt-1 text-sm text-gray-500">There are no active OTP sessions at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeSessions.map((session, index) => {
              const userData = getUserData(session.userId);
              const isExpanded = expandedSessions.has(session.sessionToken);
              const timeRemaining = Math.max(0, Math.ceil((new Date(session.otpExpiry).getTime() - Date.now()) / 60000));
              
              return (
                <div key={session.sessionToken} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="p-4 sm:p-6">
                    {/* Main session info - Mobile optimized */}
                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                      {/* Left side - Transaction info */}
                      <div className="flex items-start space-x-3 sm:space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-xs sm:text-sm">
                              {index + 1}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">
                            {getTransactionType(session.transactionData)}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Amount: {getTransactionAmount(session.transactionData)}
                          </p>
                          {/* User info - visible on mobile */}
                          {userData && (
                            <div className="block sm:hidden mt-2">
                              <p className="text-xs text-gray-600">
                                {userData.firstName && userData.lastName 
                                  ? `${userData.firstName} ${userData.lastName}`
                                  : userData.email
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right side - OTP and controls */}
                      <div className="flex items-center justify-between sm:justify-end space-x-4 bg-gray-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none">
                        {/* OTP Code */}
                        <div className="text-center">
                          <div className="text-xl sm:text-2xl font-mono font-bold text-blue-600 tracking-wider">
                            {session.otpCode}
                          </div>
                          <div className="text-xs text-gray-500">OTP Code</div>
                        </div>
                        
                        {/* Timer */}
                        <div className="text-center">
                          <div className={`text-sm font-medium ${timeRemaining <= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                            {timeRemaining} min
                          </div>
                          <div className="text-xs text-gray-500">Remaining</div>
                        </div>

                        {/* Expand Button */}
                        <button
                          onClick={() => toggleSessionExpansion(session.sessionToken)}
                          className="p-2 text-gray-400 hover:text-gray-600 bg-white sm:bg-transparent rounded-full sm:rounded-none shadow-sm sm:shadow-none"
                          aria-label={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          <svg
                            className={`w-5 h-5 transform transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-6 border-t border-gray-200 pt-6">
                        {/* User Information - Desktop view */}
                        {userData && (
                          <div className="hidden sm:block mb-6 bg-blue-50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">User Information</h4>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                              {userData.firstName && userData.lastName && (
                                <div>
                                  <span className="font-medium text-gray-700">Name:</span>
                                  <p className="text-gray-900">{userData.firstName} {userData.lastName}</p>
                                </div>
                              )}
                              {userData.email && (
                                <div>
                                  <span className="font-medium text-gray-700">Email:</span>
                                  <p className="text-gray-900 break-all">{userData.email}</p>
                                </div>
                              )}
                              {userData.phone && (
                                <div>
                                  <span className="font-medium text-gray-700">Phone:</span>
                                  <p className="text-gray-900">{userData.phone}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Session Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              User ID
                            </label>
                            <div className="text-xs sm:text-sm font-mono text-gray-900 break-all">
                              {session.userId}
                            </div>
                          </div>

                          {session.userEmail && (
                            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Session Email
                              </label>
                              <div className="text-xs sm:text-sm text-gray-900 break-all">
                                {session.userEmail}
                              </div>
                            </div>
                          )}

                          {session.userPhone && (
                            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Session Phone
                              </label>
                              <div className="text-xs sm:text-sm text-gray-900">
                                {session.userPhone}
                              </div>
                            </div>
                          )}

                          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Attempts
                            </label>
                            <div className="text-xs sm:text-sm text-gray-900">
                              <span className={session.attempts >= session.maxAttempts - 1 ? 'text-red-600 font-bold' : ''}>
                                {session.attempts}
                              </span>
                              {' / '}
                              {session.maxAttempts}
                            </div>
                          </div>

                          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Expires At
                            </label>
                            <div className="text-xs sm:text-sm text-gray-900">
                              {new Date(session.otpExpiry).toLocaleString()}
                            </div>
                          </div>

                          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Session Token
                            </label>
                            <div className="text-xs font-mono text-gray-600 break-all">
                              {session.sessionToken.substring(0, 12)}...
                            </div>
                          </div>
                        </div>

                        {/* Transaction Details */}
                        {session.transactionData && (
                          <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Transaction Details
                            </label>
                            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                                {JSON.stringify(session.transactionData, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(session.otpCode);
                              // Better mobile feedback
                              if (window.innerWidth < 640) {
                                const button = event?.target as HTMLButtonElement;
                                const originalText = button.textContent;
                                button.textContent = "Copied!";
                                setTimeout(() => {
                                  button.textContent = originalText;
                                }, 2000);
                              } else {
                                alert("OTP copied to clipboard!");
                              }
                            }}
                            className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy OTP
                          </button>

                          <Form method="post" className="flex-1 sm:flex-initial">
                            <input type="hidden" name="sessionToken" value={session.sessionToken} />
                            <button
                              type="submit"
                              name="actionType"
                              value="resendOTP"
                              disabled={isLoading}
                              className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {isLoading ? "Loading..." : "Resend OTP"}
                            </button>
                          </Form>

                          <Form method="post" className="flex-1 sm:flex-initial">
                            <input type="hidden" name="sessionToken" value={session.sessionToken} />
                            <button
                              type="submit"
                              name="actionType"
                              value="deleteSession"
                              disabled={isLoading}
                              onClick={(e) => {
                                if (!confirm("Are you sure you want to delete this session?")) {
                                  e.preventDefault();
                                }
                              }}
                              className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition-colors flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              {isLoading ? "Loading..." : "Delete Session"}
                            </button>
                          </Form>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-refresh notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Real-time Monitoring
              </h3>
              <p className="text-xs sm:text-sm text-blue-700 mt-1">
                This page shows all active OTP sessions. Refresh the page to see the latest status of verification sessions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}