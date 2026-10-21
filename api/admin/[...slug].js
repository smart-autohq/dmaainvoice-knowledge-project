import overviewHandler from '../_handlers/admin/overview.js';
import sessionsHandler from '../_handlers/admin/sessions.js';
import sessionDetailHandler from '../_handlers/admin/session-detail.js';
import facilitatorsHandler from '../_handlers/admin/facilitators.js';
import participantsHandler from '../_handlers/admin/participants.js';
import registrationDetailHandler from '../_handlers/admin/registration-detail.js';
import campaignsHandler from '../_handlers/admin/campaigns.js';
import campaignSendHandler from '../_handlers/admin/campaign-send.js';
import contentHandler from '../_handlers/admin/content.js';

export default async function handler(req, res) {
  const rawSlug = req.query.slug;
  const segments = Array.isArray(rawSlug)
    ? rawSlug
    : (typeof rawSlug === 'string' ? rawSlug.split('/').filter(Boolean) : []);

  const resource = segments[0] || '';

  // 1. Overview: /api/admin/overview
  if (resource === 'overview' && segments.length === 1) {
    return overviewHandler(req, res);
  }

  // 2. Sessions:
  //    /api/admin/sessions -> list / create
  //    /api/admin/sessions/:id -> detail / update / delete
  if (resource === 'sessions') {
    if (segments.length === 1) {
      return sessionsHandler(req, res);
    }
    if (segments.length === 2) {
      req.query.id = segments[1];
      return sessionDetailHandler(req, res);
    }
  }

  // 3. Facilitators: /api/admin/facilitators (supports ?id=xyz for DELETE)
  if (resource === 'facilitators' && segments.length === 1) {
    return facilitatorsHandler(req, res);
  }

  // 4. Participants: /api/admin/participants (supports ?search=, ?sessionId=, ?format=csv)
  if (resource === 'participants' && segments.length === 1) {
    return participantsHandler(req, res);
  }

  // 5. Registrations: /api/admin/registrations/:id (PUT attendance, DELETE registration)
  if (resource === 'registrations' && segments.length === 2) {
    req.query.id = segments[1];
    return registrationDetailHandler(req, res);
  }

  // 6. Campaigns:
  //    /api/admin/campaigns -> list / create draft
  //    /api/admin/campaigns/:id/send -> dispatch campaign
  if (resource === 'campaigns') {
    if (segments.length === 1) {
      return campaignsHandler(req, res);
    }
    if (segments.length === 3 && segments[2] === 'send') {
      req.query.id = segments[1];
      return campaignSendHandler(req, res);
    }
  }

  // 7. Content: /api/admin/content (GET, PUT)
  if (resource === 'content' && segments.length === 1) {
    return contentHandler(req, res);
  }

  return res.status(404).json({
    error: `Admin route not found: /api/admin/${segments.join('/')}`,
  });
}
