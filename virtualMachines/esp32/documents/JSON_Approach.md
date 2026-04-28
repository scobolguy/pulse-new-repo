# JSON Serialization/Deserialization Approach

## Overview
This project uses a schema-driven approach for config serialization/deserialization, but you can (and should) use ArduinoJson's JsonDocument API directly for general JSON message handling (e.g., web endpoints, dynamic messages) instead of rolling your own each time.

## Config Structs (Schema-Driven)
- Config structs (e.g., ClusterConfig, WifiConfig) use a FieldDescriptor schema array.
- Generic helpers (`serializeWithSchema`, `deserializeWithSchema`, `saveConfigToFile`, `loadConfigFromFile`) automate (de)serialization to/from JSON and persistent storage.
- This is ideal for static, well-defined config objects.

## General JSON Usage (Web/API/Other)
- For web endpoints, dynamic messages, or ad-hoc JSON, use ArduinoJson's JsonDocument API directly:
  - Parse: `deserializeJson(doc, input)`
  - Serialize: `serializeJson(doc, output)`
  - Access fields: `doc["key"] = value;` or `auto val = doc["key"].as<Type>();`
- This avoids duplicating code and leverages ArduinoJson's robust parsing/serialization.

## Example: Web Endpoint JSON
```cpp
AsyncWebServerRequest* request;
StaticJsonDocument<256> doc;
deserializeJson(doc, request->arg("plain"));
String value = doc["someKey"].as<String>();
// ...
doc["response"] = "ok";
String json;
serializeJson(doc, json);
request->send(200, "application/json", json);
```

## Recommendation
- Use the schema/type manager for config structs.
- Use ArduinoJson's JsonDocument API for all other JSON needs (web, dynamic, etc.).
- Do not manually parse/format JSON strings—let ArduinoJson handle it for you.

## Migration Note
- Migrate from `StaticJsonDocument` to `JsonDocument` as ArduinoJson recommends, to avoid deprecation warnings.
