'use strict';

const { E } = require('../errors');
const { triage } = require('./triage');
const { trunc } = require('../validation');

const RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function minutesBetween(from, to) {
  if (!from || !to) return null;
  return Math.round((Date.parse(to) - Date.parse(from)) / 60000);
}

function getItem(store, id) {
  return store.inventory.find((i) => i.id === id);
}

/** Shape a stored report for API output. */
function present(store, report) {
  const item = getItem(store, report.inventoryItemId);
  return {
    id: report.id,
    inventoryItem: item
      ? { id: item.id, name: item.name, building: item.building, location: item.location }
      : null,
    issueType: report.issueType,
    comment: report.comment,
    status: report.status,
    priority: report.priority,
    ownerId: report.ownerId,
    assignedTo: report.assignedTo,
    createdAt: report.createdAt,
    inspectedAt: report.inspectedAt,
    resolvedAt: report.resolvedAt,
    minutesToInspect: minutesBetween(report.createdAt, report.inspectedAt),
    minutesToResolve: minutesBetween(report.createdAt, report.resolvedAt),
  };
}

/**
 * Authorization (part 2): ownership / visibility.
 * Students see only their own reports, staff only reports assigned to them,
 * administrators see everything.
 */
function canSee(user, report) {
  if (user.role === 'admin') return true;
  if (user.role === 'student') return report.ownerId === user.id;
  if (user.role === 'staff') return report.assignedTo === user.id;
  return false;
}

/**
 * Find a report the caller may access. A report that does not exist and a report
 * that belongs to someone else produce the SAME 404, so a user cannot discover
 * which IDs exist in other people's data.
 */
function findVisible(store, user, id) {
  const report = store.reports.find((r) => r.id === id);
  if (!report || !canSee(user, report)) {
    throw E.notFound(`Report "${trunc(id)}" was not found.`);
  }
  return report;
}

/** FR-03: route a report to the staff member responsible for the item's building. */
function routeToStaff(store, item) {
  const staff = store.users.find((u) => u.role === 'staff' && (u.buildings || []).includes(item.building));
  return staff ? staff.id : null;
}

/** An owner may not have two open reports for the same item and issue. */
function findDuplicate(store, { ownerId, inventoryItemId, issueType, excludeId }) {
  return store.reports.find(
    (r) =>
      r.ownerId === ownerId &&
      r.inventoryItemId === inventoryItemId &&
      r.issueType === issueType &&
      r.status !== 'RESOLVED' &&
      r.id !== excludeId
  );
}

function create(store, { ownerId, value, aiEnabled }) {
  const item = getItem(store, value.inventoryItemId);
  const report = {
    id: store.nextReportId(),
    inventoryItemId: value.inventoryItemId,
    issueType: value.issueType,
    comment: value.comment,
    status: 'PENDING',
    priority: triage(item, aiEnabled),
    ownerId,
    assignedTo: routeToStaff(store, item),
    createdAt: new Date().toISOString(),
    inspectedAt: null,
    resolvedAt: null,
  };
  store.reports.push(report);
  return report;
}

function replace(store, report, value, aiEnabled) {
  const item = getItem(store, value.inventoryItemId);
  report.inventoryItemId = value.inventoryItemId;
  report.issueType = value.issueType;
  report.comment = value.comment;
  report.priority = triage(item, aiEnabled);
  report.assignedTo = routeToStaff(store, item);
  return report;
}

function remove(store, report) {
  store.reports.splice(store.reports.indexOf(report), 1);
}

/** FR-05 / FR-06: record when inspection started and when the issue was resolved. */
function setStatus(report, next) {
  const now = new Date().toISOString();
  if (next === 'IN_PROGRESS') report.inspectedAt = now;
  if (next === 'RESOLVED') report.resolvedAt = now;
  report.status = next;
  return report;
}

function list(store, user, query) {
  let items = store.reports.filter((r) => canSee(user, r));
  if (query.status) items = items.filter((r) => r.status === query.status);
  if (query.priority) items = items.filter((r) => r.priority === query.priority);
  if (query.issueType) items = items.filter((r) => r.issueType === query.issueType);

  const direction = query.sort.startsWith('-') ? -1 : 1;
  const field = query.sort.replace(/^-/, '');
  const byDate = (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
  items = [...items].sort((a, b) => {
    const primary = field === 'priority' ? RANK[a.priority] - RANK[b.priority] : byDate(a, b);
    return (primary || byDate(a, b)) * direction;
  });

  const total = items.length;
  const start = (query.page - 1) * query.perPage;
  return { items: items.slice(start, start + query.perPage), total };
}

module.exports = {
  present,
  findVisible,
  findDuplicate,
  create,
  replace,
  remove,
  setStatus,
  list,
  minutesBetween,
};
