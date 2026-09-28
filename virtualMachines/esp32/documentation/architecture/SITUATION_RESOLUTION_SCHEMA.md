# Situation -> Resolution Schema (Draft v0.1)

This document defines a single, consistent model for handling many kinds of operational events:
- hardware events
- queue and service metrics
- policy/compliance conditions
- user or operator signals

The key idea is to normalize all triggers into a `Situation`, then resolve them using a reusable `ResolutionPolicy`.

## 1) Situation Envelope

```json
{
  "$schemaVersion": "0.1",
  "situationId": "sit_2026_07_12_0001",
  "situationType": "capacity-risk",
  "source": {
    "sourceType": "queue.metric",
    "sourceId": "queue.iso20022.dispatch",
    "nodeId": "node.magic-js-pmachine-01",
    "siteId": "site.primary-site"
  },
  "context": {
    "tenantId": "default",
    "environment": "prod",
    "tags": ["payments", "iso20022"]
  },
  "facts": [
    {
      "id": "queue.depth.percent",
      "valueType": "number",
      "value": 82,
      "unit": "percent",
      "observedAt": "2026-07-12T12:55:00Z"
    },
    {
      "id": "queue.depth.messages",
      "valueType": "integer",
      "value": 16400,
      "unit": "messages",
      "observedAt": "2026-07-12T12:55:00Z"
    }
  ],
  "predicate": {
    "operator": "all",
    "expressions": [
      {
        "left": "queue.depth.percent",
        "op": "gte",
        "right": 80
      }
    ],
    "window": {
      "durationMs": 60000,
      "sampleCount": 3,
      "mode": "majority"
    },
    "hysteresis": {
      "clearBelow": 70
    }
  },
  "severity": "high",
  "priority": 80,
  "detectedAt": "2026-07-12T12:55:01Z",
  "status": "detected"
}
```

## 2) Resolution Policy

```json
{
  "$schemaVersion": "0.1",
  "policyId": "policy.capacity-risk.default",
  "name": "Capacity Risk Default Response",
  "appliesTo": {
    "situationTypes": ["capacity-risk"],
    "sourceTypes": ["queue.metric", "service.metric", "hardware.sensor"],
    "environments": ["prod", "staging"]
  },
  "selection": {
    "strategy": "highest-priority-match",
    "weight": 100
  },
  "requiredCapabilities": [
    "service.consumer.start"
  ],
  "planRef": "plan.capacity-risk.scale-consumer.v1",
  "verificationRef": "verify.capacity-risk.reduced.v1",
  "compensationRef": "compensate.capacity-risk.rollback.v1",
  "timeouts": {
    "planStartMs": 10000,
    "verificationMs": 120000
  },
  "escalation": {
    "afterAttempts": 2,
    "target": "ops.oncall"
  },
  "enabled": true
}
```

## 3) Action Plan Graph

```json
{
  "$schemaVersion": "0.1",
  "planId": "plan.capacity-risk.scale-consumer.v1",
  "intent": "reduce_queue_pressure",
  "steps": [
    {
      "id": "step_01",
      "kind": "action",
      "actionType": "service.consumer.start",
      "target": {
        "targetType": "service",
        "targetId": "service.router.primary"
      },
      "inputs": {
        "queueId": "queue.iso20022.dispatch",
        "consumerCount": 1
      },
      "retry": {
        "maxAttempts": 3,
        "backoffMs": 2000,
        "mode": "exponential"
      },
      "timeoutMs": 10000,
      "onFailure": "step_03"
    },
    {
      "id": "step_02",
      "kind": "verify",
      "verificationType": "metric.threshold",
      "inputs": {
        "metricId": "queue.depth.percent",
        "op": "lt",
        "value": 75,
        "withinMs": 120000
      },
      "onSuccess": "resolved",
      "onFailure": "step_03"
    },
    {
      "id": "step_03",
      "kind": "action",
      "actionType": "notification.send",
      "target": {
        "targetType": "service",
        "targetId": "service.observability.primary"
      },
      "inputs": {
        "channel": "ops-oncall",
        "messageTemplate": "capacity_risk_unresolved"
      },
      "onSuccess": "escalated",
      "onFailure": "failed"
    }
  ]
}
```

## 4) Verification Contract

```json
{
  "$schemaVersion": "0.1",
  "verificationId": "verify.capacity-risk.reduced.v1",
  "checks": [
    {
      "id": "check_01",
      "type": "metric.threshold",
      "source": {
        "sourceType": "queue.metric",
        "sourceId": "queue.iso20022.dispatch"
      },
      "metricId": "queue.depth.percent",
      "op": "lt",
      "value": 75,
      "withinMs": 120000
    }
  ],
  "passCondition": "all"
}
```

## 5) Compensation Contract

```json
{
  "$schemaVersion": "0.1",
  "compensationId": "compensate.capacity-risk.rollback.v1",
  "steps": [
    {
      "id": "undo_01",
      "actionType": "service.consumer.stop",
      "target": {
        "targetType": "service",
        "targetId": "service.router.primary"
      },
      "inputs": {
        "queueId": "queue.iso20022.dispatch",
        "consumerCount": 1
      }
    }
  ]
}
```

## 6) Unified Event Source Vocabulary

Use one source taxonomy so all event types are modeled uniformly.

```json
{
  "sourceTypes": [
    "hardware.sensor",
    "hardware.input",
    "queue.metric",
    "service.metric",
    "workflow.state",
    "policy.signal",
    "operator.signal"
  ]
}
```

## 7) Unified Destination Action Vocabulary

```json
{
  "actionTypes": [
    "hardware.actuator.relay.on",
    "hardware.actuator.relay.off",
    "service.consumer.start",
    "service.consumer.stop",
    "queue.route.switch",
    "workflow.invoke",
    "notification.send"
  ]
}
```

## 8) Hardware Capability Compatibility

Represent hardware and runtime capabilities directly in catalog objects and deployment targets.

```json
{
  "deviceType": {
    "id": "esp32-cam",
    "capabilities": [
      "camera.capture",
      "hardware.sensor",
      "hardware.input.button",
      "wifi.client"
    ],
    "constraints": {
      "display": false,
      "camera": true
    },
    "buildProfile": {
      "platformioEnv": "esp32cam",
      "buildFlags": [
        "-D HAS_CAMERA=1",
        "-D HAS_DISPLAY=0"
      ]
    }
  }
}
```

## 9) Example Equivalence

These two are the same pattern:

A) Temperature case:
- Situation source: `hardware.sensor`
- Predicate: `temperature_f >= 80`
- Resolution action: `hardware.actuator.relay.on`

B) Queue depth case:
- Situation source: `queue.metric`
- Predicate: `queue.depth.percent >= 80`
- Resolution action: `service.consumer.start`

Difference is only event source and destination action, not control structure.

## 10) Lifecycle States

```json
{
  "lifecycle": [
    "detected",
    "qualified",
    "planned",
    "executing",
    "verifying",
    "resolved",
    "escalated",
    "failed"
  ]
}
```

## 11) Flow Designer Mapping (Suggested)

- Situation node:
  - source
  - predicate
  - severity/priority
- Resolution node:
  - policy reference
  - plan reference
  - verification/compensation
- Compatibility panel:
  - required capabilities
  - matching deployment targets
  - mismatch reasons

This enables a single design experience for hardware and non-hardware automation.
