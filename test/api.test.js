'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

const A = 'user-a-token';
const B = 'user-b-token';
const STAFF = 'staff-token';
const ADMIN = 'admin-token';

let ctx;

beforeEach(async () => {
  // A fresh app (and fresh mock data) for every test keeps tests independent.
  const { server, store } = createApp({ log: false, aiTriageEnabled: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  ctx = {
    store,
    server,
    async call(method, path, { token, body, rawBody, headers = {} } = {}) {
      const h = { ...headers };
      if (token) h.Authorization = `Bearer ${token}`;
      let payload;
      if (rawBody !== undefined) payload = rawBody;
      else if (body !== undefined) payload = JSON.stringify(body);
      if (payload !== undefined) h['Content-Type'] = 'application/json';
      const res = await fetch(base + path, { method, headers: h, body: payload, redirect: 'manual' });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* not JSON (HTML page, empty body) */
      }
      return { status: res.status, headers: res.headers, text, json };
    },
  };
});

afterEach(async () => {
  ctx.server.closeAllConnections();
  await new Promise((resolve) => ctx.server.close(resolve));
});

const api = (path) => `/api/v1${path}`;
const validReport = { inventoryItemId: 'inv_002', issueType: 'BROKEN', comment: 'Light is out' };

function assertErrorEnvelope(res, status, code) {
  assert.equal(res.status, status);
  assert.equal(res.json.success, false);
  assert.equal(res.json.error.code, code);
  assert.equal(typeof res.json.error.message, 'string');
  assert.ok(res.json.error.message.length > 0);
}

describe('authentication (401)', () => {
  it('rejects a request without a token', async () => {
    const res = await ctx.call('GET', api('/reports'));
    assertErrorEnvelope(res, 401, 'UNAUTHORIZED');
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
  });

  it('rejects an invalid token', async () => {
    const res = await ctx.call('GET', api('/reports'), { token: 'not-a-real-token' });
    assertErrorEnvelope(res, 401, 'UNAUTHORIZED');
    assert.match(res.json.error.message, /invalid or has expired/);
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await ctx.call('GET', api('/reports'), { headers: { Authorization: 'Token user-a-token' } });
    assertErrorEnvelope(res, 401, 'UNAUTHORIZED');
  });

  it('does not accept a user that has no token (staff-2)', async () => {
    const res = await ctx.call('GET', api('/reports'), { token: 'null' });
    assertErrorEnvelope(res, 401, 'UNAUTHORIZED');
  });

  it('checks authentication before validating the body', async () => {
    const res = await ctx.call('POST', api('/reports'), { rawBody: '{broken json' });
    assertErrorEnvelope(res, 401, 'UNAUTHORIZED');
  });

  it('GET /me returns the caller identity', async () => {
    const res = await ctx.call('GET', api('/me'), { token: A });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.data, { id: 'user-a', name: 'Student A', role: 'student' });
  });
});

describe('routing errors and safety', () => {
  it('returns 405 with an Allow header for an unsupported method', async () => {
    const res = await ctx.call('DELETE', api('/reports'), { token: ADMIN });
    assertErrorEnvelope(res, 405, 'METHOD_NOT_ALLOWED');
    assert.match(res.headers.get('allow'), /GET/);
    assert.match(res.headers.get('allow'), /POST/);
  });

  it('returns 405 for POST on a single resource', async () => {
    const res = await ctx.call('POST', api('/reports/rep_101'), { token: A, body: validReport });
    assertErrorEnvelope(res, 405, 'METHOD_NOT_ALLOWED');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await ctx.call('GET', api('/unicorns'), { token: A });
    assertErrorEnvelope(res, 404, 'NOT_FOUND');
  });

  it('answers CORS preflight requests', async () => {
    const res = await ctx.call('OPTIONS', api('/reports'));
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });

  it('redirects / to the greeting page', async () => {
    const res = await ctx.call('GET', '/');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/api/v1/greeting');
  });

  it('never leaks internals on unexpected errors (500)', async () => {
    ctx.store.reports = null; // simulate a crash inside a handler
    const originalError = console.error;
    console.error = () => {};
    try {
      const res = await ctx.call('GET', api('/reports'), { token: ADMIN });
      assertErrorEnvelope(res, 500, 'INTERNAL_ERROR');
      assert.ok(!/TypeError|null|at |\.js|node_modules/.test(res.text));
    } finally {
      console.error = originalError;
    }
  });

  it('does not echo a bad token back in the response', async () => {
    const res = await ctx.call('GET', api('/reports'), { token: 'super-secret-wrong-token' });
    assert.ok(!res.text.includes('super-secret-wrong-token'));
  });
});
