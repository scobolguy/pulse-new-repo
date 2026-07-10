#pragma once

#include "core/Types.h"

#include <string>

namespace pulse::services::bluetooth {

class BluetoothGateway {
public:
    explicit BluetoothGateway(const core::NodeConfig& config);
    void start();
    void stop();
    void publishAlert(const std::string& message);
    bool isEnabled() const;
    std::string scanDevicesJson(bool ble, bool classic, int timeoutSec) const;
    bool connectDevice(const std::string& address, std::string* detail = nullptr) const;

private:
    core::NodeConfig config_;
    bool started_ = false;
};

} // namespace pulse::services::bluetooth
