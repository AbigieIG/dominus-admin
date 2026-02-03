import { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Lock,
  Unlock,
  Calendar,
  Activity,
  ToggleLeft,
  ToggleRight,
  X,
  AlertTriangle,
  Edit3,
  Trash2,
} from "lucide-react";
import type { Route } from "./+types/cards";

import { CardService, type CardRequestOptions } from "~/utils/card.server";
import { CardType } from "~/models/card.server";
import { getUserModel } from "~/models/user.server";
import {
  useLoaderData,
  useActionData,
  useNavigate,
  useSubmit,
  useFetcher,
  useNavigation,
  Link,
  Form,
  type MetaFunction,
} from "react-router";
import "~/css/pettern.css";
import type { ICard } from "~/types";

// Types (keeping existing types)

type ActionData = {
  success: boolean;
  error: string;
  message: string;
  intent?: string;
  cardId?: string;
};

interface CardsResponse {
  success: boolean;
  cards: ICard[];
  accountBalance: number;
  userInfo: {
    firstName: string;
    lastName: string;
  };
  error?: string;
  userId: string;
}

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Cards | ${settings.site.title}`},
  ];
};

// Loader and Action functions remain the same as provided

export const loader = async ({ params }: Route.LoaderArgs) => {
  try {
    const { userId } = params;
    const cardService = CardService.getInstance();

    const { cards } = await cardService.getUserCards(userId);
    const User = await getUserModel();
    const user = await User.findById(userId).select(
      "account firstName lastName"
    );

    if (!user) {
      throw new Error("User not found");
    }

    return Response.json({
      cards: cards.map((card) => ({
        ...card,
        id: card._id,
        name: `${card.type.charAt(0).toUpperCase() + card.type.slice(1)} Card`,
        number: card.cardNumber,
        expiry: new Date(card.expiryDate)
          .toLocaleDateString("en-US", { month: "2-digit", year: "2-digit" })
          .replace("/", "/"),
        cvv: card.cvv,
        pin: card.pin,
        balance: card.currentSpend
          ? card.monthlyLimit - card.currentSpend.monthly
          : card.monthlyLimit,
        type:
          card.type === "debit"
            ? "Visa"
            : card.type === "credit"
              ? "Mastercard"
              : "Amex",
        color:
          card.type === "debit"
            ? "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)"
            : card.type === "credit"
              ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              : "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
        limit: card.monthlyLimit,
        textColor: "#ffffff",
        isActive: card.status === "active",
        transactions:
          card.transactions?.slice(0, 10).map((t) => ({
            id: t._id || Math.random(),
            type:
              t.type === "purchase" ||
              t.type === "atm_withdrawal" ||
              t.type === "fee"
                ? "debit"
                : "credit",
            amount: t.amount,
            description: t.merchant || "Transaction",
            date: new Date(t.date).toISOString().split("T")[0],
            category:
              t.type === "purchase"
                ? "Shopping"
                : t.type === "atm_withdrawal"
                  ? "Cash"
                  : t.type === "online_payment"
                    ? "Online"
                    : t.type === "transfer"
                      ? "Transfer"
                      : t.type === "refund"
                        ? "Refund"
                        : "Fee",
          })) || [],
      })),
      accountBalance: user.account.balance,
      userId,
      userInfo: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Loader error:", error);
    return Response.json({ error: error }, { status: 500 });
  }
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  try {
    const formData = await request.formData();
    const intent = formData.get("intent");
    const { userId } = params;

    const cardService = CardService.getInstance();

    switch (intent) {
      case "request-card": {
        const cardType = formData.get("cardType") as string;
        const expedited = formData.get("expedited") === "true";
        const requestedLimit =
          parseInt(formData.get("requestedLimit") as string) || 1000;

        let backendCardType: CardType;
        switch (cardType) {
          case "Visa":
            backendCardType = CardType.DEBIT;
            break;
          case "Mastercard":
            backendCardType = CardType.CREDIT;
            break;
          case "Amex":
            backendCardType = CardType.DEBIT;
            break;
          default:
            throw new Error("Invalid card type");
        }

        const options: CardRequestOptions = {
          userId: userId as string,
          cardType: backendCardType,
          requestedLimit,
          expedited,
        };

        const result = await cardService.requestCard(options);

        return Response.json({
          success: true,
          message: result.message,
          feesCharged: result.feesCharged,
          newBalance: result.newBalance,
          intent: "request-card",
        });
      }

      case "change-pin": {
        const cardId = formData.get("cardId") as string;
        const newPin = formData.get("newPin") as string;
        const confirmPin = formData.get("confirmPin") as string;

        if (newPin !== confirmPin) {
          return Response.json(
            {
              error: "PINs don't match",
              success: false,
              intent: "change-pin",
              cardId,
            },
            { status: 400 }
          );
        }

        if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
          return Response.json(
            {
              error: "PIN must be 4 digits",
              success: false,
              intent: "change-pin",
              cardId,
            },
            { status: 400 }
          );
        }

        await cardService.changePin(cardId, userId as string, newPin);

        return Response.json({
          success: true,
          message: "PIN changed successfully",
          intent: "change-pin",
          cardId,
        });
      }

      case "toggle-card-status": {
        const cardId = formData.get("cardId") as string;

        const result = await cardService.toggleCardStatus(
          cardId,
          userId as string
        );

        return Response.json({
          success: true,
          message: result.message,
          intent: "toggle-card-status",
          cardId,
        });
      }

      case "report-card": {
        const cardId = formData.get("cardId") as string;
        const reason = (formData.get("reason") as string) || "lost";

        const result = await cardService.reportCard(
          cardId,
          userId as string,
          reason as "lost" | "stolen"
        );

        return Response.json({
          success: true,
          message: result.message,
          intent: "report-card",
          cardId,
        });
      }

      case "delete-transaction": {
        const cardId = formData.get("cardId") as string;
        const transactionId = formData.get("transactionId") as string;

        const result = await cardService.deleteTransaction(
          cardId,
          userId as string,
          transactionId
        );

        return Response.json({
          success: true,
          message: result.message,
          intent: "delete-transaction",
          cardId,
        });
      }

      default:
        return Response.json(
          {
            error: "Invalid intent",
            success: false,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Action error:", error);
    return Response.json(
      {
        error: error || "An unexpected error occurred",
        success: false,
      },
      { status: 500 }
    );
  }
};

const getCardPattern = (cardType: string) => {
  switch (cardType) {
    case "Visa":
      return "pattern-4";
    case "Mastercard":
      return "pattern-4";
    case "Amex":
      return "pattern-4";
    default:
      return "pattern-4";
  }
};

export default function CreditCardPage() {
  const { cards, userInfo, userId } = useLoaderData<CardsResponse>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher();

  const [showNumbers, setShowNumbers] = useState<Record<string, boolean>>({});
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedCardType, setSelectedCardType] = useState<
    "Visa" | "Mastercard" | "Amex" | null
  >(null);
  const [reportReason, setReportReason] = useState<"lost" | "stolen">("lost");
  const [expeditedDelivery, setExpeditedDelivery] = useState(false);
  const [requestedLimit, setRequestedLimit] = useState(1000);
  const [pinForm, setPinForm] = useState({
    newPin: "",
    confirmPin: "",
  });

  // Loading states
  const isSubmitting = navigation.state === "submitting";
  const isRequestingCard =
    isSubmitting && navigation.formData?.get("intent") === "request-card";
  const isChangingPin =
    isSubmitting && navigation.formData?.get("intent") === "change-pin";
  const isTogglingStatus =
    isSubmitting && navigation.formData?.get("intent") === "toggle-card-status";
  const isReportingCard =
    isSubmitting && navigation.formData?.get("intent") === "report-card";

  // Handle URL params for selected card
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get("card");
    if (cardId) {
      setSelectedCard(cardId);
    }
  }, []);

  // Handle action results
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        switch (actionData.intent) {
          case "request-card":
            setShowAddCardModal(false);
            setSelectedCardType(null);
            setExpeditedDelivery(false);
            setRequestedLimit(1000);
            // Show success notification
            break;
          case "change-pin":
            setShowPinModal(false);
            setPinForm({ newPin: "", confirmPin: "" });
            break;
          case "report-card":
            setShowReportModal(false);
            break;
        }
      }
    }
  }, [actionData]);

  const updateURL = (cardId: string | null) => {
    const url = new URL(window.location.href);
    if (cardId) {
      url.searchParams.set("card", cardId.toString());
    } else {
      url.searchParams.delete("card");
    }
    navigate(`?${url.searchParams.toString()}`);
  };

  const handleCardSelect = (cardId: string) => {
    setLoading(true);
    setSelectedCard(cardId);
    updateURL(cardId);
    setTimeout(() => setLoading(false), 800);
  };

  const handleBackToCards = () => {
    setLoading(true);
    setSelectedCard(null);
    updateURL(null);
    setTimeout(() => setLoading(false), 500);
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const cardId = urlParams.get("card");
      setSelectedCard(cardId ? cardId : null);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("popstate", handlePopState);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("popstate", handlePopState);
      }
    };
  }, []);

  const toggleCardNumber = (cardId: string) => {
    setShowNumbers((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const toggleCardStatus = (cardId: string) => {
    const formData = new FormData();
    formData.append("intent", "toggle-card-status");
    formData.append("cardId", cardId);
    submit(formData, { method: "post" });
  };

  const handleRequestPin = () => {
    setShowPinModal(true);
    setPinForm({ newPin: "", confirmPin: "" });
  };

  const handleReportCard = () => {
    setShowReportModal(true);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Only allow digits and max 4 characters
    if (/^\d{0,4}$/.test(value)) {
      setPinForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const submitPinChange = () => {
    if (!selectedCard) return;

    const formData = new FormData();
    formData.append("intent", "change-pin");
    formData.append("cardId", selectedCard);
    formData.append("newPin", pinForm.newPin);
    formData.append("confirmPin", pinForm.confirmPin);
    submit(formData, { method: "post" });
  };

  const submitCardRequest = () => {
    if (!selectedCardType) return;

    const formData = new FormData();
    formData.append("intent", "request-card");
    formData.append("cardType", selectedCardType);
    formData.append("expedited", expeditedDelivery.toString());
    formData.append("requestedLimit", requestedLimit.toString());
    submit(formData, { method: "post" });
  };

  const submitReportCard = () => {
    if (!selectedCard) return;

    const formData = new FormData();
    formData.append("intent", "report-card");
    formData.append("cardId", selectedCard);
    formData.append("reason", reportReason);
    submit(formData, { method: "post" });
  };

  const formatCardNumber = (number: string, isVisible: boolean) => {
    // Remove all non-digit characters first
    const digitsOnly = number.replace(/\D/g, "");

    if (isVisible) {
      // Group digits into chunks of 4 and join with spaces
      return digitsOnly.match(/.{1,4}/g)?.join(" ") || "";
    }

    // For hidden view, show last 4 digits
    return `•••• •••• •••• ${digitsOnly.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTransactionIcon = (type: string) => {
    if (type === "credit")
      return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    return <ArrowUpRight className="w-4 h-4 text-red-600 rotate-180" />;
  };

  const selectedCardData = cards.find((card) => card.id === selectedCard);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto bg-gradient-to-br  min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Success notification component
  const SuccessNotification = ({ message }: { message: string }) => (
    <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
      <div className="flex items-center">
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 13l4 4L19 7"
          ></path>
        </svg>
        {message}
      </div>
    </div>
  );

  if (selectedCard && selectedCardData) {
    return (
      <div className="max-w-7xl mx-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        {/* Show success notification */}
        {actionData?.success && actionData.message && (
          <SuccessNotification message={actionData.message} />
        )}

        {/* Header with Back Button */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={handleBackToCards}
              className="flex items-center text-slate-600 hover:text-slate-800 mr-4 p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Cards
            </button>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {selectedCardData.name}
          </h1>
          <p className="text-slate-600">Card details and transaction history</p>
        </div>

        {/* Selected Card Display */}
        <div className="mb-8">
          <div className="relative flex-shrink-0 mb-4">
            <div
              className="relative w-80 h-48 pattern-4 rounded-2xl p-5 shadow-lg transition-all duration-300 transform overflow-hidden"
              style={{
                background:
                  selectedCardData.color ??
                  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                boxShadow:
                  "inset 0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {/* Card content */}
              <div className="flex justify-between items-start mb-3">
                <div className="text-white">
                  <h3 className="text-sm font-bold tracking-wide">
                    {settings.site.short_name.toUpperCase()}
                  </h3>
                  <p className="text-xs opacity-80">BANK</p>
                </div>
                <button
                  onClick={() => toggleCardNumber(selectedCardData.id)}
                  className="text-white opacity-70 hover:opacity-100 transition-opacity p-1"
                >
                  {showNumbers[selectedCardData.id] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex justify-between items-center mb-3">
                <div className="w-10 h-7 bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-400 rounded-md shadow-sm border border-yellow-500/20">
                  <div className="w-full h-full rounded-md bg-gradient-to-br from-yellow-100/50 to-transparent flex items-center justify-center">
                    <div className="grid grid-cols-3 gap-0.5 w-5 h-3">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 h-0.5 bg-yellow-600/40 rounded-full"
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-white/90">
                  {selectedCardData.type === "Visa" && (
                    <div className="text-lg font-bold italic">VISA</div>
                  )}
                  {selectedCardData.type === "Mastercard" && (
                    <div className="flex">
                      <div className="w-6 h-6 bg-red-500 rounded-full"></div>
                      <div className="w-6 h-6 bg-yellow-400 rounded-full -ml-3"></div>
                    </div>
                  )}
                  {selectedCardData.type === "Amex" && (
                    <div className="text-sm font-bold">AMEX</div>
                  )}
                </div>
              </div>

              <div className="mb-2">
                <p className="text-white text-lg font-mono tracking-[0.15em] font-medium">
                  {formatCardNumber(
                    selectedCardData.number,
                    showNumbers[selectedCardData.id]
                  )}
                </p>
              </div>

              <div className="flex justify-between items-end">
                <div className="flex-1">
                  <p className="text-white/70 text-xs font-medium mb-0.5 tracking-wide">
                    CARD HOLDER
                  </p>
                  <p className="text-white font-bold text-xs tracking-wide truncate pr-2">
                    {selectedCardData.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-xs font-medium mb-0.5 tracking-wide">
                    VALID THRU
                  </p>
                  <p className="text-white font-bold text-xs tracking-wide">
                    {selectedCardData.expiry}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card Status Badge */}
          <div className="flex items-center space-x-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                selectedCardData.isActive
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {selectedCardData.isActive ? (
                <>
                  <Unlock className="w-3 h-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 mr-1" />
                  Deactivated
                </>
              )}
            </span>
          </div>
        </div>

        {/* Card Details and Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Card Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              Card Details
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-600">Card Number</span>
                <span className="font-mono text-slate-900">
                  {formatCardNumber(
                    selectedCardData.number,
                    showNumbers[selectedCardData.id]
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-600">CVV</span>
                <span className="font-mono text-slate-900">
                  {showNumbers[selectedCardData.id]
                    ? selectedCardData.cvv
                    : "•••"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-600">PIN</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-slate-900">
                    {showPin ? selectedCardData.pin : "••••"}
                  </span>
                  <button
                    onClick={() => setShowPin(!showPin)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                  >
                    {showPin ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-600">Credit Limit</span>
                <span className="font-medium text-slate-900">
                  ${selectedCardData.limit.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-600">Names</span>
                <span className="font-medium text-slate-900">
                  {userInfo.firstName} {userInfo.lastName}
                </span>
              </div>
            </div>
          </div>

          {/* Card Controls */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Card Controls
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Card Status</p>
                  <p className="text-sm text-slate-600">
                    {selectedCardData.isActive
                      ? "Card is active and ready to use"
                      : "Card is currently deactivated"}
                  </p>
                </div>
                <button
                  onClick={() => toggleCardStatus(selectedCardData.id)}
                  className="flex items-center"
                  disabled={isTogglingStatus}
                >
                  {isTogglingStatus ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  ) : selectedCardData.isActive ? (
                    <ToggleRight className="w-8 h-8 text-green-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-400" />
                  )}
                </button>
              </div>

              <button
                onClick={handleRequestPin}
                disabled={isChangingPin}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {isChangingPin ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  "Change PIN"
                )}
              </button>

              <button
                onClick={handleReportCard}
                disabled={isReportingCard}
                className="w-full bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:cursor-not-allowed text-slate-700 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {isReportingCard ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600 mr-2"></div>
                    Reporting...
                  </>
                ) : (
                  "Report Lost/Stolen"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200 flex flex-wrap justify-between ">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Transaction History
            </h3>
            <Link
              to={`/admin/card/create-trans/${selectedCardData.id}/${userId}`}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              Add Trans
            </Link>
          </div>

          <div className="divide-y divide-slate-200">
            {selectedCardData.transactions.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No transactions yet
              </div>
            ) : (
              selectedCardData.transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-2 rounded-lg ${
                        transaction.type === "credit"
                          ? "bg-green-100"
                          : "bg-red-100"
                      }`}
                    >
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {transaction.description}
                      </p>
                      <p className="text-sm text-slate-600">
                        {transaction.category} • {formatDate(transaction.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        transaction.type === "credit"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "credit" ? "+" : "-"}$
                      {transaction.amount.toFixed(2)}
                    </p>
                    <div className="flex justify-end space-x-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(
                          `/admin/card/edit-card/${userId}/${selectedCardData.id}/${transaction.id}`
                        );
                      }}
                      className="text-gray-600 hover:text-gray-900"
                      title="Edit User"
                    >
                      <Edit3 size={16} />
                    </button>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="transactionId"
                        value={transaction.id}
                        className="hidden"
                      />
                      <input
                        type="hidden"
                        name="cardId"
                        value={selectedCardData.id}
                        className="hidden"
                      />
                      <input
                        type="hidden"
                        name="intent"
                        value="delete-transaction"
                        className="hidden"
                      />
                      <button
                        type="submit"
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete User"
                      >
                        {isSubmitting ? "loading..." : <Trash2 size={16} />}
                      </button>
                    </Form>
                  </div>
                  </div>
                  
                </div>
              ))
            )}
          </div>
        </div>

        {/* PIN Change Modal */}
        {showPinModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Change PIN</h3>
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setPinForm({ newPin: "", confirmPin: "" });
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {actionData?.error && actionData.intent === "change-pin" && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                  {actionData.error}
                </div>
              )}

              {actionData?.success && actionData.intent === "change-pin" ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium mb-2">
                    PIN Changed Successfully
                  </h4>
                  <p className="text-slate-600 mb-6">
                    Your card PIN has been updated
                  </p>
                  <button
                    onClick={() => {
                      setShowPinModal(false);
                      setPinForm({ newPin: "", confirmPin: "" });
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        New PIN
                      </label>
                      <input
                        type="password"
                        name="newPin"
                        value={pinForm.newPin}
                        onChange={handlePinChange}
                        maxLength={4}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter 4-digit PIN"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Confirm PIN
                      </label>
                      <input
                        type="password"
                        name="confirmPin"
                        value={pinForm.confirmPin}
                        onChange={handlePinChange}
                        maxLength={4}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Confirm 4-digit PIN"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={() => {
                        setShowPinModal(false);
                        setPinForm({ newPin: "", confirmPin: "" });
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 rounded-lg"
                      disabled={isChangingPin}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitPinChange}
                      disabled={
                        pinForm.newPin.length !== 4 ||
                        pinForm.confirmPin.length !== 4 ||
                        isChangingPin
                      }
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isChangingPin ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Changing...
                        </>
                      ) : (
                        "Change PIN"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Report Card Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold flex items-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
                  Report Card
                </h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-slate-600 mb-4">
                  Please select the reason for reporting this card:
                </p>

                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reason"
                      value="lost"
                      checked={reportReason === "lost"}
                      onChange={(e) =>
                        setReportReason(e.target.value as "lost" | "stolen")
                      }
                      className="mr-3"
                    />
                    <span>Lost Card</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reason"
                      value="stolen"
                      checked={reportReason === "stolen"}
                      onChange={(e) =>
                        setReportReason(e.target.value as "lost" | "stolen")
                      }
                      className="mr-3"
                    />
                    <span>Stolen Card</span>
                  </label>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Important:</p>
                    <p>
                      This action will immediately deactivate your card and
                      prevent any future transactions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 rounded-lg"
                  disabled={isReportingCard}
                >
                  Cancel
                </button>
                <button
                  onClick={submitReportCard}
                  disabled={isReportingCard}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white py-2 rounded-lg disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isReportingCard ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Reporting...
                    </>
                  ) : (
                    "Report Card"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Show success notification */}
      {actionData?.success && actionData.message && (
        <SuccessNotification message={actionData.message} />
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl md:text-xl font-bold text-slate-900 mb-2">
              Your Cards
            </h1>
          </div>
          <button
            onClick={() => setShowAddCardModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center space-x-2 transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
            disabled={isRequestingCard}
          >
            <Plus className="w-4 h-4" />
            <span>Add Card</span>
          </button>
        </div>
        <p className="text-slate-600">
          Manage your credit cards and view transactions
        </p>
      </div>

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Request New Card</h3>
              <button
                onClick={() => {
                  setShowAddCardModal(false);
                  setSelectedCardType(null);
                  setExpeditedDelivery(false);
                  setRequestedLimit(1000);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {actionData?.error && actionData.intent === "request-card" && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {actionData.error}
              </div>
            )}

            {actionData?.success && actionData.intent === "request-card" ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
                <h4 className="text-lg font-medium mb-2">
                  Card Request Submitted
                </h4>
                <p className="text-slate-600 mb-6">
                  Your {selectedCardType} card request has been received. You'll
                  receive your new card within 5-7 business days.
                </p>
                <button
                  onClick={() => {
                    setShowAddCardModal(false);
                    setSelectedCardType(null);
                    setExpeditedDelivery(false);
                    setRequestedLimit(1000);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  <div>
                    <p className="text-slate-600 mb-4">
                      Select the type of card you'd like to request:
                    </p>

                    <div className="grid grid-cols-3 gap-4">
                      <button
                        onClick={() => setSelectedCardType("Visa")}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          selectedCardType === "Visa"
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-lg font-bold italic text-blue-800">
                          VISA
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Debit Card
                        </div>
                      </button>

                      <button
                        onClick={() => setSelectedCardType("Mastercard")}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          selectedCardType === "Mastercard"
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex justify-center mb-1">
                          <div className="w-6 h-6 bg-red-500 rounded-full"></div>
                          <div className="w-6 h-6 bg-yellow-400 rounded-full -ml-3"></div>
                        </div>
                        <div className="text-xs text-slate-600">
                          Credit Card
                        </div>
                      </button>

                      <button
                        onClick={() => setSelectedCardType("Amex")}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          selectedCardType === "Amex"
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="text-sm font-bold text-green-800 mb-1">
                          AMERICAN EXPRESS
                        </div>
                        <div className="text-xs text-slate-600">Debit Card</div>
                      </button>
                    </div>
                  </div>

                  {selectedCardType && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Requested Limit
                        </label>
                        <select
                          value={requestedLimit}
                          onChange={(e) =>
                            setRequestedLimit(parseInt(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={1000}>$1,000</option>
                          <option value={2500}>$2,500</option>
                          <option value={5000}>$5,000</option>
                          <option value={10000}>$10,000</option>
                          <option value={25000}>$25,000</option>
                        </select>
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={expeditedDelivery}
                            onChange={(e) =>
                              setExpeditedDelivery(e.target.checked)
                            }
                            className="mr-3"
                          />
                          <span className="text-sm">
                            Expedited delivery (2-3 business days) - Additional
                            $25 fee
                          </span>
                        </label>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Processing Fee:</p>
                          <p>Card issuance: $10</p>
                          {expeditedDelivery && <p>Expedited delivery: $25</p>}
                          <p className="font-bold mt-2">
                            Total: ${expeditedDelivery ? 35 : 10}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={() => {
                      setShowAddCardModal(false);
                      setSelectedCardType(null);
                      setExpeditedDelivery(false);
                      setRequestedLimit(1000);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 rounded-lg"
                    disabled={isRequestingCard}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitCardRequest}
                    disabled={!selectedCardType || isRequestingCard}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isRequestingCard ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      "Request Card"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cards Grid */}
      <div className="md:grid flex flex-col md:flex-none md:grid-cols-2 items-center lg:grid-cols-3 gap-6 mb-8">
        {cards.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-slate-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                ></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No Cards Yet
            </h3>
            <p className="text-slate-600 mb-6">
              Get started by requesting your first card
            </p>
            <button
              onClick={() => setShowAddCardModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              Request Your First Card
            </button>
          </div>
        ) : (
          cards.map((card) => (
            <div key={card.id} className="relative flex-shrink-0">
              <div
                onClick={() => handleCardSelect(card.id)}
                className={`relative ${getCardPattern(
                  card.type
                )} w-80 h-48 rounded-2xl p-5 shadow-lg transition-all duration-300 transform hover:-translate-y-1 overflow-hidden cursor-pointer`}
                style={{
                  background:
                    card.color ??
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                {/* Card content */}
                <div className="flex justify-between items-start mb-3">
                  <div className="text-white">
                    <h3 className="text-sm font-bold tracking-wide">
                      {settings.site.short_name.toUpperCase()}
                    </h3>
                    <p className="text-xs opacity-80">BANK</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCardNumber(card.id);
                    }}
                    className="text-white opacity-70 hover:opacity-100 transition-opacity p-1"
                  >
                    {showNumbers[card.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex justify-between items-center mb-3">
                  <div className="w-10 h-7 bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-400 rounded-md shadow-sm border border-yellow-500/20">
                    <div className="w-full h-full rounded-md bg-gradient-to-br from-yellow-100/50 to-transparent flex items-center justify-center">
                      <div className="grid grid-cols-3 gap-0.5 w-5 h-3">
                        {[...Array(12)].map((_, i) => (
                          <div
                            key={i}
                            className="w-0.5 h-0.5 bg-yellow-600/40 rounded-full"
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-white/90">
                    {card.type === "Visa" && (
                      <div className="text-lg font-bold italic">VISA</div>
                    )}
                    {card.type === "Mastercard" && (
                      <div className="flex">
                        <div className="w-6 h-6 bg-red-500 rounded-full"></div>
                        <div className="w-6 h-6 bg-yellow-400 rounded-full -ml-3"></div>
                      </div>
                    )}
                    {card.type === "UnionPay" && (
                      <div className="text-sm font-bold">{settings.site.short_name}</div>
                    )}
                  </div>
                </div>

                <div className="mb-2">
                  <p className="text-white text-lg font-mono tracking-[0.15em] font-medium">
                    {formatCardNumber(card.number, showNumbers[card.id])}
                  </p>
                </div>

                <div className="flex justify-between items-end">
                  <div className="flex-1">
                    <p className="text-white/70 text-xs font-medium mb-0.5 tracking-wide">
                      CARD HOLDER
                    </p>
                    <p className="text-white font-bold text-xs tracking-wide truncate pr-2">
                      {card.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/70 text-xs font-medium mb-0.5 tracking-wide">
                      VALID THRU
                    </p>
                    <p className="text-white font-bold text-xs tracking-wide">
                      {card.expiry}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card status indicator */}
              <div className="absolute -top-2 -right-2">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    card.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {card.isActive ? (
                    <>
                      <Unlock className="w-3 h-3 mr-1" />
                      Active
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 mr-1" />
                      Inactive
                    </>
                  )}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
