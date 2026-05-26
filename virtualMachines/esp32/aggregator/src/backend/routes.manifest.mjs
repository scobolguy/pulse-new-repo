export const ROUTE_ROLE_MANIFEST = [
  { id: 'lifecycle-inquiry', registrar: 'registerLifecycleInquiryRoutes', dependencyKey: 'lifecycleInquiry', enabled: true },
  { id: 'lifecycle-worker-gateway', registrar: 'registerLifecycleWorkerGatewayRoutes', dependencyKey: 'lifecycleWorkerGateway', enabled: true },
  { id: 'queue-broker-ops', registrar: 'registerQueueBrokerOpsRoutes', dependencyKey: 'queueBrokerOps', enabled: true },
  { id: 'compliance', registrar: 'registerComplianceRoutes', dependencyKey: 'compliance', enabled: true },
  { id: 'observability', registrar: 'registerObservabilityRoutes', dependencyKey: 'observability', enabled: true },
  { id: 'platform', registrar: 'registerPlatformRoutes', dependencyKey: 'platform', enabled: true },
  { id: 'replication', registrar: 'registerReplicationRoutes', dependencyKey: 'replication', enabled: true },
  { id: 'queue-config', registrar: 'registerQueueConfigRoutes', dependencyKey: 'queueConfig', enabled: true }
];
