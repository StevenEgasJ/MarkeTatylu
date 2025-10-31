const nodemailer = require('nodemailer');

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  // Prefer explicit SMTP config via env
  const host = process.env.SMTP_HOST;
  if (host) {
    // Build transport options; allow turning on verbose debug and customizing timeouts via env
    const transportOpts = {
      host: host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined,
      // timeouts (ms)
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 20000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 20000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000)
    };

    // Optional debug/logging for transporter when SMTP_DEBUG=true
    if (String(process.env.SMTP_DEBUG || '').toLowerCase() === 'true') {
      transportOpts.logger = true;
      transportOpts.debug = true;
      console.warn('SMTP debug enabled - transporter will log verbose output');
    }

    console.log(`Configuring SMTP transporter -> host=${host} port=${transportOpts.port} secure=${transportOpts.secure}`);
    transporter = nodemailer.createTransport(transportOpts);
    return transporter;
  }

  // Fallback: use Ethereal test account so emails can be inspected during development
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  console.warn('No SMTP settings found - using Ethereal test account. Preview URLs will be logged.');
  return transporter;
}

async function sendMail({ to, subject, text, html, from }) {
  try {
    // Basic recipient validation to reduce risk of header/interpretation issues.
    // Normalize recipients into an array of single emails.
    const normalizeRecipients = (t) => {
      if (!t) return [];
      if (Array.isArray(t)) return t.map(s => String(s).trim()).filter(Boolean);
      // split on commas or semicolons/newlines
      return String(t).split(/[\,;\n\r]+/).map(s => String(s).trim()).filter(Boolean);
    };

    const isValidEmail = (e) => {
      // simple RFC-like check (not perfect) and block CRLF characters
      if (!e || /[\r\n]/.test(e)) return false;
      // basic email pattern
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    };

    const recipients = normalizeRecipients(to);
    if (recipients.length === 0) {
      throw new Error('No recipient specified');
    }
    for (const r of recipients) {
      if (!isValidEmail(r)) throw new Error('Invalid recipient email: ' + r);
    }

    const tr = await getTransporter();
    const msg = {
      from: from || process.env.EMAIL_FROM || `no-reply@${process.env.APP_HOST || 'localhost'}`,
      to: recipients.join(', '),
      subject,
      text,
      html
    };
    const info = await tr.sendMail(msg);
    // If using Ethereal, log preview URL
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Email preview URL:', preview);
    return { ok: true, info, preview };
  } catch (err) {
    console.error('sendMail error:', err);
    return { ok: false, error: err };
  }
}

// Verify the configured transporter (useful at startup to validate SMTP creds)
async function verifyTransporter() {
  try {
    const tr = await getTransporter();
    // nodemailer transporters expose a verify() method
    if (typeof tr.verify === 'function') {
      await tr.verify();
      console.log('✅ Email transporter verified successfully');
      return { ok: true };
    }
    // If no verify method, return info about the transport
    console.log('⚠️ Email transporter does not expose verify(); assuming configured');
    return { ok: true, info: 'no-verify' };
  } catch (err) {
    console.error('Email transporter verification failed:', err && err.message ? err.message : err);
    return { ok: false, error: err };
  }
}

module.exports = { sendMail, verifyTransporter };
