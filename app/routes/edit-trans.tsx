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
  getTransactionModel,
  type ITransaction,
} from "~/models/transaction.server";

import {
  type ITransaction as Trans,
  TransactionType,
  TransactionStatus,
} from "~/types";

type ActionData = {
  errors?: Record<string, string>;
  success?: string;
  error?: string;
};

type LoaderData = {
  transaction: Trans & {
    _id: string;
    fromAccount: string;
    toAccount?: string;
    initiatedBy: string;
    createdAt: string;
  };
};

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Edit Transaction | ${settings.site.title}`},
  ];
};

// Helper function to extract metadata from FormData
function extractMetadata(formData: FormData): Record<string, any> {
  const metadata: Record<string, any> = {};
  
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('metadata.')) {
      const metadataKey = key.replace('metadata.', '');
      if (value && value.toString().trim()) {
        metadata[metadataKey] = value.toString().trim();
      }
    }
  }
  
  return metadata;
}

// Loader function to fetch transaction data
export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    throw new Response("Transaction ID is required", { status: 400 });
  }

  try {
    const TransactionModel = await getTransactionModel();
    const transaction = await TransactionModel.findById(id).lean();

    if (!transaction) {
      throw new Response("Transaction not found", { status: 404 });
    }

    // Convert ObjectIds to strings for serialization
    const serializedTransaction = {
      ...transaction,
      _id: transaction._id.toString(),
      fromAccount: transaction.fromAccount.toString(),
      toAccount: transaction.toAccount?.toString(),
      initiatedBy: transaction.initiatedBy.toString(),
      createdAt: transaction.createdAt.toISOString(),
    };

    return Response.json({ transaction: serializedTransaction });
  } catch (error) {
    console.error("Error loading transaction:", error);
    throw new Response("Failed to load transaction", { status: 500 });
  }
}

// Action function to handle form submission
export async function action({ request, params }: ActionFunctionArgs) {
  const { id } = params;

  if (!id) {
    return Response.json(
      { error: "Transaction ID is required" },
      { status: 400 }
    );
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid transaction ID" }, { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    try {
      const TransactionModel = await getTransactionModel();
      await TransactionModel.findByIdAndDelete(id);
      return redirect("/admin");
    } catch (error) {
      console.error("Error deleting transaction:", error);
      return Response.json(
        { error: "Failed to delete transaction" },
        { status: 500 }
      );
    }
  }

  // Validate form data
  const type = formData.get("type") as TransactionType;
  const amount = parseFloat(formData.get("amount") as string);
  const currency = formData.get("currency") as string;
  const description = formData.get("description") as string;
  const status = formData.get("status") as TransactionStatus;
  const fromAccount = formData.get("fromAccount") as string;
  const toAccount = formData.get("toAccount") as string;
  
  // Extract metadata
  const metadata = extractMetadata(formData);

  const errors: Record<string, string> = {};

  if (!type || !Object.values(TransactionType).includes(type)) {
    errors.type = "Valid transaction type is required";
  }

  if (!amount || amount <= 0) {
    errors.amount = "Amount must be greater than 0";
  }

  if (!currency?.trim()) {
    errors.currency = "Currency is required";
  }

  if (!description?.trim()) {
    errors.description = "Description is required";
  }

  if (!status || !Object.values(TransactionStatus).includes(status)) {
    errors.status = "Valid status is required";
  }

  if (!fromAccount?.trim() || !mongoose.Types.ObjectId.isValid(fromAccount)) {
    errors.fromAccount = "Valid from account is required";
  }

  if (toAccount && !mongoose.Types.ObjectId.isValid(toAccount)) {
    errors.toAccount = "Invalid to account ID";
  }

  if (Object.keys(errors).length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  try {
    const TransactionModel = await getTransactionModel();

    const updateData: Partial<ITransaction> = {
      type,
      amount,
      currency,
      description,
      status,
      fromAccount: new mongoose.Types.ObjectId(fromAccount),
      ...(toAccount && { toAccount: new mongoose.Types.ObjectId(toAccount) }),
      // Include metadata in update
      ...(Object.keys(metadata).length > 0 && { metadata }),
    };

    await TransactionModel.findByIdAndUpdate(id, updateData, { new: true });

    return Response.json({ success: "Transaction updated successfully" });
  } catch (error) {
    console.error("Error updating transaction:", error);
    return Response.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export default function EditTransaction() {
  const { transaction } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";
  const isDeleting = navigation.formData?.get("intent") === "delete";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Edit Transaction
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Reference: {transaction.reference}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    transaction.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : transaction.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : transaction.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : transaction.status === "processing"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {transaction.status.charAt(0).toUpperCase() +
                    transaction.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Success/Error Messages */}
          {actionData?.success && (
            <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 text-sm">{actionData.success}</p>
            </div>
          )}

          {actionData?.error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{actionData.error}</p>
            </div>
          )}

          {/* Form */}
          <div className="px-6 py-6">
            <Form method="post" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Transaction Type */}
                <div>
                  <label
                    htmlFor="type"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Transaction Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    defaultValue={transaction.type}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.values(TransactionType).map((type) => (
                      <option key={type} value={type}>
                        {type
                          .replace("_", " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  {actionData?.errors?.type && (
                    <p className="mt-1 text-sm text-red-600">
                      {actionData.errors.type}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={transaction.status}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.values(TransactionStatus).map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                  {actionData?.errors?.status && (
                    <p className="mt-1 text-sm text-red-600">
                      {actionData.errors.status}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label
                    htmlFor="amount"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Amount
                  </label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    step="0.01"
                    min="0"
                    defaultValue={transaction.amount}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {actionData?.errors?.amount && (
                    <p className="mt-1 text-sm text-red-600">
                      {actionData.errors.amount}
                    </p>
                  )}
                </div>

                {/* Currency */}
                <div>
                  <label
                    htmlFor="currency"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Currency
                  </label>
                  <input
                    type="text"
                    id="currency"
                    name="currency"
                    defaultValue={transaction.currency}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="USD"
                    required
                  />
                  {actionData?.errors?.currency && (
                    <p className="mt-1 text-sm text-red-600">
                      {actionData.errors.currency}
                    </p>
                  )}
                </div>

                {/* From Account */}
                <div>
                  <label
                    htmlFor="fromAccount"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    From Account ID
                  </label>
                  <input
                    type="text"
                    id="fromAccount"
                    name="fromAccount"
                    defaultValue={transaction.fromAccount}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {actionData?.errors?.fromAccount && (
                    <p className="mt-1 text-sm text-red-600">
                      {actionData.errors.fromAccount}
                    </p>
                  )}
                </div>

                {/* To Account */}
                <div>
                  <label
                    htmlFor="toAccount"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    To Account ID (Optional)
                  </label>
                  <input
                    type="text"
                    id="toAccount"
                    name="toAccount"
                    defaultValue={transaction.toAccount || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {actionData?.errors?.toAccount && (
                    <p className="mt-1 text-sm text-red-600">
                      {actionData.errors.toAccount}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={transaction.description}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {actionData?.errors?.description && (
                  <p className="mt-1 text-sm text-red-600">
                    {actionData.errors.description}
                  </p>
                )}
              </div>

              {/* Metadata Section */}
              {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
                <div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">
                      Metadata
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(transaction.metadata).map(
                        ([key, value]) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                            </label>
                            <input
                              type="text"
                              name={`metadata.${key}`}
                              defaultValue={value as string}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder={`Enter ${key}`}
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction Info */}
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Transaction Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(transaction.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Initiated By:</span>{" "}
                    {transaction.initiatedBy}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  name="intent"
                  value="delete"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    if (
                      !confirm(
                        "Are you sure you want to delete this transaction? This action cannot be undone."
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  {isDeleting ? "Deleting..." : "Delete Transaction"}
                </button>

                <div className="flex items-center space-x-3">
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
                    {isSubmitting && !isDeleting
                      ? "Updating..."
                      : "Update Transaction"}
                  </button>
                </div>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};