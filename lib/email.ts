import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@nametag.one";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured. Email not sent:", { to, subject });
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
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
    subject: "Verify your Name Tag account",
    html: `
      <h1>Welcome to Name Tag!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify Email</a></p>
      <p>If you didn't create an account, you can ignore this email.</p>
    `,
    text: `Welcome to Name Tag! Please verify your email by visiting: ${verificationUrl}`,
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
};
