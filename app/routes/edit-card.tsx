import { useState, useEffect } from "react";
import { Form, useActionData, useNavigation, useLoaderData } from "react-router";
import {
  CalendarDays,
  MapPin,
  Building,
  DollarSign,
  Edit3,
  Save,
  X,
} from "lucide-react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { CardService } from "~/utils/card.server";

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Edit Card | ${settings.site.title}`},
  ];
};
// Types based on your code
export enum TransactionType {
  PURCHASE = "purchase",
  ATM_WITHDRAWAL = "atm_withdrawal",
  ONLINE_PAYMENT = "online_payment",
  TRANSFER = "transfer",
  REFUND = "refund",
  FEE = "fee",
}

interface TransactionFormData {
  amount: number;
  type: TransactionType;
  merchant?: string;
  location?: string;
  currency?: string;
  transactionDate: string;
  status: 'pending' | 'completed' | 'failed';
}

interface Transaction {
  _id: string;
  amount: number;
  type: TransactionType;
  merchant?: string;
  location?: string;
  date: string;
  reference: string;
  status: 'pending' | 'completed' | 'failed';
  currency: string;
}

interface LoaderData {
  transaction: Transaction;
  cardId: string;
  userId: string;
}

// Loader function to get transaction data
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { userId, cardId, transactionId } = params;

  if (!userId || !cardId || !transactionId) {
    console.log("Missing required parameters");
    throw new Response("Missing required parameters", { status: 400 });
  }

  try {
    const cardService = CardService.getInstance();
    const result = await cardService.getTransactionById(cardId, userId, transactionId);

    if (!result.success) {
        console.log("Transaction not found");
      throw new Response("Transaction not found", { status: 404 });
    }

    return Response.json({
      transaction: result.transaction,
      cardId,
      userId,
    });
  } catch (error: any) {
    console.error("Error loading transaction:", error);
    throw new Response(error.message || "Failed to load transaction", { 
      status: error.status || 500 
    });
  }
};

// Action function to handle form submission
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { userId, cardId, transactionId } = params;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (!userId || !cardId || !transactionId) {
    return Response.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const cardService = CardService.getInstance();

    // Handle delete action
    if (intent === "delete") {
      const result = await cardService.deleteTransaction(cardId, userId, transactionId);
      return Response.json({
        success: true,
        message: "Transaction deleted successfully",
        deleted: true,
        result,
      });
    }

    // Handle update action
    const updates = {
      amount: parseFloat(formData.get("amount") as string),
      type: formData.get("type") as TransactionType,
      merchant: (formData.get("merchant") as string) || undefined,
      location: (formData.get("location") as string) || undefined,
      currency: (formData.get("currency") as string) || "USD",
      date: formData.get("transactionDate") as string,
      status: formData.get("status") as 'pending' | 'completed' | 'failed',
    };

    // Validation
    if (!updates.amount || updates.amount <= 0) {
      return Response.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const result = await cardService.editTransaction(cardId, userId, transactionId, updates);

    return Response.json({
      success: true,
      message: "Transaction updated successfully",
      transaction: result.transaction,
      newBalance: result.newBalance,
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
};

export default function EditTransactionForm() {
  const navigation = useNavigation();
  const actionData = useActionData<any>();
  const { transaction, cardId, userId } = useLoaderData<LoaderData>();

  // Form state initialized with existing transaction data
  const [formData, setFormData] = useState<TransactionFormData>({
    amount: transaction.amount,
    type: transaction.type,
    merchant: transaction.merchant || "",
    location: transaction.location || "",
    currency: transaction.currency,
    transactionDate: new Date(transaction.date).toISOString().split("T")[0],
    status: transaction.status,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isSubmitting = navigation.state === "submitting";
  const isDeleting = navigation.formData?.get("intent") === "delete";

  // Transaction type options
  const transactionTypes = [
    { value: TransactionType.PURCHASE, label: "Purchase", icon: "🛍️" },
    {
      value: TransactionType.ATM_WITHDRAWAL,
      label: "ATM Withdrawal",
      icon: "🏧",
    },
    {
      value: TransactionType.ONLINE_PAYMENT,
      label: "Online Payment",
      icon: "💻",
    },
    { value: TransactionType.TRANSFER, label: "Transfer", icon: "↔️" },
    { value: TransactionType.REFUND, label: "Refund", icon: "↩️" },
    { value: TransactionType.FEE, label: "Fee", icon: "💳" },
  ];

  // Currency options
  const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

  // Status options
  const statusOptions = [
    { value: "pending", label: "Pending", color: "text-yellow-600" },
    { value: "completed", label: "Completed", color: "text-green-600" },
    { value: "failed", label: "Failed", color: "text-red-600" },
  ];

  const handleInputChange = (
    field: keyof TransactionFormData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      amount: transaction.amount,
      type: transaction.type,
      merchant: transaction.merchant || "",
      location: transaction.location || "",
      currency: transaction.currency,
      transactionDate: new Date(transaction.date).toISOString().split("T")[0],
      status: transaction.status,
    });
  };

  // Redirect after successful deletion
  useEffect(() => {
    if (actionData?.deleted && actionData?.success) {
      // You can redirect here or show a success message
      window.history.back(); // Go back to previous page
    }
  }, [actionData]);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
              <Edit3 className="w-6 h-6 mr-2" />
              Edit Transaction
            </h2>
            <p className="text-gray-600">
              Update transaction details for reference: {transaction.reference}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Transaction ID</p>
            <p className="text-xs font-mono text-gray-700">{transaction._id}</p>
          </div>
        </div>
      </div>

      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{actionData.error}</p>
        </div>
      )}

      {actionData?.success && !actionData?.deleted && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800">{actionData.message}</p>
          {actionData.newBalance !== undefined && (
            <div className="mt-2 text-sm text-green-700">
              <p>New Account Balance: ${actionData.newBalance.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      <Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="update" />

        {/* Transaction Status */}
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Status *
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={(e) => handleInputChange("status", e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Transaction Type */}
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Transaction Type *
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={(e) =>
              handleInputChange("type", e.target.value as TransactionType)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            {transactionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Amount and Currency */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              <DollarSign className="inline w-4 h-4 mr-1" />
              Amount *
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount || ""}
              onChange={(e) =>
                handleInputChange("amount", parseFloat(e.target.value) || 0)
              }
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label
              htmlFor="currency"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={(e) => handleInputChange("currency", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transaction Date */}
        <div>
          <label
            htmlFor="transactionDate"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            <CalendarDays className="inline w-4 h-4 mr-1" />
            Transaction Date *
          </label>
          <input
            type="date"
            id="transactionDate"
            name="transactionDate"
            value={formData.transactionDate}
            onChange={(e) =>
              handleInputChange("transactionDate", e.target.value)
            }
            max={new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Merchant */}
        <div>
          <label
            htmlFor="merchant"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            <Building className="inline w-4 h-4 mr-1" />
            Merchant
          </label>
          <input
            type="text"
            id="merchant"
            name="merchant"
            value={formData.merchant}
            onChange={(e) => handleInputChange("merchant", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Amazon, Starbucks, Shell Gas Station"
            maxLength={100}
          />
        </div>

        {/* Location */}
        <div>
          <label
            htmlFor="location"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            <MapPin className="inline w-4 h-4 mr-1" />
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={(e) => handleInputChange("location", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., New York, NY or Online"
            maxLength={100}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-6">
          <button
            type="submit"
            disabled={isSubmitting || !formData.amount || formData.amount <= 0}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting && !isDeleting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Save className="w-4 h-4 mr-2" />
                Update Transaction
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-3 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            <X className="w-4 h-4 mr-2 inline" />
            Delete
          </button>
        </div>
      </Form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Delete
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <Form method="post" className="flex-1">
                <input type="hidden" name="intent" value="delete" />
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-red-400 transition-colors"
                >
                  {isDeleting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </div>
                  ) : (
                    "Delete Transaction"
                  )}
                </button>
              </Form>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}