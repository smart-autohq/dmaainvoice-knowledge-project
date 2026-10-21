import { prisma } from '../../../_lib/prisma.js';
import { withAuth } from '../../../_lib/auth.js';
import { sendEmail } from '../../../_lib/mailer.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.query;

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        session: true,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Email campaign not found.' });
    }

    if (campaign.status === 'SENT' || campaign.status === 'SENDING') {
      return res.status(400).json({ error: `Campaign has already been marked as ${campaign.status}.` });
    }

    // Identify target audience
    let participants = [];
    if (campaign.sessionId) {
      // Registered attendees of the specific session who are subscribed
      const registrations = await prisma.registration.findMany({
        where: { sessionId: campaign.sessionId },
        include: { participant: true },
      });
      participants = registrations
        .map(r => r.participant)
        .filter(p => p.subscribed);
    } else {
      // General broadcast to all subscribed participants
      participants = await prisma.participant.findMany({
        where: { subscribed: true },
      });
    }

    if (participants.length === 0) {
      return res.status(400).json({ error: 'No subscribed recipients found matching this campaign audience.' });
    }

    // Set campaign status to SENDING
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'SENDING' },
    });

    // Create delivery records and send
    let sentCount = 0;
    let failedCount = 0;

    for (const participant of participants) {
      // Upsert delivery record
      let delivery = await prisma.emailDelivery.upsert({
        where: {
          campaignId_participantId: {
            campaignId: campaign.id,
            participantId: participant.id,
          },
        },
        update: { status: 'PENDING', errorMessage: null },
        create: {
          campaignId: campaign.id,
          participantId: participant.id,
          status: 'PENDING',
        },
      });

      const emailResult = await sendEmail({
        to: participant.email,
        subject: campaign.subject,
        text: campaign.body,
        html: `
          <div style="font-family: sans-serif; background-color: #F7F6F2; padding: 24px; color: #252525;">
            <div style="max-width: 580px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 8px; border: 1px solid #E5E2DA;">
              <h2 style="margin-top:0;">${campaign.subject}</h2>
              <div style="line-height: 1.6; white-space: pre-wrap;">${campaign.body}</div>
              <div style="margin-top: 32px; font-size: 12px; color: #8C8980; border-top: 1px solid #eee; padding-top: 16px;">
                D Maain Voice Knowledge Project &bull; <a href="${process.env.APP_URL || ''}/api/unsubscribe?token=${participant.unsubscribeToken}" style="color: #8C8980;">Unsubscribe</a>
              </div>
            </div>
          </div>
        `,
      });

      if (emailResult.success) {
        sentCount++;
        await prisma.emailDelivery.update({
          where: { id: delivery.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } else {
        failedCount++;
        await prisma.emailDelivery.update({
          where: { id: delivery.id },
          data: { status: 'FAILED', errorMessage: emailResult.error || 'Dispatch error' },
        });
      }
    }

    // Update final campaign state
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: failedCount > 0 && sentCount === 0 ? 'FAILED' : 'SENT',
        sentAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Campaign dispatched to ${sentCount} recipients (${failedCount} failed).`,
      sentCount,
      failedCount,
    });
  } catch (error) {
    console.error('Error dispatching campaign:', error);
    await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'FAILED' },
    }).catch(() => {});
    return res.status(500).json({ error: 'Failed to dispatch email campaign.' });
  }
}

export default withAuth(handler);
