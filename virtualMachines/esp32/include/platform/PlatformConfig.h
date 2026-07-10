#pragma once

// Build-system platform switches. Keep this header side-effect free.
// It is intentionally lightweight so we can adopt it incrementally.

#if defined(PLATFORM_RPIB)
#define PLATFORM_IS_RPIB 1
#else
#define PLATFORM_IS_RPIB 0
#endif

#if defined(PLATFORM_ESP) || defined(ESP_PLATFORM) || defined(ARDUINO_ARCH_ESP32)
#define PLATFORM_IS_ESP 1
#else
#define PLATFORM_IS_ESP 0
#endif

#if PLATFORM_IS_RPIB && PLATFORM_IS_ESP
#error "Invalid platform config: both RPIB and ESP are enabled"
#endif

#if !PLATFORM_IS_RPIB && !PLATFORM_IS_ESP
#define PLATFORM_IS_UNKNOWN 1
#else
#define PLATFORM_IS_UNKNOWN 0
#endif
