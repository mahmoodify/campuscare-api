'use strict';

const { createSeed } = require('./data/seed');

//In-memory "database". Each store is independent, which keeps tests isolated
function createStore() {
  const seed = createSeed();
  let counter = seed.nextReportNumber;
  return {
    users: seed.users,
    inventory: seed.inventory,
    reports: seed.reports,
    nextReportId() {
      return `rep_${counter++}`;
    },
  };
}

module.exports = { createStore };
