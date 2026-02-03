import { useEffect, useState } from "react";
import {
  useFetcher,
  useLoaderData,
  useSearchParams,
  type MetaFunction,
} from "react-router";
import CustomSelect from "~/components/customSelect";
import { getUserData } from "~/utils/auth.server";
import { TransactionType, type UserDto } from "~/types";
import { transactionService } from "~/utils/transactions.server";
import { TransactionStatus } from "~/types";
import type { Route } from "./+types/deposit";
import { getUserModel } from "~/models/user.server";
import countryOptions from "~/assets/country.json";
import { generateBankReference } from "~/utils/banknumber";

import settings from "~/assets/settings.json";
export const meta: MetaFunction = () => {
  return [{ title: `Deposit | ${settings.site.title}` }];
};

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { userId } = params;
  try {
    const userData = await getUserData(userId);
    return Response.json({ userData, userId });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return Response.json({ userData: null });
  }
};

// Action function to handle form submission
export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const depositType = formData.get("depositType") as string;
  const amount = formData.get("amount") as string;
  const status = formData.get("status") as TransactionStatus;
  const transactionDate = formData.get("transactionDate") as string;
  const description = formData.get("description") as string;
  const sendEmail = formData.get("sendEmail") === "on";

  // Local transfer fields
  const senderName = formData.get("senderName") as string;
  const senderBank = formData.get("senderBank") as string;
  const senderAccount = formData.get("senderAccount") as string;
  const routingNumber = formData.get("routingNumber") as string;

  // International transfer fields
  const senderCountry = formData.get("senderCountry") as string;
  const swiftCode = formData.get("swiftCode") as string;
  const BankAddress = formData.get("BankAddress") as string;
  const purpose = formData.get("purpose") as string;

  // Other deposit types
  const checkNumber = formData.get("checkNumber") as string;
  const cryptoWallet = formData.get("cryptoWallet") as string;
  const cryptoNetwork = formData.get("cryptoNetwork") as string;
  const wireReference = formData.get("wireReference") as string;

  const { userId } = params;

  try {
    if (!depositType || !amount || !status) {
      return Response.json(
        { error: "Please fill in all required fields" },
        { status: 400 }
      );
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return Response.json(
        { error: "Please enter a valid amount greater than 0" },
        { status: 400 }
      );
    }

    // Validate specific fields based on deposit type
    if (depositType === "local_transfer") {
      if (!senderName || !senderBank || !senderAccount) {
        return Response.json(
          {
            error:
              "Sender name, bank, and account number are required for local transfers",
          },
          { status: 400 }
        );
      }
    } else if (depositType === "international_transfer") {
      if (!senderName || !senderBank || !senderCountry || !swiftCode) {
        return Response.json(
          { error: "All international transfer fields are required" },
          { status: 400 }
        );
      }
    } else if (depositType === "check") {
      if (!checkNumber) {
        return Response.json(
          { error: "Check number is required for check deposits" },
          { status: 400 }
        );
      }
    } else if (depositType === "crypto") {
      if (!cryptoWallet || !cryptoNetwork) {
        return Response.json(
          {
            error:
              "Crypto wallet and network are required for cryptocurrency deposits",
          },
          { status: 400 }
        );
      }
    } else if (depositType === "wire_transfer") {
      if (!wireReference) {
        return Response.json(
          { error: "Wire reference is required for wire transfers" },
          { status: 400 }
        );
      }
    }

    // Generate transaction reference
    const reference = generateBankReference();

    let transactionDescription: string;

    switch (depositType) {
      case "local_transfer":
        transactionDescription = `transfer from ${senderName} (${senderBank}) - ${description}`;
        break;
      case "international_transfer":
        transactionDescription = ` transfer from ${senderName} (${senderCountry}) - ${description}`;
        break;
      case "check":
        transactionDescription = `Check deposit - Check #${checkNumber} - ${description}`;
        break;
      case "crypto":
        transactionDescription = `Crypto deposit via ${cryptoNetwork} - ${description}`;
        break;
      case "wire_transfer":
        transactionDescription = `Wire transfer - Ref: ${wireReference} - ${description}`;
        break;
      default:
        return Response.json(
          { error: "Invalid deposit type" },
          { status: 400 }
        );
    }

    const transaction = await transactionService.createTransaction({
      type: TransactionType.DEPOSIT,
      amount: numericAmount,
      reference,
      currency: "USD",
      fromAccount: userId,
      description: transactionDescription,
      status: status,
      initiatedBy: userId,
      createdAt: transactionDate ? new Date(transactionDate) : new Date(),
      metadata: {
        depositType,
        senderName,
        senderBank,
        senderAccount,
        routingNumber,
        senderCountry,
        swiftCode,
        BankAddress,
        purpose,
        checkNumber,
        cryptoWallet,
        cryptoNetwork,
        wireReference,
        customDescription: description,
      },
    });

    // If status is completed, update user balance
    const UserModel = await getUserModel();

    if (status === TransactionStatus.COMPLETED) {
      await UserModel.findByIdAndUpdate(userId, {
        $inc: { "account.balance": numericAmount },
      });
    }

    const user = await UserModel.findById(userId);

    if (user) {
      await transactionService.sendEmailReceiptIfRequested(
        transaction,
        userId,
        user.email,
        sendEmail
      );
    }

    return Response.json({
      success: true,
      message: transactionDescription,
      status: status,
      reference,
      transactionId: transaction._id,
      amount: numericAmount,
    });
  } catch (error) {
    console.error("Failed to create deposit transaction:", error);
    return Response.json(
      { error: "Failed to process deposit. Please try again." },
      { status: 500 }
    );
  }
}

