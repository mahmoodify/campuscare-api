'use strict';

const { E } = require('../errors');
const { ok } = require('../http');
const { TRANSITIONS } = require('../constants');
const V = require('../validation');
const svc = require('../services/reportService');

const ALL = ['student', 'staff', 'admin'];

function list({ user, query, store }) {
  const { value: q, errors } = V.parseQuery(query, V.reportListSpec);
  if (errors.length) throw E.validation(errors, 'The request contains invalid query parameters.');
  const { items, total } = svc.list(store, user, q);
  return ok(200, 'Reports retrieved successfully.', items.map((r) => svc.present(store, r)), {
    total,
    page: q.page,
    perPage: q.perPage,
  });
}

function getOne({ user, params, store }) {
  const report = svc.findVisible(store, user, params.id);
  return ok(200, 'Report retrieved successfully.', svc.present(store, report));
}

module.exports = function reportRoutes(P) {
  return [
    {
      method: 'GET',
      path: `${P}/reports`,
      access: ALL,
      summary: 'List reports (students: own, staff: assigned to them, admin: all). Supports filters, sorting, paging.',
      handler: list,
    },
    {
      method: 'GET',
      path: `${P}/reports/:id`,
      access: ALL,
      summary: 'Get one report by ID.',
      handler: getOne,
    },
  ];
};
