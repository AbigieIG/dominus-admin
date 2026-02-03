import { useState, useEffect } from "react";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import CustomSelect from "~/components/customSelect";
import countryOptions from "~/assets/country.json";
import { transactionService } from "~/utils/transactions.server";
import { getUserData } from "~/utils/auth.server";
import type { UserDto } from "~/types";
import settings from '~/assets/settings.json';
import currencyOptions from '~/assets/currency.json'; 


export const meta: MetaFunction = () => {
  return [
    {title: `Transfer | ${settings.site.title}`},
  ];
};
interface ActionResponse {
  success: boolean;
  message: string;
  error?: string;
  transactionId?: string;
  reference?: string;
  balance?: number;
}

enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  PROCESSING = "processing",
  REVERSED = "reversed",
}

interface TransferRequest {
  fromUserId: string;
  recipientName: string;
  bankName?: string;
  country: string;
  accountType: string;
  accountNumber: string;
  routingNumber?: string;
  sortCode?: string;
  iban?: string;
  swiftCode?: string;
  currency: string;
  bankAddress?: string;
  amount: number;
  description?: string;
  pin: string;
  date: string;
  status: TransactionStatus;
  sendEmail: boolean;
  transferType: "domestic" | "international";
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { userId } = params;
  if (!userId) {
    throw new Response("not found", { status: 404 });
  }

  try {
    const userData = await getUserData(userId);

    return Response.json({ userData });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return Response.json({ userData: null });
  }
};

export async function action({ request, params }: ActionFunctionArgs) {
  const { userId } = params;
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const data: TransferRequest = {
      fromUserId: userId as string,
      recipientName: formData.get("recipientName") as string,
      bankName: formData.get("bankName") as string,
      country: formData.get("country") as string,
      accountType: formData.get("accountType") as string,
      accountNumber: formData.get("accountNumber") as string,
      routingNumber: formData.get("routingNumber") as string,
      sortCode: formData.get("sortCode") as string,
      iban: formData.get("iban") as string,
      swiftCode: formData.get("swiftCode") as string,
      currency: formData.get("currency") as string,
      bankAddress: formData.get("bankAddress") as string,
      amount: Number(formData.get("amount")?.toString().replace(/,/g, "")),
      description: formData.get("description") as string,
      pin: formData.get("pin") as string,
      status: formData.get("status") as TransactionStatus,
      date: formData.get("date") as string,
      sendEmail: formData.get("sendEmail") === "true",
      transferType: formData.get("transferType") as
        | "domestic"
        | "international",
    };

    const result = await transactionService.transfer(data);

    

    if (result.success) {
      return Response.json(
        {
          ...result,
          message:
            result.message ||
            (result.success ? "Transfer successful" : "Transfer failed"),
        },
        {
          status: result.success ? 200 : 400,
        }
      );
    } else {
      console.error("Transfer error:", result);
      return Response.json(result, { status: 400 });
    }
  } catch (error: any) {
    console.error("Transfer error:", error);
    return Response.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

interface TransferData {
  recipientName: string;
  bankName: string;
  country: string;
  accountType: string;
  accountNumber: string;
  routingNumber: string;
  sortCode: string;
  iban: string;
  swiftCode: string;
  currency: string;
  bankAddress: string;
  amount: string;
  date: string;
  status: string;
  description: string;
  transferType: string;
  sendEmail: boolean;
}

interface UserAccount {
  firstName: string;
  lastName: string;
  accountNumber: string;
  balance: number;
}

const STORAGE_KEY = "transfer_form_data";

const saveFormData = (data: TransferData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving form data:", error);
  }
};

const loadFormData = (): TransferData | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("Error loading form data:", error);
    return null;
  }
};

