'use strict';

const { API_PREFIX } = require('../constants');
const systemRoutes = require('./system');

/** The single route table: used for routing, 405 handling and the greeting page's endpoint list. */
function buildRoutes() {
  const routes = [
    ...systemRoutes(API_PREFIX),
  ];
  return routes.map((route) => {
    const keys = [];
    const pattern = route.path.replace(/:([A-Za-z]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    return { ...route, keys, regex: new RegExp(`^${pattern}$`) };
  });
}

module.exports = { buildRoutes };
