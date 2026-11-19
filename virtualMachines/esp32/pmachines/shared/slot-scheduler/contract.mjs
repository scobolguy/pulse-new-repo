export const SLOT_SCHEDULER_VERSION = 1;
export const SLOT_SCHEDULER_ID = 'pulse-slot-scheduler';
export const SLOT_SCHEDULER_CAPACITY = 16;
export const SLOT_SCHEDULER_KINDS = Object.freeze(['service', 'daemon', 'transient']);
export const SLOT_SCHEDULER_BINDINGS = Object.freeze([
  'host.scheduler_operation', 'host.scheduler_request', 'host.scheduler_read',
  'host.scheduler_slot', 'host.scheduler_stage', 'host.scheduler_activate',
  'host.scheduler_remove', 'host.scheduler_saved_state', 'host.scheduler_commit',
  'host.scheduler_error', 'host.scheduler_respond',
]);
