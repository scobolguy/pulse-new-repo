# Proposed Direction for Distributed Building Automation

## Vision
Enable dynamic, distributed automation of building systems (HVAC, lighting, security, etc.) using self-describing nodes and services, with orchestration and management powered by AI assistants like Copilot.

## Key Concepts
- **Self-Describing Nodes:** Each device/node advertises its capabilities (sensors, actuators, services) via a standard API (e.g., `/status`, `/services/describe`).
- **Service Registry/Topology API:** The system maintains a live, machine-readable map of all nodes, their services, and available actions.
- **Composable Services:** New services (e.g., a thermostat) can be defined by composing existing capabilities across nodes (e.g., temperature sensor + output pin).
- **Mode Management:** System-wide states (e.g., "away mode") can be defined, mapping to coordinated actions across devices.
- **AI-Driven Orchestration:** Copilot or similar tools can read the topology, propose new services, generate orchestration code, and manage modes on demand.

## Example Use Cases
- **Thermostat Service:** Combine a temperature sensor node and output pin node to control heating/cooling, possibly with a clock for scheduling.
- **Away Mode:** Lower thermostats, turn off lights, and lock doors across all relevant nodes with a single command.
- **Service Discovery:** New nodes/services are automatically detected and made available for orchestration.

## Requirements for AI Assistance
- **Structured Topology/Service Description:** JSON, YAML, or API endpoint listing all nodes, services, and actions.
- **Action API:** Standardized way to send commands to any service (REST, MQTT, etc.).
- **Mode Abstraction:** Document or API mapping modes (e.g., "away") to device states/actions.
- **Security (Future):** Authentication and authorization for sensitive actions.

## Copilot for Troubleshooting and Control

### Troubleshooting
- **Automated Diagnostics:** Copilot can analyze the topology, service health/status endpoints, and logs to identify offline nodes, failing services, or abnormal sensor readings.
- **Root Cause Analysis:** By correlating events and service dependencies, Copilot can suggest likely causes for system issues (e.g., a failed sensor causing HVAC malfunction).
- **Guided Remediation:** Copilot can propose or generate step-by-step fixes, configuration changes, or code patches based on detected issues.
- **Interactive Q&A:** Users can ask Copilot questions about the system state, recent errors, or how to resolve specific problems.

### Control Capabilities
- **Node/Device Control:** Copilot can send commands to individual nodes or devices (e.g., reboot, update firmware, set output state).
- **Cluster/Service Orchestration:** Copilot can coordinate actions across groups of nodes/services (e.g., rolling updates, synchronized mode changes).
- **Service Composition:** Copilot can help design and deploy new composite services by wiring together existing capabilities.
- **Mode Management:** Copilot can set system-wide modes (e.g., "away", "night") and ensure all devices/services comply.

## Security Model (Proposed)
- **Authentication:** All control and sensitive read operations require user authentication (e.g., OAuth, certificates, or local accounts).
- **Authorization:** Role-based access control (RBAC) determines who can control nodes, clusters, services, or modes (e.g., admin, operator, guest).
- **Audit Logging:** All control actions and sensitive queries are logged for traceability and compliance.
- **Least Privilege:** Services and users are granted only the permissions necessary for their function.
- **Secure Communication:** All API and device communication is encrypted (TLS/SSL or equivalent).
- **Copilot Integration:** Copilot actions are subject to the same authentication/authorization checks as human users, and can be limited to read-only or specific control scopes as needed.
- **Extensibility:** The security model can be extended to support multi-factor authentication, device attestation, or integration with enterprise IAM systems as requirements evolve.

## Next Steps
1. Define a schema for the topology/service registry (fields, relationships, etc.).
2. Implement or expose a live API or document for the current system state.
3. Prototype mode management (e.g., /api/mode endpoint or config file).
4. Use Copilot to generate orchestration code and propose new services based on the registry.

---

*This document is a starting point for discussion and design. Expand, revise, and iterate as needed.*
