#pragma once

#include <Arduino.h>
#include <Stream.h>

bool controlPlaneHandleLine(const String& line, Stream& io, const char* channelTag = "CONTROL");
void controlPlanePollStream(Stream& io, String& buffer, const char* channelTag = "CONTROL");
