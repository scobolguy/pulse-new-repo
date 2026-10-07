#pragma once
#include <Arduino.h>

#if defined(ESP32) && defined(PULSE_ASYNC_DIAGNOSTICS)
#define PULSE_ASYNC_TRACE(format, ...) \
    Serial.printf("[ASYNC t=%lu heap=%u] " format "\n", \
        static_cast<unsigned long>(millis()), ESP.getFreeHeap(), ##__VA_ARGS__)
#else
#define PULSE_ASYNC_TRACE(...) do {} while (0)
#endif
