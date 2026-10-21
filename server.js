import http from 'http';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// 1. Automatically load .env if present
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {
    // Ignore if already loaded or missing
  }
} else if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    // Ignore read error
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Sanitize errors to ensure no credentials, tokens, or database URLs leak in logs or responses
function sanitizeError(msg) {
  if (!msg) return '';
  return String(msg)
    .replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://***:***@')
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'Bearer ***')
    .replace(/jwt_secret=[^\s&]+/gi, 'JWT_SECRET=***');
}

// Route matching for API
async function handleApiRequest(req, res, pathname, query) {
  req.query = query || {};

  // Enhance response object with robust helper methods
  res.status = function (code) {
    res.statusCode = typeof code === 'number' ? code : 200;
    return res;
  };

  res.json = function (data) {
    if (res.writableEnded) return res;

    const payload = data !== undefined ? data : {};
    let serialized = '{}';
    try {
      serialized = JSON.stringify(payload);
    } catch (err) {
      console.error('[API JSON Serialization Error]:', err.message);
      serialized = JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to serialize API response payload.',
      });
      res.statusCode = 500;
    }

    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(serialized));
    }
    res.end(serialized);
    return res;
  };

  res.send = function (data) {
    if (res.writableEnded) return res;

    if (typeof data === 'object' && data !== null) {
      return res.json(data);
    }

    const str = String(data !== undefined ? data : '');
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(str));
    }
    res.end(str);
    return res;
  };

  // Parse body for incoming requests (POST, PUT, PATCH, DELETE)
  let bodyBuffer = '';
  try {
    for await (const chunk of req) {
      bodyBuffer += chunk;
    }
  } catch (streamErr) {
    console.error(`[API Stream Read Error in ${pathname}]:`, streamErr.message);
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Failed to read request payload stream.',
    });
  }

  req.body = {};
  if (bodyBuffer.trim()) {
    try {
      req.body = JSON.parse(bodyBuffer);
    } catch (parseErr) {
      console.warn(`[API Warning in ${pathname}]: Request body contains malformed JSON.`);
      return res.status(400).json({
        error: 'Invalid JSON',
        message: 'The request body must be valid JSON.',
      });
    }
  }

  // Resolve API handler file
  const relativeApi = pathname.replace(/^\/api\/?/, '');
  const segments = relativeApi.split('/').filter(Boolean);

  let handlerModule = null;

  // 1. Direct match: api/sessions/index.js or api/register.js
  const candidatePaths = [
    path.join(__dirname, 'api', ...segments, 'index.js'),
    path.join(__dirname, 'api', ...segments) + '.js',
  ];

  // Dynamic route matches: [id].js
  if (segments.length === 2 && segments[0] === 'sessions') {
    candidatePaths.push(path.join(__dirname, 'api', 'sessions', '[id].js'));
    req.query.id = segments[1];
  } else if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'sessions') {
    candidatePaths.push(path.join(__dirname, 'api', 'admin', 'sessions', '[id].js'));
    req.query.id = segments[2];
  } else if (segments.length === 3 && segments[0] === 'admin' && segments[1] === 'registrations') {
    candidatePaths.push(path.join(__dirname, 'api', 'admin', 'registrations', '[id].js'));
    req.query.id = segments[2];
  } else if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'campaigns' && segments[3] === 'send') {
    candidatePaths.push(path.join(__dirname, 'api', 'admin', 'campaigns', '[id]', 'send.js'));
    req.query.id = segments[2];
  }

  for (const candidate of candidatePaths) {
    try {
      await fsPromises.access(candidate);
      handlerModule = await import(`${pathToFileURL(candidate).href}?t=${Date.now()}`);
      break;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Error importing API handler ${candidate}:`, sanitizeError(err.message));
      }
    }
  }

  if (handlerModule && typeof handlerModule.default === 'function') {
    try {
      await handlerModule.default(req, res);

      // Safety check: if handler completed without ending the response, guarantee valid JSON
      if (!res.writableEnded) {
        console.warn(`[API Warning]: Handler for ${pathname} completed without ending response.`);
        res.status(200).json({ success: true });
      }
    } catch (handlerErr) {
      const sanitized = sanitizeError(handlerErr.message || 'Unknown handler error');
      console.error(`[API Error in ${pathname}]:`, sanitized);
      if (!res.writableEnded) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred while processing your request.',
        });
      }
    }
  } else {
    res.status(404).json({
      error: 'Not Found',
      message: `API endpoint "${pathname}" was not found on this server.`,
    });
  }
}

// Static file serving
async function handleStaticRequest(req, res, pathname) {
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  try {
    const stat = await fsPromises.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = await fsPromises.readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', Buffer.byteLength(content));
    res.end(content);
  } catch (err) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>Cannot find ${pathname}</p></body></html>`);
  }
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const parsedUrl = new URL(req.url, `http://${host}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    const query = {};
    for (const [k, v] of parsedUrl.searchParams) {
      query[k] = v;
    }

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, pathname, query);
    } else {
      await handleStaticRequest(req, res, pathname);
    }
  } catch (fatalErr) {
    console.error('[Server Unhandled Error]:', sanitizeError(fatalErr.message));
    if (!res.writableEnded) {
      if (req.url && req.url.startsWith('/api/')) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          error: 'Internal Server Error',
          message: 'A fatal server error occurred while processing the request.',
        }));
      } else {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!DOCTYPE html><html><head><title>500 Internal Error</title></head><body><h1>500 Internal Error</h1></body></html>');
      }
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`🚀 D Maain Voice Server running at http://localhost:${PORT}`);
  console.log(`   - Public Website:    http://localhost:${PORT}/`);
  console.log(`   - Organizer Portal:  http://localhost:${PORT}/admin.html`);
  console.log(`   - Sessions API:      http://localhost:${PORT}/api/sessions`);
  console.log(`   - Facilitators API:  http://localhost:${PORT}/api/facilitators`);
  console.log(`============================================================\n`);
});
