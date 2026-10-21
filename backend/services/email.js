const nodemailer = require("nodemailer");

// Mesmo padrão do storage.js: usa um serviço de email a sério quando há
// credenciais SMTP no .env (SMTP_HOST/SMTP_USER/SMTP_PASS), senão cai num
// fallback de desenvolvimento que só escreve o link no log do servidor —
// dá para testar o fluxo todo (registo → confirmação) sem precisar de uma
// conta de email configurada.
function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

// Devolve o link sempre (dev e produção) — em dev o controller também o
// mete na resposta da API, para testar sem ir ao log.
async function sendVerificationEmail({ to, name, token }) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const link = `${frontendUrl}/verify-email?token=${token}`;

  if (!hasSmtpConfig()) {
    console.log(`[email:dev] Confirmação de email para ${to} (${name}): ${link}`);
    return { sent: false, link };
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Confirma o teu email — Ironbound",
    text: `Olá ${name},\n\nConfirma o teu email para ativar a tua conta Ironbound: ${link}\n\nSe não foste tu a criar esta conta, ignora este email.`,
    html: `<p>Olá ${name},</p><p>Confirma o teu email para ativar a tua conta Ironbound:</p><p><a href="${link}">${link}</a></p><p>Se não foste tu a criar esta conta, ignora este email.</p>`,
  });
  return { sent: true, link };
}

module.exports = { sendVerificationEmail };
