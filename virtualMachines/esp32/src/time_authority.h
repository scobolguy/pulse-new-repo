#pragma once

#include <Arduino.h>

void timeAuthorityBegin(const String& nodeName);
void timeAuthorityLoop();
bool timeAuthorityForceResync(const char* reason = "manual");
unsigned long long timeAuthorityNowMs();
String timeAuthorityBuildStatusJson();
