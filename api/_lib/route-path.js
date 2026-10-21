export function getCatchAllSegments(req, parameterName, prefix) {
  const rawValue = req.query?.[parameterName];
  const querySegments = normalizeSegments(rawValue);
  if (querySegments.length > 0) return querySegments;

  const requestUrl = req.url || req.originalUrl || '';
  const pathname = requestUrl.split('?', 1)[0].split('#', 1)[0];
  const prefixIndex = pathname.indexOf(prefix);
  if (prefixIndex === -1) return [];

  return normalizeSegments(pathname.slice(prefixIndex + prefix.length));
}

function normalizeSegments(value) {
  const values = Array.isArray(value) ? value : [value];

  return values
    .filter((segment) => typeof segment === 'string')
    .flatMap((segment) => segment.split('/'))
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .map((segment) => segment.trim())
    .filter(Boolean);
}