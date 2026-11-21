'use strict';

//MOCK of the AI triage service. The real system would call an LLM.
//the prototype uses a simple deterministic rule so behaviour is predictable:
//  safety-critical item  -> HIGH
//  furniture             -> LOW
//  everything else       -> MEDIUM

//when the AI service is unavailable, reports are still accepted and get the default MEDIUM priority (set AI_TRIAGE_ENABLED=false to simulate).

function triage(item, aiEnabled) {
  if (!aiEnabled) return 'MEDIUM';
  if (item.safetyCritical) return 'HIGH';
  if (item.category === 'furniture') return 'LOW';
  return 'MEDIUM';
}

module.exports = { triage };
