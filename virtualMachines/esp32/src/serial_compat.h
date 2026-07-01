/**
 * Serial Compatibility Header
 * 
 * Provides a unified SERIAL_DEBUG macro that works across different
 * ESP32 configurations, including USB CDC mode.
 */

#ifndef SERIAL_COMPAT_H
#define SERIAL_COMPAT_H

#include <Arduino.h>

// When USB CDC is enabled, Serial may not be available
// Use Serial0 (hardware UART) or conditionally check Serial
#if ARDUINO_USB_CDC_ON_BOOT
  // USB CDC mode - Serial might not be available, use Serial0 or check availability
  #if defined(Serial)
    #define SERIAL_DEBUG Serial
  #else
    #define SERIAL_DEBUG Serial0
  #endif
  #define SERIAL_PRINTF(fmt, ...) if(SERIAL_DEBUG) SERIAL_DEBUG.printf(fmt, ##__VA_ARGS__)
  #define SERIAL_PRINTLN(msg) if(SERIAL_DEBUG) SERIAL_DEBUG.println(msg)
  #define SERIAL_PRINT(msg) if(SERIAL_DEBUG) SERIAL_DEBUG.print(msg)
#else
  // Standard mode - Serial is always available
  #define SERIAL_DEBUG Serial
  #define SERIAL_PRINTF(fmt, ...) Serial.printf(fmt, ##__VA_ARGS__)
  #define SERIAL_PRINTLN(msg) Serial.println(msg)
  #define SERIAL_PRINT(msg) Serial.print(msg)
#endif

#endif // SERIAL_COMPAT_H

// Made with Bob
