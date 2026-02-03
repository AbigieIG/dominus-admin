import {
  useLoaderData,
  useActionData,
  useSearchParams,
  Link,
  useNavigate,
  useNavigation,
  Form,
  type MetaFunction,
} from "react-router";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  X,
  Edit3,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import CustomSelect from "~/components/customSelect";
import TransactionReceipt from "~/components/receipt";
import { TransactionType } from "~/types";

type TransactionTypeValue =
  (typeof TransactionType)[keyof typeof TransactionType];
import { transactionService } from "~/utils/transactions.server";
import type { Route } from "./+types/transactions";
import { getTransactionModel } from "~/models/transaction.server";

// Updated types to match database structure
type PopulatedAccount = {
  _id?: string;
  firstName: string;
  lastName: string;
  account: {
    number: string;
  };
};

type DatabaseTransaction = {
  _id: string;
  type: TransactionTypeValue;
  amount: number;
  currency: string;
  description: string;
  status: "completed" | "pending" | "failed";
  reference: string;
  createdAt: string;
  updatedAt: string;
  fromAccount: PopulatedAccount;
  toAccount?: PopulatedAccount;
};

type LoaderData = {
  transaction?: DatabaseTransaction;
  transactions: DatabaseTransaction[];
  currentUserId: string;
  filters: {
    type: string | null;
    category: string | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type ActionData = {
  success: boolean;
  error?: boolean;
  message: string;
  downloadUrl?: string;
} | null;

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Transactions | ${settings.site.title}`},
  ];
};

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const { userId } = params;
    const url = new URL(request.url);

    // Check if we're viewing a specific transaction
    const transactionId = url.searchParams.get("transactionId");

    if (transactionId) {
      const transactionResult = await transactionService.getTransactionById(
        transactionId,
        userId
      );
      if (transactionResult.success) {
        return Response.json({
          transaction: transactionResult.data,
          transactions: [],
          currentUserId: userId,
          filters: {},
          pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        });
      }
    }

    const page = Number(url.searchParams.get("page")) || 1;
    const limit = Number(url.searchParams.get("limit")) || 20;
    const typeParam = url.searchParams.get("type");
    const type = typeParam
      ? TransactionType[typeParam.toUpperCase() as keyof typeof TransactionType]
      : undefined;

    const result = await transactionService.getTransactionHistory(
      userId,
      limit,
      page,
      type
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return Response.json({
      transaction: undefined,
      transactions: result.data || [],
      currentUserId: userId,
      filters: {
        type: url.searchParams.get("type"),
        category: null, // Not used in database structure
        status: url.searchParams.get("status"),
        startDate: url.searchParams.get("startDate"),
        endDate: url.searchParams.get("endDate"),
      },
      pagination: result.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
    });
  } catch (error: any) {
    console.error("Transaction history error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to load transactions",
      },
      { status: 500 }
    );
  }
}

// Action function for exporting transactions
export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const transactionId = formData.get("transactionId");
  const { userId } = params;

  if (intent === "export") {
    const format = formData.get("format");

    return Response.json({
      success: true,
      message: `Export to ${format} requested`,
      downloadUrl: "#", // Would be a real download URL
    });
  }
if (intent === "delete-transaction") {
  const Trans = await getTransactionModel();

  const trans = await Trans.findByIdAndDelete(transactionId); 

  if (!trans) {
    return Response.json({
      error: true,
      message: "Transaction not found",
    });
  }

  return Response.json({
    success: true,
    message: `Transaction deleted successfully`,
  });
}

  return null;
}

export default function HistoryPage() {
  const { transaction, transactions, currentUserId, filters, pagination } =
    useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  // For filter form
  const [filterForm, setFilterForm] = useState({
    type: filters?.type || "",
    status: filters?.status || "",
    startDate: filters?.startDate || "",
    endDate: filters?.endDate || "",
  });

  // Reset all filters
  const resetFilters = () => {
    setFilterForm({
      type: "",
      status: "",
      startDate: "",
      endDate: "",
    });
    const params = new URLSearchParams();
    setSearchParams(params);
  };

  // Apply filters
  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filterForm.type) params.set("type", filterForm.type);
    if (filterForm.status) params.set("status", filterForm.status);
    if (filterForm.startDate) params.set("startDate", filterForm.startDate);
    if (filterForm.endDate) params.set("endDate", filterForm.endDate);
    setSearchParams(params);
    setShowFilters(false);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format amount with currency
  const formatAmount = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  // Helper function to determine if transaction is credit or debit for current user
  const getTransactionDirection = (transaction: DatabaseTransaction) => {
    const isFromCurrentUser =
      transaction.fromAccount._id?.toString() === currentUserId ||
      transaction.fromAccount.toString() === currentUserId;

    if (transaction.type === TransactionType.DEPOSIT) {
      return { direction: "credit", label: "Deposit" };
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      return { direction: "debit", label: "Withdrawal" };
    } else if (transaction.type === TransactionType.TRANSFER) {
      return isFromCurrentUser
        ? { direction: "debit", label: "Transfer Sent" }
        : { direction: "credit", label: "Transfer Received" };
    } else if (transaction.type === TransactionType.PAYPAL) {
      return isFromCurrentUser
        ? { direction: "debit", label: "PayPal Transferred" }
        : { direction: "credit", label: "PayPal Received" };
    }

    if (transaction.type === TransactionType.WIRE_TRANSFER) {
      return isFromCurrentUser
        ? { direction: "debit", label: "Wire Transfer Sent" }
        : { direction: "credit", label: "Wire Transfer Received" };
    }

    return { direction: "debit", label: "Transaction" };
  };

  // Get the other party's name for display
  const getOtherPartyName = (transaction: DatabaseTransaction) => {
    const isFromCurrentUser =
      transaction.fromAccount._id?.toString() === currentUserId ||
      transaction.fromAccount.toString() === currentUserId;

    if (transaction.type === TransactionType.DEPOSIT) {
      return "Bank Deposit";
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      return "Bank Withdrawal";
    } else if (
      transaction.type === TransactionType.TRANSFER &&
      transaction.toAccount
    ) {
      const otherParty = isFromCurrentUser
        ? transaction.toAccount
        : transaction.fromAccount;
      return `${otherParty.firstName} ${otherParty.lastName}`;
    }

    return "Bank";
  };

  const getTransactionDescription = (transaction: DatabaseTransaction) => {
    const isFromCurrentUser =
      transaction.fromAccount._id?.toString() === currentUserId ||
      transaction.fromAccount.toString() === currentUserId;

    if (transaction.type === TransactionType.DEPOSIT) {
      return transaction.description;
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      return transaction.description;
    } else if (
      transaction.type === TransactionType.TRANSFER &&
      transaction.toAccount
    ) {
      const otherParty = isFromCurrentUser
        ? transaction.toAccount
        : transaction.fromAccount;
      return `Transfer ${isFromCurrentUser ? "to" : "from"} ${otherParty.firstName} ${otherParty.lastName}`;
    } else if (transaction.type === TransactionType.PAYPAL) {
      return transaction.description;
    } else if (transaction.type === TransactionType.WIRE_TRANSFER) {
      return transaction.description;
    }

    return transaction.description || "Bank";
  };

  if (transaction) {
    return (
      <TransactionReceipt
        transaction={transaction}
        currentUserId={currentUserId}
        onBack={() => typeof window !== "undefined" && window.history.back()}
        onDownloadReceipt={() => {
          // Your download logic here
          console.log("Download receipt for:", transaction._id);
        }}
      />
    );
  }

  // Transaction list view
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Transaction History
          </h1>
          <p className="text-slate-600">
            View and manage your transaction history
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          {(filters?.type ||
            filters?.status ||
            filters?.startDate ||
            filters?.endDate) && (
            <button
              onClick={resetFilters}
              className="flex items-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium"
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Filter Transactions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <CustomSelect
                id="type"
                name="type"
                value={filterForm.type}
                placeholder="All Types"
                options={[
                  { value: "", label: "All Types" },
                  { value: TransactionType.TRANSFER, label: "Transfer" },
                  { value: TransactionType.DEPOSIT, label: "Deposit" },
                  { value: TransactionType.WITHDRAWAL, label: "Withdrawal" },
                  { value: TransactionType.PAYPAL, label: "PayPal" },
                  {
                    value: TransactionType.WIRE_TRANSFER,
                    label: "Wire Transfer",
                  },
                ]}
                onChange={(e) => setFilterForm({ ...filterForm, type: e })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <CustomSelect
                id="status"
                name="status"
                value={filterForm.status}
                onChange={(e) => setFilterForm({ ...filterForm, status: e })}
                placeholder="All Statuses"
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "completed", label: "Completed" },
                  { value: "pending", label: "Pending" },
                  { value: "failed", label: "Failed" },
                ]}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                name="startDate"
                value={filterForm.startDate}
                onChange={(e) =>
                  setFilterForm({ ...filterForm, startDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                name="endDate"
                value={filterForm.endDate}
                onChange={(e) =>
                  setFilterForm({ ...filterForm, endDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => setShowFilters(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={applyFilters}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Transactions list */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {pagination.total} Transactions
            </h3>
            <p className="text-sm text-slate-600">
              Page {pagination.page} of {pagination.pages}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/admin/create-trans/${currentUserId}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Create
            </button>
          </div>
        </div>

        {actionData?.success && (
          <div className="bg-green-100 text-green-800 p-3 border-b border-green-200">
            {actionData.message}
          </div>
        )}
        {actionData?.error && (
          <div className="bg-green-100 text-green-800 p-3 border-b border-green-200">
            {actionData?.message}
          </div>
        )}

        <div className="divide-y divide-slate-200">
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              No transactions found matching your filters
            </div>
          ) : (
            transactions.map((transaction) => {
              const transactionDirection = getTransactionDirection(transaction);
              const desc = getTransactionDescription(transaction);

              return (
                <Link
                  key={transaction._id}
                  to={`?transactionId=${transaction._id}`}
                  className="block p-6 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`p-3 rounded-lg ${
                          transactionDirection.direction === "credit"
                            ? "bg-green-100 text-green-600"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {transactionDirection.direction === "credit" ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownLeft className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 line-clamp-1">
                          {desc}
                        </p>
                        <p className="text-sm text-slate-500 line-clamp-1">
                          <span className="hidden md:inline">
                            {transaction.type === "wire_transfer"
                              ? "Wire Transfer"
                              : transaction.type}
                          </span>{" "}
                          • {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          transactionDirection.direction === "credit"
                            ? "text-green-600"
                            : "text-slate-900"
                        }`}
                      >
                        {transactionDirection.direction === "credit"
                          ? "+"
                          : "-"}
                        {formatAmount(transaction.amount, transaction.currency)}
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          transaction.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : transaction.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex justify-end space-x-2"
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/admin/edit-trans/${transaction._id}`);
                      }}
                      className="text-gray-600 hover:text-gray-900"
                      title="Edit User"
                    >
                      <Edit3 size={16} />
                    </button>
                    <Form method="post">
                      <input type="hidden" name="transactionId" value={transaction._id} className="hidden" />
                        <input type="hidden" name="intent" value="delete-transaction" className="hidden" />
                      <button
                        type="submit"
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete User"
                      >
                        {isSubmitting ? "loading..." : <Trash2 size={16} />}
                      </button>
                    </Form>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-700">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} results
              </p>
              <div className="flex space-x-2">
                {pagination.page > 1 && (
                  <Link
                    to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page - 1) })}`}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    Previous
                  </Link>
                )}
                {pagination.page < pagination.pages && (
                  <Link
                    to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page + 1) })}`}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
