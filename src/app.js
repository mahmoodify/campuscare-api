'use strict';

const http = require('node:http');
const { ApiError, E } = require('./errors');
const { sendJson, sendHtml, sendEmpty, errorBody, readBody, parseJsonBody } = require('./http');
const { authenticate, requireRole } = require('./auth');
const { createStore } = require('./store');
const { buildRoutes } = require('./routes');
const { API_PREFIX, MAX_BODY_BYTES } = require('./constants');

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Find the route for a method + path. Also reports which methods the path supports (for 405). */
function matchRoute(routes, method, pathname) {
  const allowed = new Set();
  let route = null;
  let params = {};
  for (const candidate of routes) {
    const m = candidate.regex.exec(pathname);
    if (!m) continue;
    allowed.add(candidate.method);
    if (candidate.method === method && !route) {
      route = candidate;
      params = Object.fromEntries(candidate.keys.map((key, i) => [key, safeDecode(m[i + 1])]));
    }
  }
  return { route, params, allowed: [...allowed] };
}

/**
 * Creates the HTTP server. Request pipeline (the order decides which error wins):
 *   route lookup (404 / 405) -> authenticate (401) -> role check (403)
 *   -> parse body (400) -> handler (404 ownership, 400 validation, 409 conflict)
 */
function createApp(options = {}) {
  const store = options.store || createStore();
  const settings = {
    aiTriageEnabled:
      options.aiTriageEnabled !== undefined ? options.aiTriageEnabled : process.env.AI_TRIAGE_ENABLED !== 'false',
    log: options.log !== undefined ? options.log : true,
  };
  const routes = buildRoutes();
  const routeInfo = routes.map(({ method, path, access, summary }) => ({ method, path, access, summary }));
  const startedAt = Date.now();

  async function handle(req, res) {
    const started = Date.now();
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    let bodyRead = false;
    let status = 500;

    try {
      if (method === 'OPTIONS') {
        status = 204;
        return sendEmpty(res, 204);
      }
      if (method === 'GET' && pathname === '/') {
        status = 302;
        return sendEmpty(res, 302, { Location: `${API_PREFIX}/greeting` });
      }

      const { route, params, allowed } = matchRoute(routes, method, pathname);
      if (!route) {
        throw allowed.length
          ? E.methodNotAllowed(allowed)
          : E.notFound(`No endpoint exists at ${method} ${pathname.length > 80 ? pathname.slice(0, 80) + '???' : pathname}.`);
      }

      let user = null;
      if (route.access !== 'public') {
        user = authenticate(req, store);
        requireRole(user, route.access);
      }

      let body = {};
      if (method === 'POST' || method === 'PUT') {
        bodyRead = true;
        body = parseJsonBody(await readBody(req, MAX_BODY_BYTES));
      }

      const result = await route.handler({
        user,
        params,
        query: url.searchParams,
        body,
        store,
        options: settings,
        routeInfo,
        startedAt,
      });

      status = result.status;
      if (result.html !== undefined) return sendHtml(res, result.status, result.html);
      return sendJson(res, result.status, result.body, result.headers);
    } catch (err) {
      if (err instanceof ApiError) {
        status = err.status;
        return sendJson(res, err.status, errorBody(err.code, err.message, err.details), err.headers);
      }
      // Unexpected failure: log the details on the server, never send them to the client.
      console.error(`[error] ${method} ${pathname}:`, err);
      status = 500;
      return sendJson(
        res,
        500,
        errorBody('INTERNAL_ERROR', 'An unexpected error occurred. Please try again later.')
      );
    } finally {
      if (!bodyRead) req.resume();
      if (settings.log) console.log(`${method} ${pathname} -> ${status} (${Date.now() - started} ms)`);
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('[fatal]', err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  return { server, store };
}

module.exports = { createApp };
