#include "GpioPinSemaphore.h"

#if defined(ESP32)
#include <driver/gpio.h>
#include <soc/soc_caps.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

namespace {
constexpr int kGpioPinCount = SOC_GPIO_PIN_COUNT;
StaticSemaphore_t pinSemaphoreStorage[kGpioPinCount];
SemaphoreHandle_t pinSemaphores[kGpioPinCount] = {};
bool semaphoresInitialized = false;
}

bool initializeGpioPinSemaphores() {
    bool initialized = true;
    for (int pin = 0; pin < kGpioPinCount; ++pin) {
        if (pinSemaphores[pin] == nullptr) {
            pinSemaphores[pin] = xSemaphoreCreateMutexStatic(&pinSemaphoreStorage[pin]);
        }
        initialized = initialized && pinSemaphores[pin] != nullptr;
    }
    semaphoresInitialized = initialized;
    return semaphoresInitialized;
}

bool isGpioOutputCapablePin(int pin) {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    return pin >= 0 && pin < kGpioPinCount
        && GPIO_IS_VALID_OUTPUT_GPIO(pin) && !(pin >= 26 && pin <= 37);
#else
    return (pin >= 0 && pin <= 5)
        || (pin >= 12 && pin <= 19)
        || (pin >= 21 && pin <= 23)
        || (pin >= 25 && pin <= 27)
        || pin == 32 || pin == 33;
#endif
}

GpioPinSemaphore::GpioPinSemaphore(int pin, uint32_t timeoutMs)
    : pin_(pin), acquired_(false) {
    if (!semaphoresInitialized || pin_ < 0 || pin_ >= kGpioPinCount) return;
    acquired_ = xSemaphoreTake(pinSemaphores[pin_], pdMS_TO_TICKS(timeoutMs)) == pdTRUE;
}

GpioPinSemaphore::~GpioPinSemaphore() {
    if (acquired_) xSemaphoreGive(pinSemaphores[pin_]);
}

bool GpioPinSemaphore::acquired() const {
    return acquired_;
}
#else
bool initializeGpioPinSemaphores() {
    return true;
}

bool isGpioOutputCapablePin(int pin) {
    return pin >= 0;
}

GpioPinSemaphore::GpioPinSemaphore(int pin, uint32_t)
    : pin_(pin), acquired_(pin >= 0) {}

GpioPinSemaphore::~GpioPinSemaphore() = default;

bool GpioPinSemaphore::acquired() const {
    return acquired_;
}
#endif