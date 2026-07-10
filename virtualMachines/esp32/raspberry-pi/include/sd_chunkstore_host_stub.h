#pragma once

#include <cstdint>

class SDChunkstore {
public:
    bool isInitialized() const { return false; }
    int open(const char*, int) { return -1; }
    int read(int, uint8_t*, int) { return -1; }
    int write(int, const uint8_t*, int) { return -1; }
    bool close(int) { return false; }
};

inline SDChunkstore* globalChunkstore = nullptr;
