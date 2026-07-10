#include "core/EventRouter.h"

#include "services/bluetooth/BluetoothGateway.h"
#include "services/doorbell/DoorbellAlertService.h"
#include "services/tts/PiperService.h"

namespace pulse::core {

EventRouter::EventRouter(services::bluetooth::BluetoothGateway& bluetooth,
                         services::tts::PiperService& tts,
                         services::doorbell::DoorbellAlertService& doorbell)
    : bluetooth_(bluetooth), tts_(tts), doorbell_(doorbell) {}

void EventRouter::routeAlert(const AlertEvent& alert) {
    doorbell_.handle(alert);

    if (alert.eventType == "doorbell") {
        tts_.speak("Doorbell pressed");
        bluetooth_.publishAlert("doorbell");
    } else if (alert.eventType == "person") {
        tts_.speak("Person detected at the door");
        bluetooth_.publishAlert("person");
    }
}

} // namespace pulse::core
