import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "nametag.one";

// Different from addresses for different email types
export const fromAddresses = {
  accounts: `NameTag Accounts <accounts@${EMAIL_DOMAIN}>`,
  reminders: `NameTag Reminders <reminders@${EMAIL_DOMAIN}>`,
  default: `NameTag <hello@${EMAIL_DOMAIN}>`,
};

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: keyof typeof fromAddresses;
};

export async function sendEmail({ to, subject, html, text, from = 'default' }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured. Email not sent:", { to, subject });
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddresses[from],
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: "Failed to send email" };
  }
}

// Email template helpers for common use cases
export const emailTemplates = {
  accountVerification: (verificationUrl: string) => ({
    subject: "Verify your NameTag account",
    html: `
      <h1>Welcome to NameTag!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email</a></p>
      <p>If you didn't create an account, you can ignore this email.</p>
    `,
    text: `Welcome to NameTag! Please verify your email by visiting: ${verificationUrl}`,
  }),

  importantDateReminder: (personName: string, eventType: string, date: string) => ({
    subject: `Reminder: ${personName}'s ${eventType} is coming up`,
    html: `
      <h1>Upcoming Event Reminder</h1>
      <p><strong>${personName}</strong>'s ${eventType} is on <strong>${date}</strong>.</p>
      <p>Don't forget to reach out!</p>
    `,
    text: `Reminder: ${personName}'s ${eventType} is on ${date}. Don't forget to reach out!`,
  }),

  contactReminder: (personName: string, lastContactDate: string | null, interval: string) => ({
    subject: `Time to catch up with ${personName}`,
    html: `
      <h1>Stay in Touch</h1>
      <p>It's been a while since you last contacted <strong>${personName}</strong>${lastContactDate ? ` (last contact: ${lastContactDate})` : ''}.</p>
      <p>You asked to be reminded to catch up after ${interval} of your last contact.</p>
      <p>Why not reach out today?</p>
    `,
    text: `Time to catch up with ${personName}!${lastContactDate ? ` Last contact: ${lastContactDate}.` : ''} You asked to be reminded to catch up after ${interval} of your last contact. Why not reach out today?`,
  }),

  passwordReset: (resetUrl: string) => ({
    subject: "Reset your NameTag password",
    html: `
      <h1>Password Reset Request</h1>
      <p>We received a request to reset your password. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
    `,
    text: `Password Reset Request\n\nWe received a request to reset your password. Visit this link to set a new password: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email.`,
  }),
};
