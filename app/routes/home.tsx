import React, { useState } from "react";
import {
  Users,
  Search,
  Filter,
  Edit3,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import type { UserDto } from "~/types";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  type LoaderFunction,
  type MetaFunction,
} from "react-router";
import { AdminUserManagementService } from "~/services/user.server";

import settings from "~/assets/settings.json";
export const meta: MetaFunction = () => {
  return [{ title: `Dashboard | ${settings.site.title}` }];
};
// Loader function to fetch users
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const accountType = url.searchParams.get("accountType") || "";

  const filters: any = {};
  if (status && status !== "all") {
    filters.accountStatus = status;
  }
  if (accountType && accountType !== "all") {
    filters.accountType = accountType;
  }
  if (search) {
    filters.email = search;
  }

  try {
    const usersData = await AdminUserManagementService.getAllUsers(filters, {
      page,
      limit,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    // Get user stats
    const stats = await AdminUserManagementService.getUserStats();

    return Response.json({ usersData, stats });
  } catch (error) {
    console.error("Error loading users:", error);
    return {
      error: error,
      usersData: {
        users: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
      stats: { overview: {}, accountTypes: [], currencies: [] },
    };
  }
};

export const action = async ({ request }: { request: Request }) => {
  const formData = await request.formData();
  const userId = formData.get("userId") as string;

  try {
    const response = await AdminUserManagementService.deleteUser(userId);
    return { success: response.success, message: response.message };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { error: error };
  }
};

interface LoaderData {
  usersData: {
    users: UserDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  stats: {
    overview: any;
    accountTypes: any[];
    currencies: any[];
  };
  error?: string;
}

const AdminUsersPage = () => {
  const { usersData, stats, error } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting";

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Handle search
  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (accountTypeFilter !== "all")
      params.set("accountType", accountTypeFilter);
    params.set("page", "1");

    navigate(`?${params.toString()}`);
    setShowMobileFilters(false);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", page.toString());
    navigate(`?${params.toString()}`);
  };

  // Handle Enter key in search
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Get stats from overview
  const totalUsers = stats.overview?.totalUsers || 0;
  const activeUsers = stats.overview?.activeAccounts || 0;
  const verifiedUsers = stats.overview?.verifiedUsers || 0;
  const unverifiedUsers = stats.overview?.unverifiedUsers || 0;

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      frozen: "bg-red-100 text-red-800",
      dormant: "bg-yellow-100 text-yellow-800",
      closed: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (date === undefined) {
      return "";
    }
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="flex items-center space-x-3 text-red-600 mb-4">
            <AlertCircle size={24} />
            <h2 className="text-lg font-semibold">Error Loading Users</h2>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className=" ">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                  Total Users
                </p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {totalUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                  Active Users
                </p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {activeUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                  Verified
                </p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {verifiedUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
              </div>
              <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                  Unverified
                </p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {unverifiedUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            {/* Mobile Filter Toggle */}
            <div className="flex items-center justify-between mb-4 sm:hidden">
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Filter size={16} className="mr-2" />
                Filters
                {showMobileFilters ? (
                  <X size={16} className="ml-2" />
                ) : (
                  <Menu size={16} className="ml-2" />
                )}
              </button>
              <p className="text-sm text-gray-700">
                {usersData.pagination.total.toLocaleString()} users
              </p>
            </div>

            {/* Desktop Filters */}
            <div className="hidden sm:flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative w-full sm:w-auto">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                  <div className="flex items-center space-x-2">
                    <Filter size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-500">Filter by:</span>
                  </div>
                  <div className="flex space-x-2 w-full sm:w-auto">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 sm:flex-initial"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="frozen">Frozen</option>
                      <option value="dormant">Dormant</option>
                      <option value="closed">Closed</option>
                    </select>

                    <select
                      value={accountTypeFilter}
                      onChange={(e) => setAccountTypeFilter(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 sm:flex-initial"
                    >
                      <option value="all">All Types</option>
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSearch}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Search
                </button>
              </div>

              <p className="text-sm text-gray-700">
                Showing{" "}
                {(usersData.pagination.page - 1) * usersData.pagination.limit +
                  1}
                -
                {Math.min(
                  usersData.pagination.page * usersData.pagination.limit,
                  usersData.pagination.total,
                )}{" "}
                of {usersData.pagination.total.toLocaleString()} users
              </p>
            </div>

            {/* Mobile Filters */}
            {showMobileFilters && (
              <div className="sm:hidden space-y-4">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="frozen">Frozen</option>
                    <option value="dormant">Dormant</option>
                    <option value="closed">Closed</option>
                  </select>

                  <select
                    value={accountTypeFilter}
                    onChange={(e) => setAccountTypeFilter(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="business">Business</option>
                  </select>
                </div>

                <button
                  onClick={handleSearch}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Apply Filters
                </button>
              </div>
            )}
          </div>

          {/* Users Table - Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Join Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersData.users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No users found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  usersData.users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img
                              className="w-10 h-10 rounded-full object-cover"
                              src={
                                user.avatar?.url ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`,
                                )}&background=0ea5e9&color=fff&size=200`
                              }
                              alt={`${user.firstName} ${user.lastName} avatar`}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                            {!user.isVerified && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                                Unverified
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-mono">
                          {user.account?.number || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500 capitalize">
                          {user.account?.type || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.account?.balance !== undefined
                            ? formatCurrency(
                                user.account.balance,
                                user.account.currency,
                              )
                            : "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span>
                          {user.isSuspended ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              suspended
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.account?.status
                                  ? getStatusColor(user.account.status)
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.account?.status || "Unknown"}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.joinDate || "")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => navigate(`/admin/user/${user._id}`)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/admin/edit/${user._id}`)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Edit User"
                          >
                            <Edit3 size={16} />
                          </button>
                          <fetcher.Form method="post">
                            <input
                              type="hidden"
                              name="userId"
                              value={user._id}
                            />
                            <button
                              type="submit"
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete User"
                            >
                              {isSubmitting ? (
                                "deleting.."
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </fetcher.Form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Users Cards - Mobile & Tablet */}
          <div className="md:hidden">
            {usersData.users.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No users found matching your criteria.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {usersData.users.map((user) => (
                  <div key={user._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img
                            className="w-10 h-10 rounded-full object-cover"
                            src={
                              user.avatar?.url ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`,
                              )}&background=0ea5e9&color=fff&size=200`
                            }
                            alt={`${user.firstName} ${user.lastName} avatar`}
                          />
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        <button
                          onClick={() => navigate(`/admin/user/${user._id}`)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/edit/${user._id}/`)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="Edit User"
                        >
                          <Edit3 size={16} />
                        </button>
                        <fetcher.Form method="post">
                          <input type="hidden" name="userId" value={user._id} />
                          <button
                            type="submit"
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete User"
                          >
                            {isSubmitting ? "deleting.." : <Trash2 size={16} />}
                          </button>
                        </fetcher.Form>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Account:</span>
                        <div className="font-mono text-gray-900">
                          {user.account?.number || "N/A"}
                        </div>
                        <div className="text-gray-500 capitalize">
                          {user.account?.type || "N/A"}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Balance:</span>
                        <div className="font-medium text-gray-900">
                          {user.account?.balance !== undefined
                            ? formatCurrency(
                                user.account.balance,
                                user.account.currency,
                              )
                            : "N/A"}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <div className="mt-1">
                          {user.isSuspended ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Suspended
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                user.account?.status
                                  ? getStatusColor(user.account.status)
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.account?.status || "Unknown"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Joined:</span>
                        <div className="text-gray-900">
                          {formatDate(user.joinDate || "")}
                        </div>
                      </div>
                    </div>

                    {!user.isVerified && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Unverified
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {usersData.pagination.totalPages > 1 && (
            <div className="px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
              <button
                onClick={() => handlePageChange(usersData.pagination.page - 1)}
                disabled={!usersData.pagination.hasPrev}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center sm:justify-start"
              >
                <ChevronLeft size={16} className="mr-1" />
                Previous
              </button>

              <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
                {Array.from(
                  { length: Math.min(5, usersData.pagination.totalPages) },
                  (_, i) => {
                    const page = Math.max(1, usersData.pagination.page - 2) + i;
                    if (page > usersData.pagination.totalPages) return null;

                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-2 sm:px-3 py-2 text-sm font-medium rounded-md ${
                          usersData.pagination.page === page
                            ? "text-blue-600 bg-blue-50 border border-blue-300"
                            : "text-gray-500 bg-white border border-gray-300 hover:text-gray-700"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  },
                )}
              </div>

              <button
                onClick={() => handlePageChange(usersData.pagination.page + 1)}
                disabled={!usersData.pagination.hasNext}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center sm:justify-start"
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUsersPage;
