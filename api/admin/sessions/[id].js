import sessionDetailHandler from '../../_handlers/admin/session-detail.js';

export default async function handler(req, res) {
  req.query = req.query || {};
  return sessionDetailHandler(req, res);
}