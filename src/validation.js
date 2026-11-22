'use strict';

const { ISSUE_TYPES, STATUSES, PRIORITIES, REPORT_SORTS } = require('./constants');

const trunc = (value, max = 40) => {
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

function unknownFields(body, allowed) {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((key) => ({
      field: trunc(key),
      message: `Unknown or read-only field "${trunc(key)}". Allowed fields: ${allowed.join(', ')}.`,
    }));
}

//Body of POST /reports and PUT /reports/{id}
//Returns { value, errors }. PUT replaces the whole writable part of the report, so an omitted optional "comment" is cleared

function validateReportBody(body, store) {
  const allowed = ['inventoryItemId', 'issueType', 'comment'];
  const errors = unknownFields(body, allowed);
  const value = {};

  //inventoryItemId: required, string, must exist
  if (body.inventoryItemId === undefined || body.inventoryItemId === null) {
    errors.push({ field: 'inventoryItemId', message: 'inventoryItemId is required.' });
  } else if (typeof body.inventoryItemId !== 'string') {
    errors.push({ field: 'inventoryItemId', message: 'inventoryItemId must be a string, for example "inv_001".' });
  } else if (!store.inventory.some((i) => i.id === body.inventoryItemId)) {
    errors.push({
      field: 'inventoryItemId',
      message: `Inventory item "${trunc(body.inventoryItemId)}" does not exist. Use GET /api/v1/inventory-items to see valid IDs.`,
    });
  } else {
    value.inventoryItemId = body.inventoryItemId;
  }

  //issueType: required, one of the preset values
  if (body.issueType === undefined || body.issueType === null) {
    errors.push({ field: 'issueType', message: `issueType is required and must be one of: ${ISSUE_TYPES.join(', ')}.` });
  } else if (typeof body.issueType !== 'string' || !ISSUE_TYPES.includes(body.issueType)) {
    errors.push({ field: 'issueType', message: `issueType must be one of: ${ISSUE_TYPES.join(', ')}.` });
  } else {
    value.issueType = body.issueType;
  }

  //comment: optional text, 3-200 characters
  if (body.comment === undefined || body.comment === null) {
    value.comment = null;
  } else if (typeof body.comment !== 'string') {
    errors.push({ field: 'comment', message: 'comment must be a string.' });
  } else {
    const trimmed = body.comment.trim();
    if (trimmed.length < 3 || trimmed.length > 200) {
      errors.push({ field: 'comment', message: 'comment must contain between 3 and 200 characters when provided.' });
    } else {
      value.comment = trimmed;
    }
  }

  return { value, errors };
}

//Body of PUT /reports/{id}/status
function validateStatusBody(body) {
  const errors = unknownFields(body, ['status']);
  const value = {};
  if (body.status === undefined || body.status === null) {
    errors.push({ field: 'status', message: `status is required and must be one of: ${STATUSES.join(', ')}.` });
  } else if (typeof body.status !== 'string' || !STATUSES.includes(body.status)) {
    errors.push({ field: 'status', message: `status must be one of: ${STATUSES.join(', ')}.` });
  } else {
    value.status = body.status;
  }
  return { value, errors };
}


const enumRule = (values) => (raw, key) =>
  values.includes(raw) ? { value: raw } : { error: `${key} must be one of: ${values.join(', ')}.` };

const intRule = (min, max) => (raw, key) => {
  if (!/^\d+$/.test(raw)) return { error: `${key} must be an integer.` };
  const n = Number(raw);
  if (n < min || (max !== undefined && n > max)) {
    return { error: max === undefined ? `${key} must be ${min} or greater.` : `${key} must be between ${min} and ${max}.` };
  }
  return { value: n };
};

const textRule = (maxLength) => (raw, key) =>
  raw.length >= 1 && raw.length <= maxLength
    ? { value: raw }
    : { error: `${key} must contain between 1 and ${maxLength} characters.` };

const PAGING = {
  page: { parse: intRule(1), default: 1 },
  perPage: { parse: intRule(1, 100), default: 10 },
};

const reportListSpec = {
  ...PAGING,
  status: { parse: enumRule(STATUSES) },
  priority: { parse: enumRule(PRIORITIES) },
  issueType: { parse: enumRule(ISSUE_TYPES) },
  sort: { parse: enumRule(REPORT_SORTS), default: '-createdAt' },
};

const inventoryListSpec = {
  ...PAGING,
  building: { parse: textRule(50) },
};

//Validate URLSearchParams against a spec. Unknown parameters are rejected
function parseQuery(searchParams, spec) {
  const errors = [];
  const value = {};
  for (const key of new Set(searchParams.keys())) {
    if (!(key in spec)) {
      errors.push({ field: trunc(key), message: `Unknown query parameter "${trunc(key)}". Allowed: ${Object.keys(spec).join(', ')}.` });
    }
  }
  for (const [key, rule] of Object.entries(spec)) {
    const raw = searchParams.get(key);
    if (raw === null) {
      if (rule.default !== undefined) value[key] = rule.default;
      continue;
    }
    const result = rule.parse(raw, key);
    if (result.error) errors.push({ field: key, message: result.error });
    else value[key] = result.value;
  }
  return { value, errors };
}

module.exports = {
  validateReportBody,
  validateStatusBody,
  parseQuery,
  reportListSpec,
  inventoryListSpec,
  trunc,
};
