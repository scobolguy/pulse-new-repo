#pragma once

#include "core/Types.h"

namespace pulse::services::bluetooth {
class BluetoothGateway;
}

namespace pulse::services::tts {
class PiperService;
}

namespace pulse::services::doorbell {
class DoorbellAlertService;
}

namespace pulse::core {

class EventRouter {
public:
    EventRouter(services::bluetooth::BluetoothGateway& bluetooth,
                services::tts::PiperService& tts,
                services::doorbell::DoorbellAlertService& doorbell);

    void routeAlert(const AlertEvent& alert);

private:
    services::bluetooth::BluetoothGateway& bluetooth_;
    services::tts::PiperService& tts_;
    services::doorbell::DoorbellAlertService& doorbell_;
};

} // namespace pulse::core
