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

describe('reading reports and ownership', () => {
  it('user A lists only their own reports', async () => {
    const res = await ctx.call('GET', api('/reports'), { token: A });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(res.json.data.length >= 2);
    assert.ok(res.json.data.every((r) => r.ownerId === 'user-a'));
    assert.deepEqual(res.json.meta, { total: res.json.data.length, page: 1, perPage: 10 });
  });

  it('user B lists only their own reports', async () => {
    const res = await ctx.call('GET', api('/reports'), { token: B });
    assert.ok(res.json.data.length >= 2);
    assert.ok(res.json.data.every((r) => r.ownerId === 'user-b'));
  });

  it('admin lists every report', async () => {
    const res = await ctx.call('GET', api('/reports'), { token: ADMIN });
    assert.equal(res.json.meta.total, ctx.store.reports.length);
    const owners = new Set(res.json.data.map((r) => r.ownerId));
    assert.ok(owners.has('user-a') && owners.has('user-b'));
  });

  it('owner can read their own report', async () => {
    const res = await ctx.call('GET', api('/reports/rep_101'), { token: A });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.id, 'rep_101');
    assert.equal(res.json.data.inventoryItem.name, 'Ceiling light');
  });

  it("user A cannot read user B's report (404, same as a missing one)", async () => {
    const res = await ctx.call('GET', api('/reports/rep_103'), { token: A });
    assertErrorEnvelope(res, 404, 'NOT_FOUND');
    const missing = await ctx.call('GET', api('/reports/rep_103'.replace('103', '999')), { token: A });
    assert.equal(res.json.error.message.replace('rep_103', 'X'), missing.json.error.message.replace('rep_999', 'X'));
  });

  it("user B cannot read user A's report", async () => {
    const res = await ctx.call('GET', api('/reports/rep_101'), { token: B });
    assertErrorEnvelope(res, 404, 'NOT_FOUND');
  });

  it('admin can read any report', async () => {
    const a = await ctx.call('GET', api('/reports/rep_101'), { token: ADMIN });
    const b = await ctx.call('GET', api('/reports/rep_103'), { token: ADMIN });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
  });

  it('returns 404 for a non-existent ID', async () => {
    const res = await ctx.call('GET', api('/reports/rep_999'), { token: ADMIN });
    assertErrorEnvelope(res, 404, 'NOT_FOUND');
  });

  it('computes inspection and resolution times', async () => {
    const res = await ctx.call('GET', api('/reports/rep_104'), { token: ADMIN });
    assert.equal(res.json.data.minutesToInspect, 45);
    assert.equal(res.json.data.minutesToResolve, 210);
  });
});

describe('list query parameters', () => {
  it('filters by status', async () => {
    const res = await ctx.call('GET', api('/reports?status=PENDING'), { token: ADMIN });
    assert.ok(res.json.data.length > 0);
    assert.ok(res.json.data.every((r) => r.status === 'PENDING'));
  });

  it('paginates', async () => {
    const res = await ctx.call('GET', api('/reports?perPage=2&page=2'), { token: ADMIN });
    assert.equal(res.json.data.length, 2);
    assert.deepEqual(res.json.meta, { total: 5, page: 2, perPage: 2 });
  });

  it('sorts by priority, highest first', async () => {
    const res = await ctx.call('GET', api('/reports?sort=-priority'), { token: ADMIN });
    assert.equal(res.json.data[0].priority, 'HIGH');
    assert.equal(res.json.data.at(-1).priority, 'LOW');
  });

  it('rejects invalid and unknown query parameters with 400', async () => {
    const res = await ctx.call('GET', api('/reports?status=DONE&page=0&perPage=1000&colour=red'), { token: ADMIN });
    assertErrorEnvelope(res, 400, 'VALIDATION_ERROR');
    const fields = res.json.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['colour', 'page', 'perPage', 'status']);
  });
});

