'use strict';

const { E } = require('./errors');

const COMMON_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'Location',
};

/** Build a success reply: { status, body, headers } where body is the JSON envelope. */
function ok(status, message, data, meta, headers) {
  const body = { success: true, message, data: data === undefined ? null : data };
  if (meta) body.meta = meta;
  return { status, body, headers };
}

function errorBody(code, message, details) {
  const error = { code, message };
  if (details && details.length) error.details = details;
  return { success: false, error };
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    ...COMMON_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendHtml(res, status, html, headers = {}) {
  res.writeHead(status, {
    ...COMMON_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(html);
}

function sendEmpty(res, status, headers = {}) {
  res.writeHead(status, { ...COMMON_HEADERS, ...headers });
  res.end();
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw E.tooLarge(limit);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Parse a JSON request body. An empty body is treated as an empty object. */
function parseJsonBody(raw) {
  if (raw.trim() === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw E.invalidJson();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw E.validation([{ field: 'body', message: 'The request body must be a JSON object.' }]);
  }
  return parsed;
}

module.exports = { ok, errorBody, sendJson, sendHtml, sendEmpty, readBody, parseJsonBody };
