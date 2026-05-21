export const ROUTE_ROLE_MANIFEST = [
  { id: 'lifecycle-inquiry', registrar: 'registerLifecycleInquiryRoutes', dependencyKey: 'lifecycleInquiry', enabled: true },
  { id: 'lifecycle-worker-gateway', registrar: 'registerLifecycleWorkerGatewayRoutes', dependencyKey: 'lifecycleWorkerGateway', enabled: true },
  { id: 'queue-broker-ops', registrar: 'registerQueueBrokerOpsRoutes', dependencyKey: 'queueBrokerOps', enabled: true },
  { id: 'compliance', registrar: 'registerComplianceRoutes', dependencyKey: 'compliance', enabled: true }
];
