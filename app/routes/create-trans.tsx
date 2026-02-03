import { useState } from "react";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  type LoaderFunction,
  type MetaFunction,
} from "react-router";
import { type ActionFunctionArgs, redirect } from "react-router";
import { getTransactionModel } from "~/models/transaction.server";
import mongoose from "mongoose";
import { AdminUserManagementService } from "~/services/user.server";
import type { UserDto } from "~/types";
import countries from "~/assets/country.json";
import { getUserModel } from "~/models/user.server";
import { generateBankReference } from "~/utils/banknumber";
import currencyOptions from '~/assets/currency.json'; 

// Enums matching your server model
export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  TRANSFER = "transfer",
  BILL_PAYMENT = "bill_payment",
  INTEREST = "interest",
  PAYPAL = "paypal",
  WIRE_TRANSFER = "wire_transfer",
  FEE = "fee",
  CARD_TRANSACTION = "card_transaction",
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  PROCESSING = "processing",
  REVERSED = "reversed",
}

interface ActionData {
  error?: string;
  success?: boolean;
  transaction?: any;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  accountNumber?: string;
  account: {
    currency: string;
  };
}

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

// Mock users data - replace with actual data from loader

import settings from '~/assets/settings.json';
import { transactionService } from "~/utils/transactions.server";
export const meta: MetaFunction = () => {
  return [
    {title: `Create Transactions | ${settings.site.title}`},
  ];
};
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
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

    return Response.json({ usersData });
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

