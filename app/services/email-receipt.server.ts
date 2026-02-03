// ~/services/email-receipt.service.ts
import { emailService } from '~/utils/mail.server';
import { TransactionType } from '~/types';
import settings from '~/assets/settings.json';

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
    [key: string]: string | undefined;
  };
};

interface SendReceiptOptions {
  transaction: DatabaseTransaction;
  userEmail: string;
  currentUserId: string;
}

class EmailReceiptService {
  private formatDate(dateString: string): string {
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
  }

  private formatAmount(amount: number, currency: string = "USD"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  }

  private getTransactionDirection(transaction: DatabaseTransaction, currentUserId: string) {
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
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case "completed":
        return "✅";
      case "pending":
        return "🕐";
      default:
        return "❌";
    }
  }

  private generateReceiptHTML(transaction: DatabaseTransaction, currentUserId: string): string {
    const transactionDirection = this.getTransactionDirection(transaction, currentUserId);
    const statusIcon = this.getStatusIcon(transaction.status);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transaction Receipt</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Courier New', monospace;
            background-color: #f3f4f6;
            line-height: 1.4;
        }
        .receipt-container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }
        .watermark {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            opacity: 0.05;
            pointer-events: none;
            background-image: 
                repeating-linear-gradient(45deg, transparent, transparent 20px, #64748b 20px, #64748b 21px),
                repeating-linear-gradient(-45deg, transparent, transparent 20px, #64748b 20px, #64748b 21px);
            background-size: 40px 40px;
        }
        .watermark::after {
            content: "${settings.site.name.toUpperCase()}";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48px;
            font-weight: bold;
            color: #d1d5db;
            opacity: 0.2;
            white-space: nowrap;
        }
        .header {
            text-align: center;
            padding: 24px 16px;
            border-bottom: 2px dashed #d1d5db;
            position: relative;
            z-index: 10;
        }
      
         .header img {
       max-height: 60px;
       height: auto;
    }
        .content {
            padding: 16px;
            position: relative;
            z-index: 10;
        }
        .receipt-title {
            text-align: center;
            margin-bottom: 16px;
        }
        .receipt-title h2 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
        }
        .receipt-title p {
            margin: 4px 0 0 0;
            font-size: 14px;
            color: #6b7280;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 8px 0;
            border-bottom: 1px dotted #d1d5db;
            font-size: 14px;
        }
        .detail-label {
            color: #059669;
            font-weight: bold;
            flex-shrink: 0;
        }
        .detail-value {
            text-align: right;
            max-width: 60%;
            word-break: break-word;
        }
        .detail-value-multi {
            display: flex;
            flex-direction: column;
            gap: 4px;
            text-align: right;
        }
        .detail-value-multi span {
            font-size: 12px;
        }
        .amount-section {
            margin: 24px 0;
            padding: 16px 0;
            border-top: 2px dashed #9ca3af;
            border-bottom: 2px dashed #9ca3af;
            text-align: center;
        }
        .amount-section p:first-child {
            margin: 0 0 4px 0;
            font-size: 14px;
            color: #6b7280;
        }
        .amount {
            margin: 0;
            font-size: 32px;
            font-weight: bold;
            color: #059669;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.5;
        }
        .footer p {
            margin: 4px 0;
        }
        .footer .website {
            text-decoration: underline;
        }
        .perforated-edge {
            height: 16px;
            background: white;
            position: relative;
            overflow: hidden;
        }
        .perforated-edge::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: repeating-linear-gradient(90deg, transparent 0px, transparent 8px, #e5e7eb 8px, #e5e7eb 12px);
            clip-path: polygon(0 0, 4% 100%, 8% 0, 12% 100%, 16% 0, 20% 100%, 24% 0, 28% 100%, 32% 0, 36% 100%, 40% 0, 44% 100%, 48% 0, 52% 100%, 56% 0, 60% 100%, 64% 0, 68% 100%, 72% 0, 76% 100%, 80% 0, 84% 100%, 88% 0, 92% 100%, 96% 0, 100% 100%, 100% 0, 0% 0);
        }
        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="watermark"></div>
        
        <div class="header">
           <img src="${settings.site.logo_domian_text}" alt="${settings.site.short_name}" />
        </div>

        <div class="content">
            <div class="receipt-title">
                <h2>TRANSACTION RECEIPT</h2>
                <p>${this.formatDate(transaction.createdAt)}</p>
            </div>

            <div class="detail-row">
                <span class="detail-label">TRANS ID:</span>
                <span class="detail-value">${transaction._id}</span>
            </div>

            <div class="detail-row">
                <span class="detail-label">REF NO:</span>
                <span class="detail-value">${transaction.reference}</span>
            </div>

            <div class="detail-row">
                <span class="detail-label">TYPE:</span>
                <span class="detail-value">${transactionDirection.label}</span>
            </div>

            ${this.generateTransactionSpecificRows(transaction)}

            <div class="detail-row">
                <span class="detail-label">STATUS:</span>
                <span class="detail-value">
                    <span class="status-indicator">
                        ${statusIcon} ${transaction.status.toUpperCase()}
                    </span>
                </span>
            </div>

            <div class="detail-row">
                <span class="detail-label">DESCRIPTION:</span>
                <span class="detail-value">${transaction.description}</span>
            </div>

            <div class="amount-section">
                <p>AMOUNT</p>
                <p class="amount">
                    ${transactionDirection.direction === "credit" ? "+" : "-"}${this.formatAmount(transaction.amount, transaction.currency)}
                </p>
            </div>

            <div class="footer">
                <p>Thank you for banking with us</p>
                <p>Keep this receipt for your records</p>
                <p class="website">${settings.site.short_url}</p>
            </div>
        </div>

        <div class="perforated-edge"></div>
    </div>
</body>
</html>`;
  }

  private generateTransactionSpecificRows(transaction: DatabaseTransaction): string {
    const { type, metadata, fromAccount, toAccount } = transaction;
    let rows = '';

    if (type === TransactionType.PAYPAL && metadata) {
      rows += `
        <div class="detail-row">
            <span class="detail-label">FROM ACCT:</span>
            <div class="detail-value-multi">
                <span>${fromAccount.firstName} ${fromAccount.lastName}</span>
                <span>****${fromAccount.account.number.slice(-4)}</span>
                <span>${settings.site.name}</span>
            </div>
        </div>
        <div class="detail-row">
            <span class="detail-label">TO:</span>
            <div class="detail-value-multi">
                ${metadata.email ? `<span>EMAIL: ${metadata.email}</span>` : ''}
                ${metadata.name ? `<span>NAME: ${metadata.name}</span>` : ''}
                ${metadata.description ? `<span>NOTE: ${metadata.description}</span>` : ''}
            </div>
        </div>`;
    }

    if (type === TransactionType.WIRE_TRANSFER && metadata) {
      rows += `
        <div class="detail-row">
            <span class="detail-label">FROM ACCT:</span>
            <div class="detail-value-multi">
                <span>${fromAccount.firstName} ${fromAccount.lastName}</span>
                <span>****${fromAccount.account.number.slice(-4)}</span>
                <span>${settings.site.name}</span>
            </div>
        </div>
        <div class="detail-row">
            <span class="detail-label">TO:</span>
            <div class="detail-value-multi">
                ${metadata.beneficiaryName ? `<span>NAME: ${metadata.beneficiaryName}</span>` : ''}
                ${metadata.beneficiaryAccount ? `<span>ACCT: ${metadata.beneficiaryAccount}</span>` : ''}
                ${metadata.beneficiaryBankName ? `<span>BANK: ${metadata.beneficiaryBankName}</span>` : ''}
            </div>
        </div>`;
    }

    if (type === TransactionType.TRANSFER && toAccount) {
      rows += `
        <div class="detail-row">
            <span class="detail-label">FROM ACCT:</span>
            <div class="detail-value-multi">
                <span>${fromAccount.firstName} ${fromAccount.lastName}</span>
                <span>****${fromAccount.account.number.slice(-4)}</span>
                <span>${settings.site.name}</span>
            </div>
        </div>
        <div class="detail-row">
            <span class="detail-label">TO:</span>
            <div class="detail-value-multi">
                <span>NAME: ${toAccount.firstName} ${toAccount.lastName}</span>
                <span>ACCT: ${toAccount.account.number}</span>
                <span>${settings.site.name}</span>
            </div>
        </div>`;
    }

    if (type === TransactionType.TRANSFER && !toAccount && metadata) {
      rows += `
        <div class="detail-row">
            <span class="detail-label">FROM ACCT:</span>
            <div class="detail-value-multi">
                <span>${fromAccount.firstName} ${fromAccount.lastName}</span>
                <span>****${fromAccount.account.number.slice(-4)}</span>
            </div>
        </div>
        <div class="detail-row">
            <span class="detail-label">TO:</span>
            <div class="detail-value-multi">
                ${metadata.recipientName ? `<span>NAME: ${metadata.recipientName}</span>` : ''}
                ${metadata.accountNumber ? `<span>ACCT: ${metadata.accountNumber}</span>` : ''}
                ${metadata.bankName ? `<span>BANK: ${metadata.bankName}</span>` : ''}
            </div>
        </div>`;
    }

    // Handle different deposit types
    if (type === TransactionType.DEPOSIT && metadata) {
      const depositType = metadata.depositType;
      
      if (depositType && !['local_transfer', 'international_transfer', 'wire_transfer'].includes(depositType)) {
        let viaText = '';
        switch (depositType) {
          case 'external': viaText = 'Online Transfer'; break;
          case 'wire': viaText = 'Wire Transfer'; break;
          case 'usdt': viaText = 'USDT'; break;
          case 'mobile': viaText = 'Mobile Check'; break;
          default: viaText = depositType;
        }

        rows += `
          <div class="detail-row">
              <span class="detail-label">VIA:</span>
              <div class="detail-value-multi">
                  <span>${viaText}</span>
                  ${depositType === 'check' && metadata.checkNumber ? `<span>${metadata.checkNumber}</span>` : ''}
                  ${depositType === 'usdt' ? `<span>${metadata.cryptoNetwork?.toUpperCase()}: ${metadata.cryptoWallet}</span>` : ''}
                  ${depositType === 'mobile' && metadata.checkNumber ? `<span>CHECK: ${metadata.checkNumber}</span>` : ''}
                  ${depositType === 'bitcoin' ? `<span>WALLET: ${metadata.cryptoWallet}</span>` : ''}
              </div>
          </div>`;
      }

      if (depositType && ['local_transfer', 'international_transfer', 'wire_transfer'].includes(depositType)) {
        rows += `
          <div class="detail-row">
              <span class="detail-label">FROM ACCT:</span>
              <div class="detail-value-multi">
                  <span>${metadata.senderName}</span>
                  <span>****${metadata.senderAccount?.slice(-4)}</span>
                  <span>${metadata.senderBank}</span>
              </div>
          </div>
          <div class="detail-row">
              <span class="detail-label">TO:</span>
              <div class="detail-value-multi">
                  <span>${fromAccount.firstName} ${fromAccount.lastName}</span>
                  <span>${fromAccount.account.number}</span>
                  <span>${settings.site.name}</span>
              </div>
          </div>`;
      }
    }

    return rows;
  }

  async sendTransactionReceipt(options: SendReceiptOptions): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      const { transaction, userEmail, currentUserId } = options;
      
      const transactionDirection = this.getTransactionDirection(transaction, currentUserId);
      const receiptHTML = this.generateReceiptHTML(transaction, currentUserId);

      const subject = `Transaction Receipt - ${transactionDirection.label} - ${this.formatAmount(transaction.amount, transaction.currency)}`;
      
      const result = await emailService.sendHtmlEmail(
        userEmail,
        subject,
        receiptHTML,
        `Transaction Receipt for ${transaction.reference}\n\nTransaction Type: ${transactionDirection.label}\nAmount: ${this.formatAmount(transaction.amount, transaction.currency)}\nStatus: ${transaction.status.toUpperCase()}\nReference: ${transaction.reference}\n\nThank you for banking with ${settings.site.name}.`
      );

      if (result.success) {
        return {
          success: true,
          message: 'Transaction receipt sent successfully'
        };
      } else {
        return {
          success: false,
          message: 'Failed to send transaction receipt',
          error: result.error
        };
      }

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to send transaction receipt',
        error: error.message
      };
    }
  }
}

export const emailReceiptService = new EmailReceiptService();