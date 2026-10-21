import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'route-regression-test-secret';

const [{ default: adminGateway }, { default: authGateway }, auth, vercelModule] = await Promise.all([
  import('./api/admin/[...slug].js'),
  import('./api/auth/[action].js'),
  import('./api/_lib/auth.js'),
  import('./vercel.json', { with: { type: 'json' } }),
]);
const vercel = vercelModule.default;

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function invoke(handler, { query = {}, url, method = 'GET' } = {}) {
  const response = createResponse();
  await handler({ query, url, method, headers: {} }, response);
  return response;
}

const adminRoutes = [
  ['overview', '/api/admin/overview'],
  ['sessions', '/api/admin/sessions'],
  ['sessions/id', '/api/admin/sessions/session-1'],
  ['facilitators', '/api/admin/facilitators'],
  ['participants', '/api/admin/participants'],
  ['registrations/id', '/api/admin/registrations/registration-1'],
  ['campaigns', '/api/admin/campaigns'],
  ['campaigns/id/send', '/api/admin/campaigns/campaign-1/send'],
  ['content', '/api/admin/content'],
];

for (const [name, url] of adminRoutes) {
  const segments = url.replace('/api/admin/', '').split('/');
  const response = await invoke(adminGateway, { query: { slug: segments }, url });
  assert.equal(response.statusCode, 401, `${name} array route should reach withAuth`);
  assert.notEqual(response.body?.error, 'Admin route not found', `${name} must not 404`);
}

const slashRoute = await invoke(adminGateway, {
  query: { slug: 'sessions/session-2' },
  url: '/api/admin/sessions/session-ignored',
});
assert.equal(slashRoute.statusCode, 401, 'slash-string catch-all should dispatch');

const urlFallbackRoute = await invoke(adminGateway, {
  query: {},
  url: '/api/admin/participants?format=csv',
});
assert.equal(urlFallbackRoute.statusCode, 401, 'URL fallback should dispatch');

for (const request of [
  { query: { action: 'me' }, url: '/api/auth/me' },
  { query: { action: ['me'] }, url: '/api/auth/me' },
  { query: {}, url: '/api/auth/me' },
]) {
  const response = await invoke(authGateway, request);
  assert.equal(response.statusCode, 401, 'auth gateway should dispatch /me and preserve auth');
}

const token = auth.signToken({ id: 'organizer-1' });
const cookie = auth.createAuthCookie(token);
assert.match(cookie, /^dm_organizer_token=.+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
assert.equal(auth.parseCookies(cookie).dm_organizer_token, token);

const clearedCookie = auth.clearAuthCookie();
assert.match(clearedCookie, /^dm_organizer_token=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0; Secure$/);
assert.equal(vercel.rewrites[0].source, '/api/join');
assert.equal(vercel.rewrites[0].destination, '/api/participants');

console.log(`Passed ${adminRoutes.length} admin route, auth cookie, and rewrite regression checks.`);