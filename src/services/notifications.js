const nodemailer = require("nodemailer");
const config = require("../../config");

const {
  PASSWORD_RESET_URL,
  RESET_EMAIL_FROM,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  RESET_SMS_WEBHOOK_URL,
  ALERT_WEBHOOK_URL,
} = config;

const emailTransport =
  SMTP_HOST && RESET_EMAIL_FROM
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      })
    : null;

const buildResetMessage = (token, expiresAt) => {
  const resetLink = PASSWORD_RESET_URL ? `${PASSWORD_RESET_URL}?token=${token}` : null;
  const details = [
    "Você solicitou a redefinição de senha.",
    resetLink ? `Link: ${resetLink}` : `Token: ${token}`,
    `Expira em: ${expiresAt}`,
  ];
  return details.join("\n");
};

const sendPasswordResetNotification = async ({ user, token, expiresAt }) => {
  const payload = buildResetMessage(token, expiresAt);
  let sent = false;
  if (emailTransport && user.email) {
    await emailTransport.sendMail({
      from: RESET_EMAIL_FROM,
      to: user.email,
      subject: "Redefinição de senha",
      text: payload,
    });
    sent = true;
  }
  if (RESET_SMS_WEBHOOK_URL && user.phone) {
    const response = await fetch(RESET_SMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: user.phone,
        message: payload,
        token,
        expires_at: expiresAt,
        reset_url: PASSWORD_RESET_URL || null,
      }),
    });
    if (!response.ok) {
      throw new Error("Falha ao enviar SMS.");
    }
    sent = true;
  }
  if (!sent) {
    throw new Error("Nenhum canal de notificação configurado.");
  }
};

const sendAlertNotification = async ({ level, message, context }) => {
  if (!ALERT_WEBHOOK_URL) {
    return;
  }
  const response = await fetch(ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level,
      message,
      context,
      created_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error("Falha ao enviar alerta.");
  }
};

module.exports = {
  buildResetMessage,
  sendAlertNotification,
  sendPasswordResetNotification,
};
