'use strict';

//Initial mock data. Everything lives in memory and resets when the server restarts
//createSeed() returns a fresh copy each time so tests can start from a clean state

function createSeed() {
  const users = [
    { id: 'user-a', name: 'Student A', role: 'student', token: 'user-a-token' },
    { id: 'user-b', name: 'Student B', role: 'student', token: 'user-b-token' },
    { id: 'admin-1', name: 'Administrator', role: 'admin', token: 'admin-token' },
    { id: 'staff-1', name: 'Maintenance Staff 1', role: 'staff', token: 'staff-token', buildings: ['Building A', 'Building B'] },
    { id: 'staff-2', name: 'Maintenance Staff 2', role: 'staff', token: null, buildings: ['Building C'] },
  ];

  const inventory = [
    { id: 'inv_001', name: 'Ceiling light', category: 'lighting', building: 'Building A', location: 'Room 204', safetyCritical: false },
    { id: 'inv_002', name: 'Emergency exit sign', category: 'fire-safety', building: 'Building A', location: 'Ground floor corridor', safetyCritical: true },
    { id: 'inv_003', name: 'Fire extinguisher', category: 'fire-safety', building: 'Building A', location: 'Second floor corridor', safetyCritical: true },
    { id: 'inv_004', name: 'Projector', category: 'equipment', building: 'Building B', location: 'Room 101', safetyCritical: false },
    { id: 'inv_005', name: 'Lecture chair', category: 'furniture', building: 'Building B', location: 'Room 101', safetyCritical: false },
    { id: 'inv_006', name: 'Water fountain', category: 'plumbing', building: 'Building B', location: 'Ground floor', safetyCritical: false },
    { id: 'inv_007', name: 'Stair handrail', category: 'structure', building: 'Building C', location: 'Main staircase', safetyCritical: true },
    { id: 'inv_008', name: 'Laboratory microscope', category: 'equipment', building: 'Building C', location: 'Lab 3', safetyCritical: false },
    { id: 'inv_009', name: 'Whiteboard', category: 'equipment', building: 'Building C', location: 'Room 12', safetyCritical: false },
  ];

  const reports = [
    {
      id: 'rep_101', inventoryItemId: 'inv_001', issueType: 'BROKEN', comment: 'Flickers all the time',
      status: 'PENDING', priority: 'MEDIUM', ownerId: 'user-a', assignedTo: 'staff-1',
      createdAt: '2026-11-12T09:15:00.000Z', inspectedAt: null, resolvedAt: null,
    },
    {
      id: 'rep_102', inventoryItemId: 'inv_004', issueType: 'MISSING', comment: null,
      status: 'IN_PROGRESS', priority: 'MEDIUM', ownerId: 'user-a', assignedTo: 'staff-1',
      createdAt: '2026-11-11T10:00:00.000Z', inspectedAt: '2026-11-11T10:30:00.000Z', resolvedAt: null,
    },
    {
      id: 'rep_103', inventoryItemId: 'inv_003', issueType: 'MISSING', comment: null,
      status: 'PENDING', priority: 'HIGH', ownerId: 'user-b', assignedTo: 'staff-1',
      createdAt: '2026-11-13T07:50:00.000Z', inspectedAt: null, resolvedAt: null,
    },
    {
      id: 'rep_104', inventoryItemId: 'inv_009', issueType: 'BROKEN', comment: 'Marker tray is cracked',
      status: 'RESOLVED', priority: 'MEDIUM', ownerId: 'user-b', assignedTo: 'staff-2',
      createdAt: '2026-11-10T08:00:00.000Z', inspectedAt: '2026-11-10T08:45:00.000Z', resolvedAt: '2026-11-10T11:30:00.000Z',
    },
    {
      id: 'rep_105', inventoryItemId: 'inv_005', issueType: 'BROKEN', comment: null,
      status: 'PENDING', priority: 'LOW', ownerId: 'user-b', assignedTo: 'staff-1',
      createdAt: '2026-11-13T12:30:00.000Z', inspectedAt: null, resolvedAt: null,
    },
  ];

  return { users, inventory, reports, nextReportNumber: 106 };
}

module.exports = { createSeed };
