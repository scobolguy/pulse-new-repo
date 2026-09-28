# Timeout and Error Routing Pattern (Pascalish + WFL)

Goal:
- If mapping fails, emit onError to cluster queue.
- If processing exceeds timeout, emit onTimeout to cluster queue.

Design split:
- Pascalish: do mapping, set outcome fields in context/payload.
- WFL: route based on outcome fields to cluster queues.

## 1) Pascalish pattern (mapping + outcome tags)

Use Pascalish for mapping and classification only. The runtime should set these fields in output context:
- `lifecycle.outcome`: `ok` | `error` | `timeout`
- `lifecycle.errorCode`: optional error code
- `lifecycle.errorMessage`: optional error detail
- `lifecycle.timeoutMs`: timeout threshold used

Example pattern:

```pascal
program PaymentMapPolicy;
begin
  { map MT103 to PACS payload }
  { on success: lifecycle.outcome := 'ok' }
  { on mapping failure: lifecycle.outcome := 'error' }
  { include lifecycle.errorCode and lifecycle.errorMessage }
end.
```

Notes:
- Timeout detection should be done by runtime scheduler/worker, not by busy waiting in program code.
- Runtime sets `lifecycle.outcome = 'timeout'` when step wall clock exceeds configured threshold.

## 2) WFL pattern (policy routing to cluster queues)

Define target queues in WFL and route by outcome.

```wfl
QUEUE "txOnError" -> "tx.lifecycle.onerror" TYPE "json";
QUEUE "txOnTimeout" -> "tx.lifecycle.ontimeout" TYPE "json";
QUEUE "txNextStep" -> "tx.pacs.created" TYPE "pacs";

WORKFLOW "payment-routing-policy" BEGIN
  IF FIELD "lifecycle.outcome" EQUALS "error" THEN
    STEP "route-on-error" ROUTE QUEUE "txOnError";
  ELSE;
  BEGIN
    IF FIELD "lifecycle.outcome" EQUALS "timeout" THEN
      STEP "route-on-timeout" ROUTE QUEUE "txOnTimeout";
    ELSE;
      STEP "route-next" ROUTE QUEUE "txNextStep";
    ENDIF;
  END;
  ENDIF;
END;
```

## 3) Cluster placement in WFL

Bind these queues to your cluster/manager policy in WFL deployment/bind section.

```wfl
bind queue txOnError manager qm-primary name "tx.lifecycle.onerror" cluster core fallback qm-secondary mode mirrored;
bind queue txOnTimeout manager qm-primary name "tx.lifecycle.ontimeout" cluster core fallback qm-secondary mode mirrored;
```

## 4) Runtime contract

Worker/runtime should:
- Start a per-step timer from transition config.
- If timer expires before transition completes:
  - set `lifecycle.outcome = 'timeout'`
  - route to onTimeout queue via WFL.
- If transition action throws:
  - set `lifecycle.outcome = 'error'`
  - attach error metadata
  - route to onError queue via WFL.

This keeps policy in WFL and business logic in Pascalish.
