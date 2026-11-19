#include "GpioPinSemaphore.h"

#if defined(ESP32)
#include <driver/gpio.h>
#include <soc/soc_caps.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <atomic>

namespace {
constexpr int kGpioPinCount = SOC_GPIO_PIN_COUNT;
SemaphoreHandle_t gpioSemaphore = nullptr;
portMUX_TYPE gpioSemaphoreMux = portMUX_INITIALIZER_UNLOCKED;
std::atomic<bool> semaphoresInitialized{false};

SemaphoreHandle_t findGpioSemaphore() {
    portENTER_CRITICAL(&gpioSemaphoreMux);
    SemaphoreHandle_t semaphore = gpioSemaphore;
    portEXIT_CRITICAL(&gpioSemaphoreMux);
    return semaphore;
}

SemaphoreHandle_t getOrCreateGpioSemaphore() {
    SemaphoreHandle_t semaphore = findGpioSemaphore();
    if (semaphore != nullptr) return semaphore;

    SemaphoreHandle_t candidate = xSemaphoreCreateMutex();
    if (candidate == nullptr) return nullptr;

    portENTER_CRITICAL(&gpioSemaphoreMux);
    if (gpioSemaphore == nullptr) {
        gpioSemaphore = candidate;
        semaphore = candidate;
        candidate = nullptr;
    } else {
        semaphore = gpioSemaphore;
    }
    portEXIT_CRITICAL(&gpioSemaphoreMux);

    if (candidate != nullptr) vSemaphoreDelete(candidate);
    return semaphore;
}
}

bool initializeGpioPinSemaphores() {
    semaphoresInitialized.store(true);
    return true;
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
    : ready_(false), acquired_(false) {
    if (!semaphoresInitialized.load() || pin < 0 || pin >= kGpioPinCount) return;
    SemaphoreHandle_t semaphore = getOrCreateGpioSemaphore();
    if (semaphore == nullptr) return;
    ready_ = true;
    acquired_ = xSemaphoreTake(semaphore, pdMS_TO_TICKS(timeoutMs)) == pdTRUE;
}

GpioPinSemaphore::~GpioPinSemaphore() {
    if (acquired_) {
        SemaphoreHandle_t semaphore = findGpioSemaphore();
        if (semaphore != nullptr) xSemaphoreGive(semaphore);
    }
}

bool GpioPinSemaphore::ready() const {
    return ready_;
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
    : ready_(pin >= 0), acquired_(pin >= 0) {}

GpioPinSemaphore::~GpioPinSemaphore() = default;

bool GpioPinSemaphore::ready() const {
    return ready_;
}

bool GpioPinSemaphore::acquired() const {
    return acquired_;
}
#endif