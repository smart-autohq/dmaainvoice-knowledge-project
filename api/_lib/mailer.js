import { prisma } from './prisma.js';

const EMAIL_FROM = process.env.EMAIL_FROM || 'D Maain Voice <noreply@dmaainvoice.org>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * Send an email via Resend API or simulate cleanly in local/dev
 */
export async function sendEmail({ to, subject, html, text }) {
  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Resend delivery failed:', errText);
        return { success: false, error: errText };
      }

      const data = await response.json();
      return { success: true, id: data.id };
    } catch (err) {
      console.error('Error invoking Resend API:', err);
      return { success: false, error: err.message };
    }
  } else {
    // Graceful fallback for development / before API key is provided
    console.log(`\n================== [OUTGOING EMAIL SIMULATION] ==================`);
    console.log(`From:    ${EMAIL_FROM}`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Preview: ${text ? text.slice(0, 160) : 'HTML message'}`);
    console.log(`=================================================================\n`);
    return { success: true, simulated: true };
  }
}

/**
 * Send Session Registration Confirmation Email
 */
export async function sendRegistrationConfirmation({ participant, session, registrationId }) {
  const sessionFormattedDate = new Date(session.sessionDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sessionFormattedTime = new Date(session.sessionDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: session.timeZone || 'Africa/Lagos',
  });

  const unsubscribeUrl = `${APP_URL}/api/unsubscribe?token=${encodeURIComponent(participant.unsubscribeToken)}`;

  const subject = `Confirmed: ${session.title} — D Maain Voice`;
  const text = `
Hello ${participant.firstName},

You are officially registered for:
"${session.title}"

Date: ${sessionFormattedDate}
Time: ${sessionFormattedTime}
Venue: ${session.venue || 'Virtual Seminar (Link will be dispatched prior to the session)'}

Facilitator: ${session.facilitator ? session.facilitator.name : 'Knowledge Facilitator'}

We look forward to having you join us. "BE THE VOICE".

To manage your email preferences or unsubscribe:
${unsubscribeUrl}
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F6F2; margin: 0; padding: 24px; color: #252525; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #E5E2DA; padding: 32px; }
    .badge { display: inline-block; background: #F2C94C; color: #252525; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #252525; margin: 0 0 16px 0; line-height: 1.3; }
    p { font-size: 15px; line-height: 1.6; color: #403E39; margin: 0 0 16px 0; }
    .meta-box { background: #FAF9F6; border-left: 3px solid #252525; padding: 16px; border-radius: 4px; margin: 20px 0; }
    .meta-row { margin-bottom: 8px; font-size: 14px; }
    .meta-row:last-child { margin-bottom: 0; }
    .footer { font-size: 12px; color: #8C8980; text-align: center; margin-top: 24px; }
    .footer a { color: #8C8980; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Registration Confirmed</span>
    <h1>${escapeHtml(session.title)}</h1>
    <p>Dear ${escapeHtml(participant.firstName)},</p>
    <p>Your seat has been reserved for this upcoming session with the <strong>D Maain Voice Knowledge Project</strong> in association with the SMART NACOS Public Speaking Track.</p>
    
    <div class="meta-box">
      <div class="meta-row"><strong>Date:</strong> ${sessionFormattedDate}</div>
      <div class="meta-row"><strong>Time:</strong> ${sessionFormattedTime}</div>
      <div class="meta-row"><strong>Format:</strong> ${escapeHtml(session.venue || 'Virtual Seminar')}</div>
      ${session.facilitator ? `<div class="meta-row"><strong>Facilitator:</strong> ${escapeHtml(session.facilitator.name)} (${escapeHtml(session.facilitator.title)})</div>` : ''}
    </div>

    <p>Interactive conference coordinates and access links will be dispatched directly to your inbox 48 hours prior to start time.</p>
    
    <p style="margin-top: 24px;">Warm regards,<br><strong>D Maain Voice Organizing Committee</strong><br><em>“BE THE VOICE”</em></p>
  </div>
  <div class="footer">
    D Maain Voice Knowledge Project &bull; <a href="${unsubscribeUrl}">Unsubscribe</a>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: participant.email, subject, text, html });
}

/**
 * Send Welcome Email for general Participant Community Registration
 */
export async function sendParticipantWelcomeEmail({ participant }) {
  const unsubscribeUrl = `${APP_URL}/api/unsubscribe?token=${encodeURIComponent(participant.unsubscribeToken)}`;
  const subject = `Welcome to the D Maain Voice Community!`;
  const text = `
Hello ${participant.firstName},

Welcome to the D Maain Voice Knowledge Project!

You are now officially registered as a participant in our learning community. You will receive direct updates on upcoming knowledge sessions, speaker announcements, and public speaking development cohorts.

To view our upcoming sessions calendar, visit:
${APP_URL}/#sessions

We look forward to exchanging knowledge and ideas together. "BE THE VOICE".

Warm regards,
D Maain Voice Organizing Committee

Manage preferences or unsubscribe:
${unsubscribeUrl}
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F6F2; margin: 0; padding: 24px; color: #252525; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #E5E2DA; padding: 32px; }
    .badge { display: inline-block; background: #F2C94C; color: #252525; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #252525; margin: 0 0 16px 0; line-height: 1.3; }
    p { font-size: 15px; line-height: 1.6; color: #403E39; margin: 0 0 16px 0; }
    .footer { font-size: 12px; color: #8C8980; text-align: center; margin-top: 24px; }
    .footer a { color: #8C8980; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Community Member</span>
    <h1>Welcome to D Maain Voice</h1>
    <p>Dear ${escapeHtml(participant.firstName)},</p>
    <p>Welcome! You are now registered as an official participant in the <strong>D Maain Voice Knowledge Project</strong>.</p>
    <p>As part of our community, you will receive priority notices for upcoming virtual seminars, thought-leadership sessions, and collaborative learning cohorts.</p>
    <p>Whenever you are ready to attend a scheduled session, simply visit our session calendar to reserve your interactive seat.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>D Maain Voice Organizing Committee</strong><br><em>“BE THE VOICE”</em></p>
  </div>
  <div class="footer">
    D Maain Voice Knowledge Project &bull; <a href="${unsubscribeUrl}">Unsubscribe</a>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: participant.email, subject, text, html });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
