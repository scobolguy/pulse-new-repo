#pragma once

#include <stdint.h>

bool initializeGpioPinSemaphores();
bool isGpioOutputCapablePin(int pin);

class GpioPinSemaphore {
public:
    explicit GpioPinSemaphore(int pin, uint32_t timeoutMs = 1000);
    ~GpioPinSemaphore();

    GpioPinSemaphore(const GpioPinSemaphore&) = delete;
    GpioPinSemaphore& operator=(const GpioPinSemaphore&) = delete;

    bool acquired() const;

private:
    int pin_;
    bool acquired_;
};