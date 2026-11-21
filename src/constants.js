'use strict';

module.exports = {
  VERSION: 'v1',
  API_PREFIX: '/api/v1',
  MAX_BODY_BYTES: 100 * 1024,
  ROLES: { STUDENT: 'student', STAFF: 'staff', ADMIN: 'admin' },
  ISSUE_TYPES: ['BROKEN', 'MISSING'],
  STATUSES: ['PENDING', 'IN_PROGRESS', 'RESOLVED'],
  PRIORITIES: ['HIGH', 'MEDIUM', 'LOW'],
  REPORT_SORTS: ['createdAt', '-createdAt', 'priority', '-priority'],
  // Allowed status workflow: a report moves forward one step at a time.
  TRANSITIONS: {
    PENDING: ['IN_PROGRESS'],
    IN_PROGRESS: ['RESOLVED'],
    RESOLVED: [],
  },
};
