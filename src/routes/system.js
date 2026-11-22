'use strict';

const { ok } = require('../http');
const { VERSION } = require('../constants');
const { publicUser } = require('../auth');

function health({ startedAt }) {
  return ok(200, 'The API is running.', {
    status: 'UP',
    version: VERSION,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  });
}

function me({ user }) {
  return ok(200, 'Current user retrieved successfully.', publicUser(user));
}

module.exports = function systemRoutes(P) {
  return [
    {
      method: 'GET',
      path: `${P}/health`,
      access: 'public',
      summary: 'Health check: confirms the API is running.',
      handler: health,
    },
    {
      method: 'GET',
      path: `${P}/me`,
      access: ['student', 'staff', 'admin'],
      summary: 'Show who the bearer token belongs to (id, name, role).',
      handler: me,
    },
  ];
};
