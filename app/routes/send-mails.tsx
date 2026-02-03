import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, useActionData, useNavigation } from "react-router";
import { useState } from "react";
import { emailService } from "~/utils/mail.server"; // Adjust import path as needed
import settings from "~/assets/settings.json";
// Types
interface ActionData {
  success?: boolean;
  error?: string;
  messageId?: string;
}

export const meta: MetaFunction = () => {
  return [
    {title: `Send Mails | ${settings.site.title}`},
  ];
};

// Server-side action to handle form submission
export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();

    const to = formData.get("to") as string;
    const subject = formData.get("subject") as string;
    const content = formData.get("content") as string;

    const Html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Notification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f9fafb;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      padding: 25px 20px;
      text-align: center;
      border-bottom: 1px solid #e5e7eb;
    }
    .header img {
      max-height: 60px;
      height: auto;
    }
    .content {
      padding: 30px 20px;
    }
    .message-content {
      font-size: 16px;
      line-height: 1.7;
      color: #374151;
    }
    .message-content p {
      margin: 15px 0;
    }
    .footer {
      padding: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
      background: #f9fafb;
    }
    .footer a {
      color: #059669;
      text-decoration: none;
    }
    @media (max-width: 600px) {
      .content { padding: 20px 15px; }
      .header { padding: 20px 15px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <img src="${settings.site.logo_domian_text}" alt="${settings.site.short_name}" />
    </div>

    <!-- Main Content -->
    <div class="content">
      <div class="message-content">
        ${content
          .split("\n")
          .map((line: string) => `<p>${line}</p>`)
          .join("")}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Contact us at <a href="mailto:${settings.contact.email}">${settings.contact.email}</a></p>
      <p>&copy; ${new Date().getFullYear()} ${settings.site.name}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

    // Validation
    if (!to || !subject || !content) {
      return Response.json({
        success: false,
        error: "Please fill in all required fields",
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return Response.json({
        success: false,
        error: "Please enter a valid email address",
      });
    }

    // Send email
    const result = await emailService.sendEmail({
      to,
      subject,
      text: undefined,
      html: Html,
    });

    if (result.success) {
      return Response.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      return Response.json({
        success: false,
        error: result.error || "Failed to send email",
      });
    }
  } catch (error) {
    console.error("Email action error:", error);
    return Response.json({
      success: false,
      error: "An unexpected error occurred",
    });
  }
}

export default function SendEmail() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [isHtml, setIsHtml] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Send Email
          </h1>
          <p className="text-gray-600">Compose and send your message</p>
        </div>

        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-green-600 mt-0.5 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-green-800 font-medium">
                  Email sent successfully!
                </h3>
                {actionData.messageId && (
                  <p className="text-green-700 text-sm mt-1">
                    Message ID: {actionData.messageId}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {actionData?.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-red-800 font-medium">
                  Error sending email
                </h3>
                <p className="text-red-700 text-sm mt-1">{actionData.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Email Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <Form method="post" className="p-8 space-y-6">
            {/* To Field */}
            <div>
              <label
                htmlFor="to"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                To <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="to"
                name="to"
                required
                placeholder="recipient@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Subject Field */}
            <div>
              <label
                htmlFor="subject"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                required
                placeholder="Enter email subject"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Content Field */}
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="content"
                name="content"
                required
                rows={12}
                placeholder={
                  isHtml ? "Enter HTML content..." : "Type your message here..."
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900 placeholder-gray-500 resize-y"
              />
              {isHtml && (
                <p className="text-xs text-gray-500 mt-2">
                  HTML mode enabled. You can use HTML tags to format your email.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1.5 flex-wrap-reverse items-center justify-between pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  const form = document.querySelector(
                    "form"
                  ) as HTMLFormElement;
                  form?.reset();
                  setIsHtml(false);
                }}
                className="px-6 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 transition-colors font-medium"
              >
                Clear
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-8 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                  isSubmitting
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow focus:ring-2 focus:ring-blue-500"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
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
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    <span>Send Email</span>
                  </>
                )}
              </button>
            </div>
          </Form>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Make sure your email configuration is properly set up in your
            environment variables.
          </p>
        </div>
      </div>
    </div>
  );
}
