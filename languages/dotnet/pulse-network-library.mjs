export const PULSE_NETWORK_IMPORTS = [
  {
    key: 'Pulse.Net.LocalIpv4Subnets',
    label: 'host.local_ipv4_subnets',
    parameterTypes: [],
    returnType: 'string'
  },
  {
    key: 'Pulse.Net.KasaDiscover',
    label: 'host.kasa_discover',
    parameterTypes: [],
    returnType: 'string'
  },
  {
    key: 'Pulse.Net.CameraDiscover',
    label: 'host.camera_discover',
    parameterTypes: [],
    returnType: 'string'
  },
  {
    key: 'Pulse.Process.CheckpointProcess',
    label: 'host.checkpoint_process',
    parameterTypes: ['string', 'string', 'string'],
    returnType: 'string'
  },
  {
    key: 'Pulse.Process.RestoreCheckpoint',
    label: 'host.restore_checkpoint',
    parameterTypes: ['string', 'string'],
    returnType: 'string'
  },
  {
    key: 'Pulse.Process.BeginTransaction',
    label: 'host.begin_transaction',
    parameterTypes: ['string', 'string'],
    returnType: 'string'
  },
  {
    key: 'Pulse.Process.CommitTransaction',
    label: 'host.commit_transaction',
    parameterTypes: ['string'],
    returnType: 'string'
  },
  {
    key: 'Pulse.Process.AbortTransaction',
    label: 'host.abort_transaction',
    parameterTypes: ['string'],
    returnType: 'string'
  }
];
