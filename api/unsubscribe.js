import { prisma } from './_lib/prisma.js';

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Invalid Request — D Maain Voice</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 48px; background: #F7F6F2; color: #252525;">
        <h2>Invalid Unsubscribe Link</h2>
        <p>No valid unsubscribe token was provided. Please check the link in your email.</p>
        <a href="/" style="color: #252525; font-weight: 600;">Return to Homepage</a>
      </body>
      </html>
    `);
  }

  try {
    const participant = await prisma.participant.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!participant) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Participant Not Found — D Maain Voice</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 48px; background: #F7F6F2; color: #252525;">
          <h2>Unsubscribe Request Not Found</h2>
          <p>We could not locate an active subscription associated with this token.</p>
          <a href="/" style="color: #252525; font-weight: 600;">Return to Homepage</a>
        </body>
        </html>
      `);
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: { subscribed: false },
    });

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed Successfully — D Maain Voice</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 48px 16px; background: #F7F6F2; color: #252525;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #E5E2DA; border-radius: 12px; padding: 32px;">
          <h2 style="margin-top: 0; color: #252525;">You have been unsubscribed</h2>
          <p style="color: #6B6963; line-height: 1.6;">
            <strong>${participant.email}</strong> will no longer receive general cohort announcements or promotional communications from the D Maain Voice Knowledge Project.
          </p>
          <p style="font-size: 13px; color: #8C8980;">
            Note: If you have active upcoming sessions, essential joining credentials will still be delivered.
          </p>
          <div style="margin-top: 24px;">
            <a href="/" style="display: inline-block; background: #252525; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
              Return to Website
            </a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error handling unsubscribe:', error);
    return res.status(500).send('An error occurred while processing your unsubscribe request.');
  }
}
