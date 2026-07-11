#pragma once

#include <Arduino.h>

#ifndef DISABLE_UNIQUE_ID_SERVICE

void uniqueIdBegin(const String& nodeName);
String uniqueIdGetDeviceId();
String uniqueIdNext(const String& kind = "evt");
String uniqueIdBuildStatusJson();
uint32_t uniqueIdGetCounter();

#else

inline void uniqueIdBegin(const String& nodeName) {
    (void)nodeName;
}

inline String uniqueIdGetDeviceId() {
    return "disabled";
}

inline String uniqueIdNext(const String& kind = "evt") {
    (void)kind;
    return "disabled";
}

inline String uniqueIdBuildStatusJson() {
    return "{\"enabled\":false}";
}

inline uint32_t uniqueIdGetCounter() {
    return 0;
}

#endif