describe('creating reports (POST)', () => {
  it('creates a report: 201, Location header, owner, routing and triage', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: A, body: validReport });
    assert.equal(res.status, 201);
    assert.equal(res.json.success, true);
    assert.equal(res.headers.get('location'), `/api/v1/reports/${res.json.data.id}`);
    assert.equal(res.json.data.ownerId, 'user-a');
    assert.equal(res.json.data.status, 'PENDING');
    assert.equal(res.json.data.priority, 'HIGH'); // emergency exit sign is safety-critical
    assert.equal(res.json.data.assignedTo, 'staff-1'); // Building A -> staff-1
    const again = await ctx.call('GET', res.headers.get('location'), { token: A });
    assert.equal(again.status, 200);
  });

  it('comment is optional', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: A, body: { inventoryItemId: 'inv_006', issueType: 'BROKEN' } });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.comment, null);
    assert.equal(res.json.data.priority, 'MEDIUM');
  });

  it('routes Building C reports to staff-2', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: A, body: { inventoryItemId: 'inv_008', issueType: 'BROKEN' } });
    assert.equal(res.json.data.assignedTo, 'staff-2');
  });

  it('uses default MEDIUM priority when AI triage is unavailable (FR-11)', async () => {
    const { server } = createApp({ log: false, aiTriageEnabled: false });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${A}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(validReport),
      });
      const json = await res.json();
      assert.equal(res.status, 201);
      assert.equal(json.data.priority, 'MEDIUM');
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('rejects missing required fields (400 with details)', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: A, body: {} });
    assertErrorEnvelope(res, 400, 'VALIDATION_ERROR');
    const fields = res.json.error.details.map((d) => d.field);
    assert.deepEqual(fields, ['inventoryItemId', 'issueType']);
  });

  it('rejects wrong types, bad enum values and bad lengths', async () => {
    const res = await ctx.call('POST', api('/reports'), {
      token: A,
      body: { inventoryItemId: 123, issueType: 'EXPLODED', comment: 'x' },
    });
    assertErrorEnvelope(res, 400, 'VALIDATION_ERROR');
    assert.equal(res.json.error.details.length, 3);
  });

  it('rejects an over-long comment', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: A, body: { ...validReport, comment: 'x'.repeat(201) } });
    assertErrorEnvelope(res, 400, 'VALIDATION_ERROR');
    assert.equal(res.json.error.details[0].field, 'comment');
  });

  it('rejects an inventory item that does not exist', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: A, body: { inventoryItemId: 'inv_999', issueType: 'BROKEN' } });
    assertErrorEnvelope(res, 400, 'VALIDATION_ERROR');
    assert.match(res.json.error.details[0].message, /does not exist/);
  });

  it('rejects unknown and read-only fields (cannot set owner or status)', async () => {
    const res = await ctx.call('POST', api('/reports'), {
      token: A,
      body: { ...validReport, ownerId: 'user-b', status: 'RESOLVED' },
    });
    assertErrorEnvelope(res, 400, 'VALIDATION_ERROR');
    assert.deepEqual(res.json.error.details.map((d) => d.field).sort(), ['ownerId', 'status']);
  });

  it('rejects malformed JSON with 400 INVALID_JSON', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: A, rawBody: '{"inventoryItemId": ' });
    assertErrorEnvelope(res, 400, 'INVALID_JSON');
  });

  it('rejects a body that is not a JSON object', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: A, rawBody: '[1,2,3]' });
    assertErrorEnvelope(res, 400, 'VALIDATION_ERROR');
  });

  it('returns 409 for a duplicate open report', async () => {
    const first = await ctx.call('POST', api('/reports'), { token: A, body: validReport });
    assert.equal(first.status, 201);
    const second = await ctx.call('POST', api('/reports'), { token: A, body: validReport });
    assertErrorEnvelope(second, 409, 'CONFLICT');
  });

  it('staff cannot create reports (403)', async () => {
    const res = await ctx.call('POST', api('/reports'), { token: STAFF, body: validReport });
    assertErrorEnvelope(res, 403, 'FORBIDDEN');
  });
});

describe('updating reports (PUT)', () => {
  it('owner can update their pending report', async () => {
    const res = await ctx.call('PUT', api('/reports/rep_101'), {
      token: A,
      body: { inventoryItemId: 'inv_002', issueType: 'MISSING', comment: 'Sign has been removed' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.issueType, 'MISSING');
    assert.equal(res.json.data.inventoryItem.id, 'inv_002');
    assert.equal(res.json.data.priority, 'HIGH'); // re-triaged
    assert.equal(res.json.data.ownerId, 'user-a'); // owner never changes
  });

  it('PUT is idempotent: the same request twice gives the same result', async () => {
    const body = { inventoryItemId: 'inv_001', issueType: 'MISSING' };
    const first = await ctx.call('PUT', api('/reports/rep_101'), { token: A, body });
    const second = await ctx.call('PUT', api('/reports/rep_101'), { token: A, body });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(first.json.data, second.json.data);
  });

  it("user A cannot update user B's report", async () => {
    const res = await ctx.call('PUT', api('/reports/rep_103'), { token: A, body: validReport });
    assertErrorEnvelope(res, 404, 'NOT_FOUND');
    assert.equal(ctx.store.reports.find((r) => r.id === 'rep_103').inventoryItemId, 'inv_003');
  });

  it("user B cannot update user A's report", async () => {
    const res = await ctx.call('PUT', api('/reports/rep_101'), { token: B, body: validReport });
    assertErrorEnvelope(res, 404, 'NOT_FOUND');
  });

  it('admin can update any report, even one in progress', async () => {
    const res = await ctx.call('PUT', api('/reports/rep_102'), {
      token: ADMIN,
      body: { inventoryItemId: 'inv_004', issueType: 'BROKEN' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.issueType, 'BROKEN');
  });

  it('student cannot edit a report that is already in progress (409)', async () => {
    const res = await ctx.call('PUT', api('/reports/rep_102'), { token: A, body: validReport });
    assertErrorEnvelope(res, 409, 'CONFLICT');
  });

  it('validates the body on update (400)', async () => {
    const res = await ctx.call('PUT', api('/reports/rep_101'), { token: A, body: { issueType: 'NOPE' } });
    assertErrorEnvelope(res, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 when updating a non-existent report', async () => {
    const res = await ctx.call('PUT', api('/reports/rep_999'), { token: A, body: validReport });
    assertErrorEnvelope(res, 404, 'NOT_FOUND');
  });

  it('staff cannot use the general update endpoint (403)', async () => {
    const res = await ctx.call('PUT', api('/reports/rep_101'), { token: STAFF, body: validReport });
    assertErrorEnvelope(res, 403, 'FORBIDDEN');
  });

  it('refuses an update that would duplicate another open report (409)', async () => {
    //rep_101 is inv_001/BROKEN. Create a second report, then try to turn it into the same thing
    const created = await ctx.call('POST', api('/reports'), { token: A, body: { inventoryItemId: 'inv_006', issueType: 'BROKEN' } });
    const res = await ctx.call('PUT', api(`/reports/${created.json.data.id}`), {
      token: A,
      body: { inventoryItemId: 'inv_001', issueType: 'BROKEN' },
    });
    assertErrorEnvelope(res, 409, 'CONFLICT');
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
