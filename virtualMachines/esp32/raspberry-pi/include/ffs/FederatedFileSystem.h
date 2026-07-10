#pragma once

#include "Arduino.h"

// Host-side minimal FFS stub for PMachine core compilation.
class FederatedFileSystem {
public:
    int openFile(const String&, const String&) { return 0; }
    bool closeFile(int) { return false; }
    bool readLine(int, String&) { return false; }
    bool writeLine(int, const String&) { return false; }
};
