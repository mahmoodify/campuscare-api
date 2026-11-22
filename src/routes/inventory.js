'use strict';

const { E } = require('../errors');
const { ok } = require('../http');
const V = require('../validation');

function listItems({ query, store }) {
  const { value: q, errors } = V.parseQuery(query, V.inventoryListSpec);
  if (errors.length) throw E.validation(errors, 'The request contains invalid query parameters.');

  let items = store.inventory;
  if (q.building) items = items.filter((i) => i.building.toLowerCase() === q.building.toLowerCase());
  const total = items.length;
  const start = (q.page - 1) * q.perPage;
  const page = items.slice(start, start + q.perPage).map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    building: i.building,
    location: i.location,
    safetyCritical: i.safetyCritical,
  }));
  return ok(200, 'Inventory items retrieved successfully.', page, { total, page: q.page, perPage: q.perPage });
}

module.exports = function inventoryRoutes(P) {
  return [
    {
      method: 'GET',
      path: `${P}/inventory-items`,
      access: ['student', 'staff', 'admin'],
      summary: 'List the preset inventory items students can report (filter by building).',
      handler: listItems,
    },
  ];
};
