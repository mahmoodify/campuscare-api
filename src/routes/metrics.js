'use strict';

const { ok } = require('../http');
const { STATUSES } = require('../constants');
const { minutesBetween } = require('../services/reportService');

const average = (numbers) =>
  numbers.length ? Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 10) / 10 : null;

function maintenanceMetrics({ store }) {
  const reports = store.reports;
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, reports.filter((r) => r.status === s).length]));

  const openByBuilding = {};
  for (const r of reports) {
    if (r.status === 'RESOLVED') continue;
    const item = store.inventory.find((i) => i.id === r.inventoryItemId);
    const building = item ? item.building : 'Unknown';
    openByBuilding[building] = (openByBuilding[building] || 0) + 1;
  }

  const data = {
    totalReports: reports.length,
    byStatus,
    averageMinutesToInspect: average(
      reports.map((r) => minutesBetween(r.createdAt, r.inspectedAt)).filter((m) => m !== null)
    ),
    averageMinutesToResolve: average(
      reports.map((r) => minutesBetween(r.createdAt, r.resolvedAt)).filter((m) => m !== null)
    ),
    openReportsByBuilding: Object.entries(openByBuilding)
      .map(([building, open]) => ({ building, open }))
      .sort((a, b) => b.open - a.open || a.building.localeCompare(b.building)),
  };
  return ok(200, 'Maintenance metrics retrieved successfully.', data);
}

module.exports = function metricsRoutes(P) {
  return [
    {
      method: 'GET',
      path: `${P}/metrics/maintenance`,
      access: ['admin'],
      summary: 'Maintenance performance metrics: average inspection/resolution time, open reports per building.',
      handler: maintenanceMetrics,
    },
  ];
};
