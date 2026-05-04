#pragma once
#include <Arduino.h>
#include <vector>
#include <string>

// Device action types
enum class DeviceActionType {
    SetInput,
    SetOutput,
    RaisePin,
    LowerPin
};

// Device action definition
struct DeviceAction {
    DeviceActionType type;
    std::string name;
};

// Device configuration: list of possible actions
struct DeviceConfiguration {
    std::vector<DeviceAction> actions;
};

// DevicePin class: generic device abstraction
class DevicePin {
public:
    DevicePin(int pin, const DeviceConfiguration& config);
    ~DevicePin();
    void initialize();
    void teardown();
    void handleAction(const std::string& actionName);
    int getPin() const { return pin_; }
    const DeviceConfiguration& getConfig() const { return config_; }
private:
    int pin_;
    DeviceConfiguration config_;
    void setInput();
    void setOutput();
    void raisePin();
    void lowerPin();
};
