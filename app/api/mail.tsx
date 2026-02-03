import type { ActionFunction } from "react-router";
import { emailService } from "~/utils/mail.server";
import settings from "~/assets/settings.json";

export const action: ActionFunction = async ({ request }) => {
  const body = await request.json();

  const { to, subject, text } = body;

  if (!to || !subject || !text) {
    return Response.json(
      { error: "All fields are required", success: false },
      { status: 400 }
    );
  }

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
        ${text
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


  const email = await emailService.sendHtmlEmail(
    
      to,
      subject,
   Html,
    
  );
  if (!email.success) {
    return Response.json(
      { error: email.error, success: false },
      { status: 400 }
    );
  }
  return Response.json(email, { status: 200 });
};
