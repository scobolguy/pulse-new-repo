#include "DevicePin.h"

DevicePin::DevicePin(int pin, const DeviceConfiguration& config)
    : pin_(pin), config_(config) {}

DevicePin::~DevicePin() {
    teardown();
}

void DevicePin::initialize() {
    // Default to input
    pinMode(pin_, INPUT);
}

void DevicePin::teardown() {
    // Optionally set to input or disable
    pinMode(pin_, INPUT);
}

void DevicePin::handleAction(const std::string& actionName) {
    for (const auto& action : config_.actions) {
        if (action.name == actionName) {
            switch (action.type) {
                case DeviceActionType::SetInput:
                    setInput();
                    break;
                case DeviceActionType::SetOutput:
                    setOutput();
                    break;
                case DeviceActionType::RaisePin:
                    raisePin();
                    break;
                case DeviceActionType::LowerPin:
                    lowerPin();
                    break;
            }
            return;
        }
    }
    // Unknown action: optionally log or ignore
}

void DevicePin::setInput() {
    pinMode(pin_, INPUT);
}

void DevicePin::setOutput() {
    pinMode(pin_, OUTPUT);
}

void DevicePin::raisePin() {
    digitalWrite(pin_, HIGH);
}

void DevicePin::lowerPin() {
    digitalWrite(pin_, LOW);
}