const clearFormData = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing form data:", error);
  }
};
export default function Transfer() {
  const { userData } = useLoaderData() as { userData: UserDto };
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentStep, setCurrentStep] = useState<
    "select" | "form" | "summary" | "pin" | "success"
  >("select");

  const TRANSFER_METHOD_KEY = "transfer_method";
  const getInitialTransferMethod = () => {
    const saved = localStorage.getItem(TRANSFER_METHOD_KEY);
    return saved === "international" ? "international" : "domestic";
  };

  const [transferMethod, setTransferMethod] = useState<
    "domestic" | "international"
  >(() => {
    if (typeof window !== "undefined") {
      return getInitialTransferMethod();
    }
    return "domestic";
  });

  useEffect(() => {
    localStorage.setItem(TRANSFER_METHOD_KEY, transferMethod);
  }, [transferMethod]);

  const [amount, setAmount] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [pin, setPin] = useState("");

  const [formData, setFormData] = useState<TransferData>(() => {
    return (
      loadFormData() || {
        recipientName: "",
        bankName: "",
        country: "",
        accountType: "",
        accountNumber: "",
        routingNumber: "",
        sortCode: "",
        iban: "",
        swiftCode: "",
        currency: "USD",
        bankAddress: "",
        date: new Date().toISOString().split("T")[0],
        status: "completed",
        amount: "",
        description: "",
        sendEmail: false,
        transferType: "domestic",
      }
    );
  });

  const step = searchParams.get("step") || "select";
  const navigate = useNavigate();

  useEffect(() => {
    if (step !== "success") {
      saveFormData(formData);
    }
  }, [step, formData]);

  const handleMakeAnotherTransfer = () => {
    // Clear localStorage
    clearFormData();

    // Reset form data to initial state
    setFormData({
      recipientName: "",
      bankName: "",
      country: "",
      accountType: "",
      accountNumber: "",
      routingNumber: "",
      sortCode: "",
      iban: "",
      swiftCode: "",
      currency: "USD",
      bankAddress: "",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      status: "completed",
      sendEmail: false,
      transferType: "domestic",
    });

    // Reset other states
    setAmount("");
    setPin("");
    setFoundRecipient(null);
    setSelectedCountry("");
    setTransferMethod("domestic");
    setCurrentStep("select");

    // Navigate back to select step
    navigate("?step=select");
  };

  // Mock data - replace with actual user data
  const userBalance = userData?.account?.balance;

  const [foundRecipient, setFoundRecipient] = useState<UserAccount | null>(
    null
  );
  const fetcher = useFetcher<ActionResponse>();
  const isSubmitting = fetcher.state === "submitting";

  // Account type options
  const accountTypeOptions = [
    { value: "checking", label: "Checking Account" },
    { value: "savings", label: "Savings Account" },
    { value: "current", label: "Current Account" },
    { value: "joint", label: "Joint Account" },
    { value: "corporate", label: "Corporate Account" },
  ];

 

  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "completed", label: "completed" },
    { value: "failed", label: "failed" },
    { value: "processing", label: "processing" },
    { value: "reversed", label: "reversed" },
  ];

  // Country-specific banking field requirements
  const getRequiredFields = (country: string) => {
    const countryCode = country?.toLowerCase();

    switch (countryCode) {
      case "united states":
      case "us":
      case "usa":
        return {
          routingNumber: true,
          sortCode: false,
          iban: false,
          swiftCode: false,
        };
      case "united kingdom":
      case "uk":
      case "gb":
        return {
          routingNumber: false,
          sortCode: true,
          iban: false,
          swiftCode: false,
        };
      case "germany":
      case "france":
      case "spain":
      case "italy":
      case "netherlands":
        return {
          routingNumber: false,
          sortCode: false,
          iban: true,
          swiftCode: true,
        };
      default:
        return {
          routingNumber: false,
          sortCode: false,
          iban: false,
          swiftCode: true,
        };
    }
  };

  const requiredFields = getRequiredFields(selectedCountry);

  // Check if transfer is domestic (same country as user)
  const isDomesticTransfer = (country: string) => {
    const userCountry = userData.address.country;
    return country?.toLowerCase() === userCountry.toLowerCase();
  };

  // Mock function to search for recipient by account number
  const searchRecipient = async (accountNumber: string) => {
    try {
      const response = await fetch(
        `/api/get-recipient?accountNumber=${accountNumber}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.success && data.data) {
        return data.data;
      } else {
        throw new Error(data.message || "Recipient not found");
      }
    } catch (error) {
      console.error("Error searching for recipient:", error);
      throw error;
    }
  };

  // Handle account number lookup for domestic transfers
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleAccountNumberChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const accountNum = e.target.value;
    setFormData((prev) => ({ ...prev, accountNumber: accountNum }));
    setFoundRecipient(null);
    setSearchError(null);

    if (transferMethod === "domestic" && accountNum.length >= 8) {
      setIsSearching(true);
      try {
        const recipient = await searchRecipient(accountNum);
        if (recipient) {
          setFoundRecipient(recipient);
          setFormData((prev) => ({
            ...prev,
            recipientName: `${recipient.firstName} ${recipient.lastName}`,
            bankName: "Your Bank", // Same bank for domestic
          }));
        } else {
          setSearchError("Recipient not found");
        }
      } catch (error) {
        setSearchError(
          error instanceof Error
            ? error.message
            : "Failed to search for recipient"
        );
      } finally {
        setIsSearching(false);
      }
    }
  };

  
  // Format amount with commas
  const formatAmount = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    if (!numericValue) return "";
    return new Intl.NumberFormat("en-US").format(Number(numericValue));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, "");
    setAmount(rawValue);
    setFormData((prev) => ({ ...prev, amount: rawValue }));
  };

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    const domestic = isDomesticTransfer(value);
    setTransferMethod(domestic ? "domestic" : "international");
    setFormData((prev) => ({
      ...prev,
      country: value,
      transferType: domestic ? "domestic" : "international",
      // Reset fields when switching transfer types
      recipientName: domestic ? prev.recipientName : "",
      bankName: domestic ? prev.bankName : "",
      routingNumber: "",
      sortCode: "",
      iban: "",
      swiftCode: "",
    }));
  };

  // Handle step navigation
  const handleNext = () => {
    if (step === "select") {
      navigate("?step=form");
    } else if (step === "form") {
      navigate("?step=summary");
    } else if (step === "summary") {
      navigate("?step=pin");
    }
  };

  const handleBack = () => {
    if (step === "form") {
      navigate("?step=select");
    } else if (step === "summary") {
      navigate("?step=form");
    } else if (step === "pin") {
      navigate("?step=summary");
    }
  };

  // Handle PIN confirmation and form submission
  const handlePinConfirm = () => {
    if (pin.length !== 4) return;

    const formDataToSubmit = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSubmit.append(key, value);
    });
    formDataToSubmit.append("pin", pin);

    fetcher.submit(formDataToSubmit, {
      method: "post",
    });
  };



  const getCountryLabel = (value: string): string => {
    return countryOptions.find((opt) => opt.value === value)?.label || value;
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      navigate("?step=success");
      clearFormData();
      setFormData({
        recipientName: "",
        bankName: "",
        country: "",
        accountType: "",
        accountNumber: "",
        routingNumber: "",
        sortCode: "",
        iban: "",
        swiftCode: "",
        currency: "USD",
        bankAddress: "",
        amount: "",
        sendEmail: false,
        date: "",
        status: "completed",
        description: "",
        transferType: "domestic",
      });
    }
  }, [fetcher.data]);



  

  // Step 1: Transfer Method Selection
  const renderTransferSelection = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Send Money</h1>
        <p className="text-gray-600">Choose how you'd like to transfer money</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <button
          onClick={() => {
            setTransferMethod("domestic");
            setFormData((prev) => ({
              ...prev,
              transferType: "domestic",
              country: "united states",
            }));
            navigate("?step=form");
          }}
          className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {" "}
              Transfer To {settings.site.short_name}
            </h3>
            <p className="text-gray-600">Send money to a {settings.site.short_name} account</p>
            <div className="mt-4 text-sm">
              <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full">
                ⚡ Instant
              </span>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            setTransferMethod("international");
            setFormData((prev) => ({ ...prev, transferType: "international" }));
            navigate("?step=form");
          }}
          className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Transfer to Others Bank or Internationally
            </h3>
            <p className="text-gray-600">
              Send money to others bank or foreign account
            </p>
            <div className="mt-4 text-sm">
              <span className="inline-block bg-orange-100 text-orange-800 px-3 py-1 rounded-full">
                📅 1-3 business days (International)
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  // Step 2: Transfer Form
  const renderTransferForm = () => (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {transferMethod === "domestic"
                ? "Domestic Transfer"
                : "International Transfer"}
            </h1>
            <p className="text-gray-600">Enter recipient details</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleNext();
          }}
        >
          {transferMethod === "domestic" ? (
            // Domestic Transfer Form
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Account Number *
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={handleAccountNumberChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter account number"
                  required
                />
              </div>

              {isSearching ? (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600"
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
                    Searching for recipient...
                  </p>
                </div>
              ) : searchError ? (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{searchError}</p>
                </div>
              ) : foundRecipient ? (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✓ Transfer to: {foundRecipient.firstName}{" "}
                    {foundRecipient.lastName}
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {userData.account.currency}
                  </span>
                  <input
                    type="text"
                    value={amount ? formatAmount(amount) : ""}
                    onChange={handleAmountChange}
                    className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <CustomSelect
                    id="status"
                    name="status"
                    value={formData.status || "completed"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e  }))}
                    options={statusOptions}
                    placeholder="Select status"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    // defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter Date"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Payment for..."
                />
              </div>
                 <div className="flex  items-center gap-2">
                  <input
                    type="checkbox"
                    id="sendEmail"
                    name="sendEmail"
                    checked={formData.sendEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                   <label
                    htmlFor="reference"
                    className="block text-sm font-medium text-gray-700 "
                  >
                    Send Email Receipt
                  </label>
                </div>
            </div>
          ) : (
            // International Transfer Form
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Name *
                </label>
                <input
                  type="text"
                  value={formData.recipientName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      recipientName: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country *
                </label>
                <CustomSelect
                  id="country-select"
                  name="country"
                  value={formData.country}
                  onChange={handleCountryChange}
                  options={countryOptions}
                  placeholder="Select country"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name *
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      bankName: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter bank name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type *
                </label>
                <CustomSelect
                  id="account-type-select"
                  name="accountType"
                  value={formData.accountType}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, accountType: value }))
                  }
                  options={accountTypeOptions}
                  placeholder="Select account type"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number *
                </label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      accountNumber: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter account number"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency *
                </label>
                <CustomSelect
                  id="currency-select"
                  name="currency"
                  value={formData.currency}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, currency: value }))
                  }
                  options={currencyOptions}
                  placeholder="Select currency"
                  required
                />
              </div>

              {/* Conditional banking fields based on country */}
              {requiredFields.routingNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Routing Number *
                  </label>
                  <input
                    type="text"
                    value={formData.routingNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        routingNumber: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="9-digit routing number"
                    maxLength={9}
                    required
                  />
                </div>
              )}

              {requiredFields.sortCode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort Code *
                  </label>
                  <input
                    type="text"
                    value={formData.sortCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sortCode: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="XX-XX-XX"
                    maxLength={8}
                    required
                  />
                </div>
              )}

              {requiredFields.iban && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IBAN *
                  </label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, iban: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter IBAN"
                    maxLength={34}
                    required
                  />
                </div>
              )}

              {requiredFields.swiftCode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SWIFT/BIC Code *
                  </label>
                  <input
                    type="text"
                    value={formData.swiftCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        swiftCode: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter SWIFT code"
                    maxLength={11}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <CustomSelect
                  id="status"
                  name="status"
                  value={formData.status || "completed"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e  }))}
                  options={statusOptions}
                  placeholder="Select status"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date || new Date().toISOString().split("T")[0]}
                //   defaultValue={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter account number"
                  required
                />
              </div>

               <div className="flex  items-center gap-2">
                  <input
                    type="checkbox"
                    id="sendEmail"
                    name="sendEmail"
                    checked={formData.sendEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                   <label
                    htmlFor="sendEmail"
                    className="block text-sm font-medium text-gray-700 "
                  >
                    Send Email Receipt
                  </label>
                </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Address *
                </label>
                <textarea
                  value={formData.bankAddress}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      bankAddress: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Complete bank address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {formData.currency || "$"}
                  </span>
                  <input
                    type="text"
                    value={amount ? formatAmount(amount) : ""}
                    onChange={handleAmountChange}
                    min={1}
                    className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Payment for..."
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-6">
            <button
              type="submit"
              disabled={
                fetcher.state !== "idle" ||
                !formData.accountNumber ||
                (transferMethod === "domestic" && !foundRecipient) ||
                userData.account.number === formData.accountNumber ||
                parseFloat(formData.amount) <= 0
              }
              className="bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Step 3: Transfer Summary
  const renderSummary = () => (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Review Transfer</h1>
        <p className="text-gray-600">Please confirm your transfer details</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Transfer Overview */}
          <div className="text-center p-6 bg-blue-50 rounded-lg">
            <h2 className="text-3xl font-bold text-blue-900">
              {formData.currency || userData.account.currency}{" "}
              {formatAmount(amount)}
            </h2>
            <p className="text-blue-700 mt-1">
              {transferMethod === "domestic"
                ? "Domestic Transfer"
                : "International Transfer"}
            </p>
          </div>

          {/* Recipient Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Recipient
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Name</span>
                <span className="font-medium">
                  {foundRecipient
                    ? `${foundRecipient.firstName} ${foundRecipient.lastName}`
                    : formData.recipientName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Account Number</span>
                <span className="font-medium">{formData.accountNumber}</span>
              </div>
             
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className="font-medium">{formData.status}</span>
              </div>
             
              <div className="flex justify-between">
                <span className="text-gray-600">Date</span>
                <span className="font-medium">{formData.date}</span>
              </div>
             
              {transferMethod === "international" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bank</span>
                    <span className="font-medium">{formData.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Country</span>
                    <span className="font-medium">
                      {getCountryLabel(formData.country)}
                    </span>
                  </div>
                  {requiredFields.routingNumber && formData.routingNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Routing Number</span>
                      <span className="font-medium">
                        {formData.routingNumber}
                      </span>
                    </div>
                  )}
                  {requiredFields.sortCode && formData.sortCode && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sort Code</span>
                      <span className="font-medium">{formData.sortCode}</span>
                    </div>
                  )}
                  {requiredFields.iban && formData.iban && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">IBAN</span>
                      <span className="font-medium">{formData.iban}</span>
                    </div>
                  )}
                  {requiredFields.swiftCode && formData.swiftCode && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">SWIFT Code</span>
                      <span className="font-medium">{formData.swiftCode}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Transfer Details */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Transfer Details
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-medium">
                  {formData.currency || userData.account.currency}{" "}
                  {formatAmount(amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Transfer Fee</span>
                <span className="font-medium text-green-600">
                  {transferMethod === "domestic" ? "FREE" : "$2.99"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processing Time</span>
                <span className="font-medium">
                  {transferMethod === "domestic"
                    ? "Instant"
                    : "1-3 business days"}
                </span>
              </div>
              {formData.description && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Description</span>
                  <span className="font-medium">{formData.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total Amount</span>
              <span>
                {formData.currency || userData.account.currency}{" "}
                {formatAmount(
                  (
                    Number(amount) +
                    (transferMethod === "international" ? 2.99 : 0)
                  ).toString()
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-600 mt-1">
              <span>Remaining Balance</span>
              <span>
                {userData.account.currency}{" "}
                {(
                  userBalance -
                  Number(amount) -
                  (transferMethod === "international" ? 2.99 : 0)
                ).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6">
          <button
            onClick={handleNext}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  // Step 4: PIN Entry
  const renderPinEntry = () => (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Enter Your PIN
        </h1>
        <p className="text-gray-600">
          Please enter your 4-digit PIN to authorize this transfer
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          <div>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                setPin(value);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl tracking-widest"
              placeholder="••••"
              maxLength={4}
              autoFocus
            />
          </div>

          {!fetcher.data?.success && fetcher.data?.error && (
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
                <p className="text-red-700 text-sm">{fetcher.data.message}</p>
              </div>
            </div>
          )}

          <div className="flex md:flex-row flex-col-reverse space-y-3 gap-3">
            <button
              onClick={handleBack}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handlePinConfirm}
              disabled={
                pin.length !== 4 ||
                isSubmitting ||
                (transferMethod === "domestic" && !foundRecipient) ||
                userData.account.number === foundRecipient?.accountNumber ||
                userData.account.number === formData.accountNumber
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
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
                  Processing...
                </div>
              ) : (
                "Confirm "
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Step 5: Success Screen
  const renderSuccess = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-10 h-10 text-green-600"
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
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Transfer Successful!
        </h1>
        <p className="text-gray-600">
          {fetcher?.data?.message || "Your transfer has been processed"}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="space-y-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-800">
              {formData.currency || userData.account.currency}{" "}
              {formatAmount(amount)}
            </p>
            <p className="text-green-600 text-sm mt-1">
              {transferMethod === "domestic"
                ? "Transferred instantly"
                : "Processing (1-3 business days)"}
            </p>
          </div>

          {fetcher.data?.reference && (
            <div>
              <p className="text-sm text-gray-600 mb-1">
                Transaction Reference
              </p>
              <p className="font-mono text-sm bg-gray-100 p-2 rounded border">
                {fetcher.data.reference}
              </p>
            </div>
          )}

          <div className="text-left">
            <p className="text-sm text-gray-600 mb-1">Recipient</p>
            <p className="font-medium">
              {foundRecipient
                ? `${foundRecipient.firstName} ${foundRecipient.lastName}`
                : formData.recipientName}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => handleMakeAnotherTransfer()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Make Another Transfer
        </button>
        <button
          onClick={() => navigate("/admin")}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  

  
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Step Content */}
        {step === "select" && renderTransferSelection()}
        {step === "form" && renderTransferForm()}
        {step === "summary" && renderSummary()}
        {step === "pin" && renderPinEntry()}
        {step === "success" && renderSuccess()}
      </div>
    </div>
  );
}