interface AdminDepositData {
  depositType: string;
  amount: string;
  status: TransactionStatus;
  transactionDate: string;
  description: string;
  senderName: string;
  senderBank: string;
  senderAccount: string;
  routingNumber: string;
  senderCountry: string;
  swiftCode: string;
  BankAddress: string;
  purpose: string;
  checkNumber: string;
  cryptoWallet: string;
  cryptoNetwork: string;
  wireReference: string;
}

type ResponseData = {
  success?: boolean;
  message?: string;
  error?: string;
  transactionId?: string;
  reference?: string;
  status?: TransactionStatus;
  amount?: number;
};

export default function AdminDeposit() {
  const { userData } = useLoaderData() as {
    userData: UserDto;
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [amount, setAmount] = useState("");
  const [depositType, setDepositType] = useState("");
  const [formData, setFormData] = useState<AdminDepositData>({
    depositType: "",
    amount: "",
    status: TransactionStatus.PENDING,
    transactionDate: new Date().toISOString().split("T")[0],
    description: "",
    senderName: "",
    senderBank: "",
    senderAccount: "",
    routingNumber: "",
    senderCountry: "",
    swiftCode: "",
    BankAddress: "",
    purpose: "",
    checkNumber: "",
    cryptoWallet: "",
    cryptoNetwork: "ERC20",
    wireReference: "",
  });

  const fetcher = useFetcher<ResponseData>();
  const isSubmitting = fetcher.state === "submitting";
  const step = searchParams.get("step") || "form";

  const formatAmount = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    if (!numericValue) return "";
    return numericValue;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmount(e.target.value);
    setAmount(formatted);
    setFormData((prev) => ({ ...prev, amount: formatted }));
  };

  const handleDepositTypeChange = (value: string) => {
    setDepositType(value);
    setFormData((prev) => ({ ...prev, depositType: value }));
  };

  const depositTypeOptions = [
    { value: "local_transfer", label: "Local Bank Transfer" },
    { value: "international_transfer", label: "International Transfer" },
    { value: "check", label: "Check Deposit" },
    { value: "wire_transfer", label: "Wire Transfer" },
    { value: "crypto", label: "Cryptocurrency" },
  ];

  const statusOptions = [
    { value: TransactionStatus.COMPLETED, label: "Completed" },
    { value: TransactionStatus.PENDING, label: "Pending" },
    { value: TransactionStatus.PROCESSING, label: "Processing" },
    { value: TransactionStatus.FAILED, label: "Failed" },
  ];

  const cryptoNetworkOptions = [
    { value: "ERC20", label: "ERC20 (Ethereum)" },
    { value: "TRC20", label: "TRC20 (Tron)" },
    { value: "BEP20", label: "BEP20 (Binance Smart Chain)" },
    { value: "Bitcoin", label: "Bitcoin Network" },
  ];

  useEffect(() => {
    if (fetcher.data?.success) {
      setSearchParams({ step: "success" });
    }
  }, [fetcher.data]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-600">
          Deposit funds to user account: {userData.firstName}{" "}
          {userData.lastName}
        </p>
      </div>

      {/* User Account Info */}
      <div className="bg-blue-50 rounded-xl p-6 mb-8 border border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-blue-600 text-sm mb-1">Account Holder</p>
            <p className="font-semibold text-gray-900">
              {userData.firstName} {userData.lastName}
            </p>
          </div>
          <div>
            <p className="text-blue-600 text-sm mb-1">Account Number</p>
            <p className="font-semibold text-gray-900">
              {userData.account.number}
            </p>
          </div>
          <div>
            <p className="text-blue-600 text-sm mb-1">Current Balance</p>
            <p className="font-semibold text-gray-900">
              {Math.abs(userData.account.balance).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {step === "success" && fetcher.data?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <svg
              className="w-6 h-6 text-green-600 mr-3"
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
            <div>
              <h3 className="text-green-800 font-medium">
                Deposit Processed Successfully
              </h3>
              <p className="text-green-700 text-sm mt-1">
                Transaction Reference: {fetcher.data.reference}
              </p>
              <p className="text-green-700 text-sm">
                Amount: ${fetcher.data.amount?.toLocaleString()} | Status:{" "}
                {fetcher.data.status}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSearchParams({ step: "form" })}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Process Another Deposit
          </button>
        </div>
      )}

      {/* Deposit Form */}
      {step === "form" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <fetcher.Form method="post" className="space-y-6">
            {/* Error Message */}
            {fetcher.data?.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <svg
                    className="w-5 h-5 text-red-400 mt-0.5 mr-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-red-700 text-sm">{fetcher.data.error}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Deposit Type */}
              <div>
                <label
                  htmlFor="depositType"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Deposit Type *
                </label>
                <CustomSelect
                  id="depositType"
                  name="depositType"
                  value={depositType}
                  required
                  placeholder="Select deposit type"
                  options={depositTypeOptions}
                  onChange={handleDepositTypeChange}
                />
              </div>

              {/* Amount */}
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Amount (USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">
                    $
                  </span>
                  <input
                    type="text"
                    id="amount"
                    name="amount"
                    required
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Transaction Status */}
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Transaction Status *
                </label>
                <CustomSelect
                  id="status"
                  name="status"
                  value={formData.status}
                  required
                  placeholder="Select status"
                  options={statusOptions}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: value as TransactionStatus,
                    }))
                  }
                />
              </div>

              {/* Transaction Date */}
              <div>
                <label
                  htmlFor="transactionDate"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Transaction Date *
                </label>
                <input
                  type="date"
                  id="transactionDate"
                  name="transactionDate"
                  required
                  value={formData.transactionDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      transactionDate: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
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

            {/* Conditional Fields based on Deposit Type */}
            {depositType === "local_transfer" && (
              <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-800 mb-4">
                  Local Bank Transfer Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Name *
                    </label>
                    <input
                      type="text"
                      name="senderName"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter sender's full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Bank *
                    </label>
                    <input
                      type="text"
                      name="senderBank"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter bank name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Account Number *
                    </label>
                    <input
                      type="text"
                      name="senderAccount"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter account number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      name="routingNumber"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter routing number"
                    />
                  </div>
                </div>
              </div>
            )}

            {depositType === "international_transfer" && (
              <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                <h3 className="font-medium text-purple-800 mb-4">
                  International Transfer Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Name *
                    </label>
                    <input
                      type="text"
                      name="senderName"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter sender's full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Bank *
                    </label>
                    <input
                      type="text"
                      name="senderBank"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter international bank name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Account *
                    </label>
                    <input
                      type="text"
                      name="senderAccount"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter Sender Account"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sender Country *
                    </label>
                    <CustomSelect
                      id="senderCountry"
                      name="senderCountry"
                      value=""
                      required
                      placeholder="Select country"
                      options={countryOptions}
                      onChange={() => {}}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SWIFT Code *
                    </label>
                    <input
                      type="text"
                      name="swiftCode"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter SWIFT/BIC code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Address
                    </label>
                    <input
                      type="text"
                      name="BankAddress"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Enter correspondent bank name Address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transfer Purpose
                    </label>
                    <input
                      type="text"
                      name="purpose"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="e.g., Personal transfer, Investment"
                    />
                  </div>
                </div>
              </div>
            )}

            {depositType === "check" && (
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-4">
                  Check Deposit Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Check Number *
                    </label>
                    <input
                      type="text"
                      name="checkNumber"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter check number"
                    />
                  </div>
                </div>
              </div>
            )}

            {depositType === "wire_transfer" && (
              <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                <h3 className="font-medium text-indigo-800 mb-4">
                  Wire Transfer Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wire Reference Number *
                    </label>
                    <input
                      type="text"
                      name="wireReference"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter wire reference number"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="senderName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Sender Name *
                    </label>
                    <input
                      type="text"
                      name="senderName"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter sender's full name"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="senderBank"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Sender Bank *
                    </label>
                    <input
                      type="text"
                      name="senderBank"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter sender bank name"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="senderAccount"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Sender Account *
                    </label>
                    <input
                      type="text"
                      name="senderAccount"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter sender account number"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="swiftCode"
                      className="block text-sm font-medium text-gray-700"
                    >
                      SWIFT Code *
                    </label>
                    <input
                      type="text"
                      name="swiftCode"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter sender account number"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="senderCountry"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Sender Country *
                    </label>
                    <CustomSelect
                      id="senderCountry"
                      name="senderCountry"
                      value={formData.senderCountry}
                      required
                      placeholder="Select country"
                      options={countryOptions}
                      onChange={() => {}}
                    />
                  </div>
                </div>
              </div>
            )}

            {depositType === "crypto" && (
              <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                <h3 className="font-medium text-yellow-800 mb-4">
                  Cryptocurrency Deposit Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Crypto Wallet Address *
                    </label>
                    <input
                      type="text"
                      name="cryptoWallet"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Enter sender's wallet address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Network *
                    </label>
                    <CustomSelect
                      id="cryptoNetwork"
                      name="cryptoNetwork"
                      value={formData.cryptoNetwork}
                      required
                      placeholder="Select network"
                      options={cryptoNetworkOptions}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          cryptoNetwork: value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Additional Notes
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                placeholder="Add any additional notes for this deposit..."
              />
            </div>

            {/* Hidden admin ID field - in real app, this would come from session */}
            <input type="hidden" name="adminId" value="admin-user-id" />

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing Deposit...
                  </>
                ) : (
                  "Process Deposit"
                )}
              </button>
            </div>
          </fetcher.Form>
        </div>
      )}

      {/* Information Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center mb-2">
            <svg
              className="w-5 h-5 text-green-600 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="font-medium text-green-800">Instant Processing</h3>
          </div>
          <p className="text-green-700 text-sm">
            Admin deposits can be processed instantly when status is set to
            completed
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center mb-2">
            <svg
              className="w-5 h-5 text-blue-600 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="font-medium text-blue-800">Full Control</h3>
          </div>
          <p className="text-blue-700 text-sm">
            Set custom transaction dates and status for complete administrative
            control
          </p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center mb-2">
            <svg
              className="w-5 h-5 text-purple-600 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 8a6 6 0 01-7.743 5.743L10 14l-4 4-4-4 4-4 .257.257A6 6 0 1118 8zm-6-2a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="font-medium text-purple-800">Audit Trail</h3>
          </div>
          <p className="text-purple-700 text-sm">
            All admin deposits are tracked with complete metadata for compliance
            and reporting
          </p>
        </div>
      </div>
    </div>
  );
}
