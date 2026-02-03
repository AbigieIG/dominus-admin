import React from "react";
import {
  Download,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { TransactionType } from "~/types";
import settings from "~/assets/settings.json";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// Types based on your existing structure
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
  type: string;
  amount: number;
  currency: string;
  description: string;
  status: "completed" | "pending" | "failed";
  reference: string;
  createdAt: string;
  updatedAt: string;
  fromAccount: PopulatedAccount;
  toAccount?: PopulatedAccount;
  metadata?: {
    email?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    beneficiaryAccount?: string | undefined;
    beneficiaryBankName?: string | undefined;
    [key: string]: string | undefined;
  };
};

type TransactionReceiptProps = {
  transaction: DatabaseTransaction;
  currentUserId: string;
  onBack: () => void;
  onDownloadReceipt?: () => void;
};

const TransactionReceipt: React.FC<TransactionReceiptProps> = ({
  transaction,
  currentUserId,
  onDownloadReceipt,
}) => {
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " " +
      date.toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
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
        ? { direction: "debit", label: "PayPal Payment" }
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


  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const transactionDirection = getTransactionDirection(transaction);


 const handleDownloadPDF = async () => {
    try {
      const receiptElement = document.getElementById('receipt');
      if (!receiptElement) {
        console.error('Receipt element not found');
        return;
      }

      // Create canvas from the receipt element
      const canvas = await html2canvas(receiptElement, {
        scale: 3, // Higher resolution for better quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: receiptElement.offsetWidth,
        height: receiptElement.offsetHeight,
      });

      // Get actual receipt dimensions
      const receiptWidth = receiptElement.offsetWidth;
      const receiptHeight = receiptElement.offsetHeight;
      
      // Convert pixels to mm (assuming 96 DPI: 1 inch = 96 pixels = 25.4 mm)
      const pixelToMm = 25.4 / 96;
      const pdfWidthMm = receiptWidth * pixelToMm;
      const pdfHeightMm = receiptHeight * pixelToMm;

      
      const pdf = new jsPDF({
        orientation: pdfHeightMm > pdfWidthMm ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidthMm, pdfHeightMm], 
      });

      
      const imgData = canvas.toDataURL('image/png');
      
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);
      
      // Generate filename
      const filename = `receipt-${transaction.reference}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Download the PDF
      pdf.save(filename);
      
   
      if (onDownloadReceipt) {
        onDownloadReceipt();
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };


  return (
    <div  className="min-h-screen ">
      <div className="max-w-md mx-auto">
        {/* Receipt */}
        <div
        id="receipt"
          className="bg-white  shadow-lg relative overflow-hidden"
          style={{ fontFamily: "monospace" }}
        >
          {/* Watermark Pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(45deg, transparent, transparent 20px, #64748b 20px, #64748b 21px),
                  repeating-linear-gradient(-45deg, transparent, transparent 20px, #64748b 20px, #64748b 21px)
                `,
                backgroundSize: "40px 40px",
              }}
            ></div>
            {/* Bank Logo Watermark */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-45">
              <div className="text-6xl font-bold text-gray-300 opacity-20 whitespace-nowrap">
              {settings.site.name.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Receipt Header */}
          <div className="text-center py-6 px-4 border-b border-dashed border-gray-300 relative z-10">
            <img
              src="/logo-text.svg"
              alt=""
              className="w-h-12 mx-auto opacity-70"
            />
          </div>

          {/* Transaction Info */}
          <div className="px-4 py-4 relative z-10">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold">TRANSACTION RECEIPT</h2>
              <p className="text-sm text-gray-600">
                {formatDate(transaction.createdAt)}
              </p>
            </div>

            {/* Receipt Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                <span className="text-green-700">TRANS ID:</span>
                <span className="font-mono">{transaction._id}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                <span className="text-green-700">REF NO:</span>
                <span className="font-mono">{transaction.reference}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                <span className="text-green-700">TYPE:</span>
                <span>{transactionDirection.label}</span>
              </div>

              {/* PayPal specific fields */}
              {transaction.type === TransactionType.PAYPAL &&
                transaction.metadata && (
                  <>
                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">FROM ACCT:</span>
                      <div className="flex flex-col text-right gap-1">
                        <span className="font-mono">
                          {transaction.fromAccount.firstName}{" "}
                          {transaction.fromAccount.lastName}
                        </span>
                        <span className="font-mono">
                          ****{transaction.fromAccount.account.number.slice(-4)}
                        </span>
                        <span className="font-mono"> {settings.site.name}</span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">TO:</span>
                      <div className="flex flex-col text-right gap-1">
                        {transaction.metadata.email && (
                          <span className="font-mono text-xs">
                            EMAIL: {transaction.metadata.email}
                          </span>
                        )}
                        {transaction.metadata.name && (
                          <span className="font-mono text-xs">
                            NAMES: {transaction.metadata.name}
                          </span>
                        )}
                        {transaction.metadata.description && (
                          <span className="font-mono text-xs">
                            NOTE: {transaction.metadata.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              {transaction.type === TransactionType.WIRE_TRANSFER &&
                transaction.metadata && (
                  <>
                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">FROM ACCT:</span>
                      <div className="flex flex-col text-right gap-1">
                        <span className="font-mono text-xs">
                          {transaction.fromAccount.firstName}{" "}
                          {transaction.fromAccount.lastName}
                        </span>
                        <span className="font-mono text-xs">
                          ****{transaction.fromAccount.account.number.slice(-4)}
                        </span>
                        <span className="font-mono text-xs">
                           {settings.site.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">TO:</span>
                      <div className="flex flex-col  text-right gap-1">
                        {transaction.metadata.beneficiaryName && (
                          <span className="font-mono text-xs">
                            NAME: {transaction.metadata.beneficiaryName}
                          </span>
                        )}
                        {transaction.metadata.beneficiaryAccount && (
                          <span className="font-mono text-xs">
                            ACCT:{transaction.metadata.beneficiaryAccount}
                          </span>
                        )}
                        {transaction.metadata.beneficiaryBankName && (
                          <span className="font-mono text-xs">
                            BANK: {transaction.metadata.beneficiaryBankName}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              {transaction.type === TransactionType.TRANSFER &&
                transaction.toAccount && (
                  <>
                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">FROM ACCT:</span>
                      <div className="flex flex-col  text-right gap-1">
                        <span className="font-mono text-xs">
                          {transaction.fromAccount.firstName}{" "}
                          {transaction.fromAccount.lastName}
                        </span>
                        <span className="font-mono text-xs">
                          ****{transaction.fromAccount.account.number.slice(-4)}
                        </span>
                        <span className="font-mono text-xs">
                           {settings.site.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">TO:</span>
                      <div className="flex flex-col text-right gap-1">
                        <span className="font-mono text-xs">
                          NAMES: {transaction.toAccount.firstName}{" "}
                          {transaction.toAccount.lastName}
                        </span>
                        <span className="font-mono text-xs">
                          ACCT: {transaction.toAccount.account.number}
                        </span>
                        <span className="font-mono text-xs">
                           {settings.site.name}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              {transaction.type === TransactionType.TRANSFER &&
                !transaction.toAccount &&
                transaction.metadata && (
                  <>
                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">FROM ACCT:</span>
                      <div className="flex flex-col text-right gap-1">
                        <span className="font-mono text-xs">
                          {transaction.fromAccount.firstName}{" "}
                          {transaction.fromAccount.lastName}
                        </span>
                        <span className="font-mono text-xs">
                          ****{transaction.fromAccount.account.number.slice(-4)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">TO:</span>
                      <div className="flex flex-col text-right gap-1">
                        {transaction.metadata.recipientName && (
                          <span className="font-mono text-xs">
                            NAMES: {transaction.metadata.recipientName}
                          </span>
                        )}
                        {transaction.metadata.accountNumber && (
                          <span className="font-mono text-xs">
                            ACCT: {transaction.metadata.accountNumber}
                          </span>
                        )}
                        {transaction.metadata.bankName && (
                          <span className="font-mono text-xs">
                            BANK: {transaction.metadata.bankName}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              {transaction.type === TransactionType.DEPOSIT &&
                transaction.metadata &&
                transaction.metadata.depositType !== "local_transfer" &&
                transaction.metadata.depositType !== "international_transfer" &&
                transaction.metadata.depositType !== "wire_transfer" && (
                  <>
                    {/* <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                    <span className="text-green-700">FROM ACCT:</span>
                    <div className="flex flex-col text-right gap-1">
                    <span className="font-mono text-xs">{transaction.fromAccount.firstName  } {transaction.fromAccount.lastName}</span>
                    <span className="font-mono text-xs">****{transaction.fromAccount.account.number.slice(-4)}</span>
                    </div>
                  </div> */}

                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">Via:</span>
                      <div className="flex flex-col text-right gap-1">
                        {transaction.metadata && (
                          <span className="font-mono text-xs">
                            {transaction.metadata.depositType === "external"
                              ? "Online Transfer"
                              : transaction.metadata.depositType === "wire"
                                ? "Wire Transfer"
                                : transaction.metadata.depositType === "usdt"
                                  ? "USDT"
                                  : transaction.metadata.depositType ===
                                      "mobile"
                                    ? "Mobile Check"
                                    : transaction.metadata.depositType}
                          </span>
                        )}
                        {transaction.metadata.depositType === "check" && (
                          <span className="font-mono text-xs">
                            {transaction.metadata.checkNumber}
                          </span>
                        )}
                        {transaction.metadata.depositType === "usdt" && (
                          <span className="font-mono text-xs">
                            <span className="uppercase">
                              {transaction.metadata.cryptoNetwork}
                            </span>
                            : {transaction.metadata.cryptoWallet}
                          </span>
                        )}
                        {transaction.metadata.depositType === "mobile" && (
                          <span className="font-mono text-xs">
                            CHECK: {transaction.metadata.checkNumber}
                          </span>
                        )}
                        {transaction.metadata.depositType === "external" && (
                          <span>Online Transfer</span>
                        )}
                        {transaction.metadata.depositType === "wire" && (
                          <span>Wire Transfer</span>
                        )}
                        {transaction.metadata.depositType === "bitcoin" && (
                          <span className="font-mono text-xs">
                            <span className="uppercase">WALLET</span>:{" "}
                            {transaction.metadata.cryptoWallet}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}

             {transaction.type === TransactionType.DEPOSIT &&
                    transaction.metadata !== undefined &&
                      transaction.metadata.depositType !== undefined &&
                    ["local_transfer", "international_transfer", "wire_transfer"]
                    .includes(transaction?.metadata?.depositType) && (
  

                  <>
                    <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                    <span className="text-green-700">FROM ACCT:</span>
                    <div className="flex flex-col text-right gap-1">
                    <span className="font-mono text-xs">{transaction.metadata.senderName} </span>
                    <span className="font-mono text-xs">****{transaction?.metadata?.senderAccount?.slice(-4)}</span>
                    <span className="font-mono text-xs">{transaction.metadata.senderBank}</span>
                    </div>
                  </div>

                      <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                      <span className="text-green-700">TO:</span>
                      <div className="flex flex-col text-right gap-1">
                        <span className="font-mono text-xs">
                           {transaction.fromAccount.firstName}{" "}
                          {transaction.fromAccount.lastName}
                        </span>
                        <span className="font-mono text-xs">
                          {transaction.fromAccount.account.number}
                        </span>
                        <span className="font-mono text-xs">
                          {settings.site.name}
                        </span>
                      </div>
                    </div>
                  </>
                )}

              <div className="flex items-center justify-between py-1 border-b border-dotted border-gray-200">
                <span className="text-green-700">STATUS:</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(transaction.status)}
                  <span className="uppercase">{transaction.status}</span>
                </div>
              </div>

              <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                <span className="text-green-700">DESCRIPTION:</span>
                <span className="text-right max-w-[60%]">
                  {transaction.description}
                </span>
              </div>

              {/* <div className="flex justify-between py-1 border-b border-dotted border-gray-200">
                <span className="text-green-700">{transactionDirection.direction === "credit" ? "FROM:" : "TO:"}</span>
                <span className="text-right max-w-[60%] break-words">{otherPartyName}</span>
              </div> */}
            </div>

            {/* Amount Section */}
            <div className="my-6 py-4 border-t border-b border-dashed border-gray-400">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">AMOUNT</p>
                <p className="text-3xl font-bold text-green-700">
                  {transactionDirection.direction === "credit" ? "+" : "-"}
                  {formatAmount(transaction.amount, transaction.currency)}
                </p>
              </div>
            </div>

            {/* Footer Info */}
            <div className="text-center text-xs text-gray-500 space-y-1">
              <p>Thank you for banking with us</p>
              <p>Keep this receipt for your records</p>
              <p className="underline">{settings.site.short_url}</p>
            </div>
          </div>

          {/* Receipt Bottom Perforated Edge */}
          <div className="h-4 bg-white relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(90deg, transparent 0px, transparent 8px, #e5e7eb 8px, #e5e7eb 12px)",
                clipPath:
                  "polygon(0 0, 4% 100%, 8% 0, 12% 100%, 16% 0, 20% 100%, 24% 0, 28% 100%, 32% 0, 36% 100%, 40% 0, 44% 100%, 48% 0, 52% 100%, 56% 0, 60% 100%, 64% 0, 68% 100%, 72% 0, 76% 100%, 80% 0, 84% 100%, 88% 0, 92% 100%, 96% 0, 100% 100%, 100% 0, 0% 0)",
              }}
            ></div>
          </div>
        </div>

        {/* Download Button */}
        <div className="text-center mt-6 pb-4">
          <button
            onClick={handleDownloadPDF}
            className="bg-green-600 text-white px-6 py-2 text-sm font-medium flex items-center gap-2 mx-auto transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Receipt
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-4 text-center">
          <p className="text-gray-500 text-sm">
            Digital Receipt
          </p>
        </div>
      </div>
    </div>
  );
};

export default TransactionReceipt;
