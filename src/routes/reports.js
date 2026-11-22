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

function create({ user, body, store, options }) {
  const { value, errors } = V.validateReportBody(body, store);
  if (errors.length) throw E.validation(errors);

  const duplicate = svc.findDuplicate(store, { ownerId: user.id, ...value });
  if (duplicate) {
    throw E.conflict(
      `You already have an open report (${duplicate.id}) for this item with the same issue type. Update or delete it instead of creating a duplicate.`
    );
  }
  const report = svc.create(store, { ownerId: user.id, value, aiEnabled: options.aiTriageEnabled });
  return ok(201, 'Report created successfully.', svc.present(store, report), undefined, {
    Location: `/api/v1/reports/${report.id}`,
  });
}

function update({ user, params, body, store, options }) {
  const report = svc.findVisible(store, user, params.id); // 404
  const { value, errors } = V.validateReportBody(body, store); // 400
  if (errors.length) throw E.validation(errors);

  if (user.role === 'student' && report.status !== 'PENDING') {
    throw E.conflict(
      `This report is already "${report.status}" and can no longer be edited. Only pending reports can be changed by their owner.`
    );
  }
  const duplicate = svc.findDuplicate(store, { ownerId: report.ownerId, ...value, excludeId: report.id });
  if (duplicate) {
    throw E.conflict(`Another open report (${duplicate.id}) already exists for this item with the same issue type.`);
  }
  svc.replace(store, report, value, options.aiTriageEnabled);
  return ok(200, 'Report updated successfully.', svc.present(store, report));
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
    {
      method: 'POST',
      path: `${P}/reports`,
      access: ['student', 'admin'],
      summary: 'Create a report for an inventory item and issue type.',
      handler: create,
    },
    {
      method: 'PUT',
      path: `${P}/reports/:id`,
      access: ['student', 'admin'],
      summary: 'Update a report (students: own pending reports only).',
      handler: update,
    },
  ];
};
