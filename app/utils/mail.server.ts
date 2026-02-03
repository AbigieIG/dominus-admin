import nodemailer,  { type Transporter, type SendMailOptions } from 'nodemailer';

// Types
interface EmailAttachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  cid?: string;
}

interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: EmailAttachment[];
}

interface BulkEmailOptions {
  to: string | string[];
  subject: string;
  content: string;
  isHtml?: boolean;
  cc?: string[];
  bcc?: string[];
  from?: string;
}

interface TemplateEmailOptions {
  to: string;
  subject: string;
  template: string;
  variables?: Record<string, string>;
  isHtml?: boolean;
  from?: string;
}

/**
 * Email utility class for sending emails using Nodemailer with TypeScript
 */
export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize the email transporter
   */
  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransport({
        // service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      console.log('Email transporter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      throw error;
    }
  }

  /**
   * Verify transporter connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }
      
      await this.transporter.verify();
      console.log('Email server connection verified');
      return true;
    } catch (error) {
      console.error('Email server connection failed:', error);
      return false;
    }
  }

  /**
   * Send a simple text email
   */
  async sendTextEmail(
    to: string,
    subject: string,
    text: string,
    from?: string
  ): Promise<EmailResponse> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }

      

      const mailOptions: SendMailOptions = {
        from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Text email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send text email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send an HTML email
   */
  async sendHtmlEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<EmailResponse> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }

      const mailOptions: SendMailOptions = {
        from:  process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML as fallback
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('HTML email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send HTML email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send email with attachments
   */
  async sendEmailWithAttachments(
    to: string,
    subject: string,
    content: string,
    attachments: EmailAttachment[] = [],
    isHtml = false,
    from?: string
  ): Promise<EmailResponse> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }

      const mailOptions: SendMailOptions = {
        from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        attachments,
      };

      if (isHtml) {
        mailOptions.html = content;
        mailOptions.text = content.replace(/<[^>]*>/g, '');
      } else {
        mailOptions.text = content;
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email with attachments sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send email with attachments:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }


  async sendEmail(options: SendEmailOptions): Promise<EmailResponse> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }

      const { to, subject, text, html, attachments = [] } = options;
      
      const mailOptions: SendMailOptions = {
        from:  process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        text,
        html,
        attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send email to multiple recipients
   */
  async sendBulkEmail(options: BulkEmailOptions): Promise<EmailResponse> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }

      const { to, subject, content, isHtml = false, cc = [], bcc = [], from } = options;

      const mailOptions: SendMailOptions = {
        from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: Array.isArray(to) ? to.join(',') : to,
        cc: cc.length > 0 ? cc.join(',') : undefined,
        bcc: bcc.length > 0 ? bcc.join(',') : undefined,
        subject,
      };

      if (isHtml) {
        mailOptions.html = content;
        mailOptions.text = content.replace(/<[^>]*>/g, '');
      } else {
        mailOptions.text = content;
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Bulk email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send bulk email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send a template-based email
   */
  async sendTemplateEmail(options: TemplateEmailOptions): Promise<EmailResponse> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }

      const { to, subject, template, variables = {}, isHtml = false, from } = options;
      
      let content = template;
      
      // Replace variables in template
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, variables[key]);
      });

      const mailOptions: SendMailOptions = {
        from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
      };

      if (isHtml) {
        mailOptions.html = content;
        mailOptions.text = content.replace(/<[^>]*>/g, '');
      } else {
        mailOptions.text = content;
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Template email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send template email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Simple function-based approach (alternative to class)
export const createEmailService = () => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return {
    async sendEmail(options: SendEmailOptions): Promise<EmailResponse> {
      try {
        const { to, subject, text, html, from, attachments = [] } = options;
        
        const mailOptions: SendMailOptions = {
          from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to,
          subject,
          text,
          html,
          attachments,
        };

        const result = await transporter.sendMail(mailOptions);
        return { success: true, messageId: result.messageId };
      } catch (error) {
        console.error('Email sending failed:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    },

    async verifyConnection(): Promise<boolean> {
      try {
        await transporter.verify();
        return true;
      } catch (error) {
        console.error('Email connection failed:', error);
        return false;
      }
    }
  };
};

// Remix-specific utility for server-side email sending
export const sendEmailFromAction = async (
  options: SendEmailOptions
): Promise<EmailResponse> => {
  const emailService = new EmailService();
  return emailService.sendEmail(options);
};

// Export default instance for convenience
export const emailService = new EmailService();


