'use strict';

const { E } = require('./errors');

/**
 * Authentication: who is making the request?
 * The prototype uses predefined mock tokens (see src/data/seed.js) instead of
 * real login and password storage.
 */
function authenticate(req, store) {
  const header = req.headers['authorization'];
  if (!header) {
    throw E.unauthorized('Authentication required. Send the header "Authorization: Bearer <token>".');
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) {
    throw E.unauthorized('Malformed Authorization header. Expected format: "Authorization: Bearer <token>".');
  }
  const user = store.users.find((u) => u.token && u.token === match[1]);
  if (!user) {
    throw E.unauthorized('The token is invalid or has expired.');
  }
  return user;
}

/**
 * Authorization (part 1): is this role allowed to call this endpoint at all?
 * Ownership of individual resources is checked separately in the report service.
 */
function requireRole(user, allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    throw E.forbidden(
      `Your role "${user.role}" is not allowed to perform this action. Allowed roles: ${allowedRoles.join(', ')}.`
    );
  }
}

function publicUser(user) {
  const out = { id: user.id, name: user.name, role: user.role };
  if (user.buildings) out.buildings = user.buildings;
  return out;
}

module.exports = { authenticate, requireRole, publicUser };
