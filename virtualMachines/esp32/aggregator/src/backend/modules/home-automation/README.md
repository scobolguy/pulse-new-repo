# Home Automation module

This directory owns Aggregator-side home-automation orchestration and its HTTP
API. Import its public surface from `index.mjs`; callers should not depend on
internal file paths.

```text
home-automation/
  application/                 # discovery, lifecycle, device actions, topology
    service.mjs
  http/                        # Express route adapter
    routes.mjs
  infrastructure/
    drivers/                   # protocol/vendor integrations
      alexa.mjs
      bluetooth.mjs
      kasa.mjs
      shark.mjs
      tplink.mjs
      tuya.mjs
      upnp.mjs
  shared/                      # small module-wide helpers
    utils.mjs
  index.mjs                    # stable public exports
```

The standalone process entry point is `aggregator/home-automation-service.mjs`;
the main Aggregator also creates the same application service. Credentials and
device configuration remain in `aggregator/data/`.

The older `src/backend/modules/homeAutomationService.mjs` is a separate,
duplicated implementation and is not imported by the current Aggregator or
standalone entry point. Do not add new consumers to it; remove it only after
checking for consumers outside this repository.

ESP32-native protocol implementations belong in the ESP32 PMachine host/runtime,
not in these Aggregator drivers. Pascalish program artifacts should stay
separate from the host-side protocol integrations.