export async function action({ request, params }: ActionFunctionArgs) {
  const { userId } = params;

  try {
    const formData = await request.formData();
    const TransactionModel = await getTransactionModel();
    const User = await getUserModel();

    // Extract form data
    const type = formData.get("type") as TransactionType;
    const amount = parseFloat(formData.get("amount") as string);
    const currency = formData.get("currency") as string;
    const toAccount = formData.get("toAccount") as string | null;
    const description = formData.get("description") as string;
    const status = formData.get("status") as TransactionStatus;
    const metadataString = formData.get("metadata") as string;
    const date = formData.get("date") as string;
    const sendEmail = formData.get("sendEmail") === "on";

    // Validate required fields
    if (!type || !amount || !currency || !description) {
      return Response.json(
        { error: "Missing required fields", success: false },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return Response.json(
        { error: "Amount must be greater than 0", success: false },
        { status: 400 }
      );
    }

    // Validate toAccount for internal transfers
    if (toAccount && !mongoose.Types.ObjectId.isValid(toAccount)) {
      return Response.json(
        { error: "Invalid to account ID", success: false },
        { status: 400 }
      );
    }

    // Parse metadata
    let metadata = null;
    if (metadataString && metadataString !== "null") {
      try {
        metadata = JSON.parse(metadataString);
      } catch (error) {
        return Response.json(
          { error: "Invalid metadata format", success: false },
          { status: 400 }
        );
      }
    }

    // Type-specific validations
    switch (type) {
      case TransactionType.TRANSFER:
        if (metadata?.isInternalTransfer && !toAccount) {
          return Response.json(
            {
              error: "Internal transfers require a destination account",
              success: false,
            },
            { status: 400 }
          );
        }
        if (
          !metadata?.isInternalTransfer &&
          (!metadata?.recipientName || !metadata?.accountNumber)
        ) {
          return Response.json(
            {
              error:
                "External transfers require recipient name and account number",
              success: false,
            },
            { status: 400 }
          );
        }
        break;

      case TransactionType.PAYPAL:
        if (!metadata?.email) {
          return Response.json(
            {
              error: "PayPal transactions require an email address",
              success: false,
            },
            { status: 400 }
          );
        }
        break;

      case TransactionType.WIRE_TRANSFER:
        if (
          !metadata?.beneficiaryName ||
          !metadata?.beneficiaryAccount ||
          !metadata?.beneficiaryBankName ||
          !metadata?.beneficiaryBankSwift
        ) {
          return Response.json(
            {
              error: "Wire transfers require beneficiary details",
              success: false,
            },
            { status: 400 }
          );
        }
        break;
    }

    // Create transaction object
    const transactionData = {
      type,
      reference: generateBankReference(),
      amount,
      currency,
      fromAccount: userId,
      toAccount: toAccount ? new mongoose.Types.ObjectId(toAccount) : undefined,
      description,
      status,
      initiatedBy: userId,
      createdAt: date ? new Date(date) : new Date(),
      date: date ? new Date(date) : new Date(),
      metadata,
    };

  

    const user = await User.findById(userId);

    if (!user) {
      return Response.json(
        { error: "User not found", success: false },
        { status: 404 }
      );
    }

    if (user.account.balance < amount) {
      return Response.json(
        { error: "Insufficient balance", success: false },
        { status: 400 }
      );
    }
    
      // Create the transaction
    const transaction = new TransactionModel(transactionData);
    await transaction.save();

    await User.findByIdAndUpdate(userId, { $inc: { 'account.balance': -amount } });


       await transactionService.sendEmailReceiptIfRequested(
        transaction,
        user._id.toString(),
        user.email,
        sendEmail
      );

    // Return success response with transaction details
    return Response.json({
      success: true,
      message: "Transaction created successfully",
      transaction: {
        _id: transaction._id,
        reference: transaction.reference,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("Transaction creation error:", error);

    // Handle specific MongoDB errors
    if (error instanceof Error) {
      if (
        error.message.includes("duplicate key error") &&
        error.message.includes("reference")
      ) {
        return Response.json(
          {
            error: "Transaction reference conflict, please try again",
            success: false,
          },
          { status: 409 }
        );
      }

      if (error.name === "ValidationError") {
        return Response.json(
          { error: `Validation error: ${error.message}`, success: false },
          { status: 400 }
        );
      }

      if (error.name === "CastError") {
        return Response.json(
          { error: "Invalid data format provided", success: false },
          { status: 400 }
        );
      }
    }

    // Generic error response
    return Response.json(
      {
        error: "An error occurred while creating the transaction",
        success: false,
      },
      { status: 500 }
    );
  }
}

export default function CreateTransaction() {
  const { usersData } = useLoaderData<LoaderData>();

  const fetcher = useFetcher<ActionData>();
  const isSubmitting = fetcher.state === "submitting";
  const [selectedType, setSelectedType] = useState<TransactionType>(
    TransactionType.TRANSFER
  );
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TransactionStatus>(
    TransactionStatus.PENDING
  );

  // General fields
  const [source, setSource] = useState(""); // For deposits
  const [cardType, setCardType] = useState(""); // For card transactions

  // Transfer specific fields
  const [recipientName, setRecipientName] = useState("");
  const [bankName, setBankName] = useState("");
  const [country, setCountry] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [iban, setIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [transferType, setTransferType] = useState<
    "internal" | "domestic" | "international"
  >("internal");

  // PayPal specific fields
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalName, setPaypalName] = useState("");

  // Wire transfer specific fields
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryAccount, setBeneficiaryAccount] = useState("");
  const [beneficiaryBankName, setBeneficiaryBankName] = useState("");
  const [beneficiaryBankSwift, setBeneficiaryBankSwift] = useState("");
  const [purpose, setPurpose] = useState("");
  const [instructions, setInstructions] = useState("");
  const [feesOption, setFeesOption] = useState<
    "sender" | "beneficiary" | "shared"
  >("sender");

  const transactionTypeLabels: Partial<Record<TransactionType, string>> = {
    [TransactionType.TRANSFER]: "Transfer",
    [TransactionType.BILL_PAYMENT]: "Bill Payment",
    [TransactionType.INTEREST]: "Interest",
    [TransactionType.PAYPAL]: "PayPal Transaction",
    [TransactionType.WIRE_TRANSFER]: "Wire Transfer",
    [TransactionType.FEE]: "Fee",
  };

  const statusLabels: Record<TransactionStatus, string> = {
    [TransactionStatus.PENDING]: "Pending",
    [TransactionStatus.COMPLETED]: "Completed",
    [TransactionStatus.FAILED]: "Failed",
    [TransactionStatus.PROCESSING]: "Processing",
    [TransactionStatus.REVERSED]: "Reversed",
  };


  const cardTypes = [
    "Debit Card",
    "Credit Card",
  ];

  const getDefaultStatus = (type: TransactionType): TransactionStatus => {
    switch (type) {
      case TransactionType.TRANSFER:
        return TransactionStatus.COMPLETED;
      case TransactionType.PAYPAL:
      case TransactionType.WIRE_TRANSFER:
        return TransactionStatus.PENDING;
      default:
        return TransactionStatus.PENDING;
    }
  };

  const getDefaultDescription = (): string => {
    const selectedUser = usersData.users.find((u) => u._id === fromAccount);
    const userCurrency = selectedUser?.account.currency || currency;

    switch (selectedType) {
      case TransactionType.DEPOSIT:
        return `Deposit of ${userCurrency} ${amount}${source ? ` via ${source}` : ""}`;
      case TransactionType.WITHDRAWAL:
        return `Withdrawal of ${userCurrency} ${amount}`;
      case TransactionType.TRANSFER:
        if (transferType === "internal" && toAccount) {
          const recipient = usersData.users.find((u) => u._id === toAccount);
          return `Transfer to ${recipient?.firstName} ${recipient?.lastName}`;
        }
        return `Transfer to ${recipientName} (${accountNumber})`;
      case TransactionType.PAYPAL:
        return `PayPal Transfer of ${userCurrency} ${amount} to ${paypalEmail}`;
      case TransactionType.WIRE_TRANSFER:
        return `Wire transfer to ${beneficiaryName} - ${beneficiaryBankName}`;
      case TransactionType.CARD_TRANSACTION:
        return "Card Request";
      default:
        return "";
    }
  };

  const buildMetadata = () => {
    const metadata: any = {};

    switch (selectedType) {
      case TransactionType.TRANSFER:
        if (transferType === "internal") {
          const recipient = usersData.users.find((u) => u._id === toAccount);
          if (recipient) {
            metadata.recipientName = `${recipient.firstName} ${recipient.lastName}`;
            metadata.isInternalTransfer = true;
          }
        } else {
          metadata.recipientName = recipientName;
          metadata.bankName = bankName;
          metadata.country = country;
          metadata.accountType = accountType;
          metadata.accountNumber = accountNumber;
          metadata.routingNumber = routingNumber;
          metadata.sortCode = sortCode;
          metadata.iban = iban;
          metadata.swiftCode = swiftCode;
          metadata.bankAddress = bankAddress;
          metadata.transferType = transferType;
          metadata.isInternalTransfer = false;
          metadata.processingTime =
            transferType === "domestic" ? "Instant" : "1-3 business days";
        }
        break;

      case TransactionType.PAYPAL:
        metadata.email = paypalEmail;
        metadata.name = paypalName;
        break;

      case TransactionType.WIRE_TRANSFER:
        metadata.beneficiaryName = beneficiaryName;
        metadata.beneficiaryAccount = beneficiaryAccount;
        metadata.beneficiaryBankName = beneficiaryBankName;
        metadata.beneficiaryBankSwift = beneficiaryBankSwift;
        metadata.country = country;
        metadata.iban = iban;
        metadata.sortCode = sortCode;
        metadata.routingNumber = routingNumber;
        metadata.purpose = purpose;
        metadata.instructions = instructions;
        metadata.feesOption = feesOption;
        metadata.transferType = "international_wire";
        metadata.processingTime = "1-5 business days";
        metadata.complianceStatus = "under_review";
        break;

      case TransactionType.CARD_TRANSACTION:
        if (cardType) metadata.cardType = cardType;
        break;

      case TransactionType.DEPOSIT:
        if (source) metadata.source = source;
        break;
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  };

  const handleTypeChange = (newType: TransactionType) => {
    setSelectedType(newType);
    setStatus(getDefaultStatus(newType));
    // Reset type-specific fields
    setToAccount("");
    setRecipientName("");
    setBankName("");
    setAccountNumber("");
    setPaypalEmail("");
    setPaypalName("");
    setBeneficiaryName("");
    setBeneficiaryBankName("");
    setTransferType("internal");
  };

  const handleReset = () => {
    setSelectedType(TransactionType.DEPOSIT);
    setAmount("");
    setCurrency("USD");
    setFromAccount("");
    setToAccount("");
    setDescription("");
    setStatus(TransactionStatus.PENDING);
    setSource("");
    setCardType("");
    setRecipientName("");
    setBankName("");
    setCountry("");
    setAccountType("");
    setAccountNumber("");
    setRoutingNumber("");
    setSortCode("");
    setIban("");
    setSwiftCode("");
    setBankAddress("");
    setTransferType("internal");
    setPaypalEmail("");
    setPaypalName("");
    setBeneficiaryName("");
    setBeneficiaryAccount("");
    setBeneficiaryBankName("");
    setBeneficiaryBankSwift("");
    setPurpose("");
    setInstructions("");
    setFeesOption("sender");
  };

  const requiresToAccount =
    selectedType === TransactionType.TRANSFER && transferType === "internal";
  const requiresExternalFields =
    selectedType === TransactionType.TRANSFER && transferType !== "internal";
  const requiresPayPalFields = selectedType === TransactionType.PAYPAL;
  const requiresWireFields = selectedType === TransactionType.WIRE_TRANSFER;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Transaction
          </h1>
          <p className="text-gray-600">
            Create a new transaction for user accounts. Select the transaction
            type and fill in the required details.
          </p>
        </div>

        {/* Success/Error Messages */}
        {fetcher.data?.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{fetcher.data.error}</p>
              </div>
            </div>
          </div>
        )}

        {fetcher.data?.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  Transaction created successfully! Reference:{" "}
                  {fetcher.data.transaction?.reference}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <fetcher.Form method="post" className="p-6">
            {/* Basic Transaction Details */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Basic Information
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    value={selectedType}
                    onChange={(e) =>
                      handleTypeChange(e.target.value as TransactionType)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {Object.entries(transactionTypeLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label
                    htmlFor="amount"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Amount *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      id="amount"
                      name="amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <label
                    htmlFor="currency"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Currency *
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {currencyOptions.map((curr) => (
                      <option key={curr.value} value={curr.value}>
                        {curr.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Date */}
                <div>
                  <label
                    htmlFor="date"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Date
                  </label>
                  <input
                    type="datetime-local"
                    id="date"
                    name="date"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
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
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as TransactionStatus)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <label
                    htmlFor="reference"
                    className="block text-sm font-medium text-gray-700 "
                  >
                    Send Email Receipt
                  </label>
                  <input
                    type="checkbox"
                    id="sendEmail"
                    name="sendEmail"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                </div>
              </div>
            </div>

            {/* Transfer Type Selection for Transfer */}
            {selectedType === TransactionType.TRANSFER && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Transfer Type
                </h2>
                <div className="flex flex-wrap gap-4">
                  {["internal", "domestic", "international"].map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="radio"
                        name="transferType"
                        value={type}
                        checked={transferType === type}
                        onChange={(e) =>
                          setTransferType(
                            e.target.value as
                              | "internal"
                              | "domestic"
                              | "international"
                          )
                        }
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700 capitalize">
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Conditional Fields Based on Transaction Type */}

            {/* Internal Transfer Fields */}
            {requiresToAccount && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Internal Transfer Details
                </h2>
                <div>
                  <label
                    htmlFor="toAccount"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    To Account *
                  </label>
                  <select
                    id="toAccount"
                    name="toAccount"
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={requiresToAccount}
                  >
                    <option value="">Select destination account...</option>
                    {usersData.users
                      .filter((user) => user._id !== fromAccount)
                      .map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.firstName} {user.lastName} (
                          {user.account.number}) - {user.email}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {/* External Transfer Fields */}
            {requiresExternalFields && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  External Transfer Details
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="recipientName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Recipient Name *
                    </label>
                    <input
                      type="text"
                      id="recipientName"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={requiresExternalFields}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="bankName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      id="bankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={requiresExternalFields}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="accountNumber"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Account Number *
                    </label>
                    <input
                      type="text"
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={requiresExternalFields}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="country"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Country
                    </label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select country...</option>
                      {countries.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="routingNumber"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Routing Number
                    </label>
                    <input
                      type="text"
                      id="routingNumber"
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="swiftCode"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      SWIFT Code
                    </label>
                    <input
                      type="text"
                      id="swiftCode"
                      value={swiftCode}
                      onChange={(e) => setSwiftCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="iban"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      IBAN
                    </label>
                    <input
                      type="text"
                      id="iban"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sortCode"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Sort Code
                    </label>
                    <input
                      type="text"
                      id="sortCode"
                      value={sortCode}
                      onChange={(e) => setSortCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PayPal Fields */}
            {requiresPayPalFields && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  PayPal Details
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="paypalEmail"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      PayPal Email *
                    </label>
                    <input
                      type="email"
                      id="paypalEmail"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={requiresPayPalFields}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="paypalName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      id="paypalName"
                      value={paypalName}
                      onChange={(e) => setPaypalName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Wire Transfer Fields */}
            {requiresWireFields && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Wire Transfer Details
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="beneficiaryName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Beneficiary Name *
                    </label>
                    <input
                      type="text"
                      id="beneficiaryName"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={requiresWireFields}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="beneficiaryAccount"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Beneficiary Account *
                    </label>
                    <input
                      type="text"
                      id="beneficiaryAccount"
                      value={beneficiaryAccount}
                      onChange={(e) => setBeneficiaryAccount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={requiresWireFields}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="beneficiaryBankName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Beneficiary Bank Name *
                    </label>
                    <input
                      type="text"
                      id="beneficiaryBankName"
                      value={beneficiaryBankName}
                      onChange={(e) => setBeneficiaryBankName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={requiresWireFields}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="beneficiaryBankSwift"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      SWIFT Code *
                    </label>
                    <input
                      type="text"
                      id="beneficiaryBankSwift"
                      value={beneficiaryBankSwift}
                      onChange={(e) => setBeneficiaryBankSwift(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={requiresWireFields}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="feesOption"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Fee Option
                    </label>
                    <select
                      id="feesOption"
                      value={feesOption}
                      onChange={(e) =>
                        setFeesOption(
                          e.target.value as "sender" | "beneficiary" | "shared"
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="sender">Sender Pays</option>
                      <option value="beneficiary">Beneficiary Pays</option>
                      <option value="shared">Shared</option>
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label
                      htmlFor="purpose"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Purpose of Transfer
                    </label>
                    <input
                      type="text"
                      id="purpose"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g., Business payment, Personal transfer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label
                      htmlFor="instructions"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Special Instructions
                    </label>
                    <textarea
                      id="instructions"
                      rows={3}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Any special instructions for the wire transfer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Deposit Source */}
            {selectedType === TransactionType.DEPOSIT && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Deposit Details
                </h2>
                <div>
                  <label
                    htmlFor="source"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Source (Optional)
                  </label>
                  <input
                    type="text"
                    id="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g., Bank Transfer, Check, Cash"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Card Transaction Type */}
            {selectedType === TransactionType.CARD_TRANSACTION && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Card Details
                </h2>
                <div>
                  <label
                    htmlFor="cardType"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Card Type
                  </label>
                  <select
                    id="cardType"
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select card type...</option>
                    {cardTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Description
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Transaction Description *
                    </label>
                    <button
                      type="button"
                      onClick={() => setDescription(getDefaultDescription())}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Auto-generate
                    </button>
                  </div>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter transaction description..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Hidden fields and metadata */}
            <input type="hidden" name="toAccount" value={toAccount} />

            {/* Metadata as hidden field */}
            <input
              type="hidden"
              name="metadata"
              value={JSON.stringify(buildMetadata())}
            />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSubmitting
                  ? "Creating Transaction..."
                  : "Create Transaction"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 sm:flex-none bg-gray-200 text-gray-700 px-8 py-3 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
              >
                Reset Form
              </button>
            </div>
          </fetcher.Form>
        </div>

        {/* Transaction Preview */}
        {amount && fromAccount && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">
              Transaction Preview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Type:</span>
                <span className="ml-2 text-blue-700">
                  {transactionTypeLabels[selectedType]}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Amount:</span>
                <span className="ml-2 text-blue-700">
                  {currency} {amount}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Status:</span>
                <span className="ml-2 text-blue-700">
                  {statusLabels[status]}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">From:</span>
                <span className="ml-2 text-blue-700">
                  {
                    usersData.users.find((u) => u._id === fromAccount)
                      ?.firstName
                  }{" "}
                  {usersData.users.find((u) => u._id === fromAccount)?.lastName}
                </span>
              </div>
              {toAccount && (
                <div>
                  <span className="font-medium text-blue-800">To:</span>
                  <span className="ml-2 text-blue-700">
                    {
                      usersData.users.find((u) => u._id === toAccount)
                        ?.firstName
                    }{" "}
                    {usersData.users.find((u) => u._id === toAccount)?.lastName}
                  </span>
                </div>
              )}
              {recipientName && (
                <div>
                  <span className="font-medium text-blue-800">Recipient:</span>
                  <span className="ml-2 text-blue-700">{recipientName}</span>
                </div>
              )}
              {paypalEmail && (
                <div>
                  <span className="font-medium text-blue-800">
                    PayPal Email:
                  </span>
                  <span className="ml-2 text-blue-700">{paypalEmail}</span>
                </div>
              )}
              {beneficiaryName && (
                <div>
                  <span className="font-medium text-blue-800">
                    Beneficiary:
                  </span>
                  <span className="ml-2 text-blue-700">{beneficiaryName}</span>
                </div>
              )}
              {description && (
                <div className="md:col-span-2">
                  <span className="font-medium text-blue-800">
                    Description:
                  </span>
                  <span className="ml-2 text-blue-700">{description}</span>
                </div>
              )}
            </div>

            {/* Metadata Preview */}
            {buildMetadata() && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <span className="font-medium text-blue-800">Metadata:</span>
                <pre className="mt-2 text-xs text-blue-700 bg-blue-100 p-2 rounded overflow-auto">
                  {JSON.stringify(buildMetadata(), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Transaction Type Information */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Transaction Type Guide
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-700">
            <div>
              <strong className="text-gray-900">Deposit:</strong> Add funds to
              an account from external sources
            </div>
            <div>
              <strong className="text-gray-900">Withdrawal:</strong> Remove
              funds from an account
            </div>
            <div>
              <strong className="text-gray-900">Transfer:</strong> Move funds
              between accounts (internal/external)
            </div>
            <div>
              <strong className="text-gray-900">Bill Payment:</strong> Pay bills
              or services
            </div>
            <div>
              <strong className="text-gray-900">Interest:</strong> Interest
              earned on account
            </div>
            <div>
              <strong className="text-gray-900">PayPal:</strong> Transfer funds
              via PayPal
            </div>
            <div>
              <strong className="text-gray-900">Wire Transfer:</strong>{" "}
              International bank wire transfer
            </div>
            <div>
              <strong className="text-gray-900">Fee:</strong> Account or service
              fees
            </div>
            <div>
              <strong className="text-gray-900">Card Transaction:</strong>{" "}
              Card-related transactions and fees
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
