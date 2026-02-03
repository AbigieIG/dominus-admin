import { useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import {
  CalendarDays,
  MapPin,
  Building,
  DollarSign,
} from "lucide-react";
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { CardService } from "~/utils/card.server";
import currencyOptions from '~/assets/currency.json'; 

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
  cardId: string;
  amount: number;
  type: TransactionType;
  merchant?: string;
  location?: string;
  currency?: string;
  description?: string;
  transactionDate: string;
}

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Cards  | ${settings.site.title}`},
  ];
};

// Action function for your route file
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const { userId, id } = params;

  try {
    const transactionData = {
      cardId: id,
      amount: parseFloat(formData.get("amount") as string),
      type: formData.get("type") as TransactionType,
      merchant: (formData.get("merchant") as string) || undefined,
      location: (formData.get("location") as string) || undefined,
      currency: (formData.get("currency") as string) || "USD",
      description: (formData.get("description") as string) || undefined,
      transactionDate: formData.get("transactionDate") as string,
    };

    // Validation
    if (!transactionData.cardId) {
      return Response.json({ error: "Card ID is required" }, { status: 400 });
    }

    if (!transactionData.amount || transactionData.amount <= 0) {
      return Response.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }
    if (!userId) {
      throw new Error("User ID is required");
    }

    const cardService = CardService.getInstance();
    const result = await cardService.addTransaction(
      transactionData.cardId,
      userId,
      {
        amount: transactionData.amount,
        type: transactionData.type,
        merchant: transactionData.merchant,
        location: transactionData.location,
        currency: transactionData.currency,
        description: transactionData.description,
        date: transactionData.transactionDate,
      }
    );

    // Temporary success response - replace with actual service call
    return Response.json({
      success: true,
      message: "Transaction created successfully",
      transaction: transactionData,
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Failed to create transaction" },
      { status: 500 }
    );
  }
};

export default function CardTransactionForm() {
  const navigation = useNavigation();
  const actionData = useActionData<any>();

  // Form state
  const [formData, setFormData] = useState<TransactionFormData>({
    cardId: "",
    amount: 0,
    type: TransactionType.PURCHASE,
    merchant: "",
    location: "",
    currency: "USD",
    description: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });

  const isSubmitting = navigation.state === "submitting";

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

  const currencies = currencyOptions.map(c => c.value);

  const handleInputChange = (
    field: keyof TransactionFormData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      cardId: "",
      amount: 0,
      type: TransactionType.PURCHASE,
      merchant: "",
      location: "",
      currency: "USD",
      description: "",
      transactionDate: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Create Card Transaction
        </h2>
        <p className="text-gray-600">Process a new transaction for a card</p>
      </div>

      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{actionData.error}</p>
        </div>
      )}

      {actionData?.success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800">{actionData.message}</p>
          {actionData.transaction && (
            <div className="mt-2 text-sm text-green-700">
              <p>Amount: ${actionData.transaction.amount}</p>
              <p>Type: {actionData.transaction.type}</p>
            </div>
          )}
        </div>
      )}

      <Form method="post" className="space-y-6">
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
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Additional details about the transaction..."
            maxLength={250}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.description?.length || 0}/250 characters
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-6">
          <button
            type="submit"
            disabled={isSubmitting || !formData.amount || formData.amount <= 0}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              "Create Transaction"
            )}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Reset
          </button>
        </div>
      </Form>
    </div>
  );
}
