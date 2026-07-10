#include "platform/pi/PiRuntime.h"

#include <atomic>
#include <chrono>
#include <csignal>
#include <iostream>
#include <thread>
#include <vector>

#include "services/bluetooth/BluetoothGateway.h"
#include "services/discovery/NetworkAnnouncer.h"
#include "services/discovery/ServicePresencePublisher.h"
#include "services/ffs/FederatedFileClient.h"
#include "services/nodeapi/NodeApiServer.h"
#include "services/pmachine/PmachineQueueBridge.h"
#include "services/tts/PiperService.h"

namespace pulse::platform::pi {

namespace {
std::atomic<bool> gStopRequested{false};

void handleSignal(int) {
    gStopRequested.store(true);
}
}

PiRuntime::PiRuntime(const core::NodeConfig& config) : config_(config) {}

int PiRuntime::run() {
    std::signal(SIGINT, handleSignal);
#if defined(SIGTERM)
    std::signal(SIGTERM, handleSignal);
#endif

    std::cout << "[pi-node] starting node=" << config_.nodeId
              << " role=" << config_.role << '\n';

    services::bluetooth::BluetoothGateway bluetooth(config_);
    services::tts::PiperService tts(config_);
    std::vector<std::string> advertisedServices;
    advertisedServices.emplace_back("alert-router");
    if (config_.bluetoothEnabled) advertisedServices.emplace_back("bluetooth-gateway");
    if (config_.piperEnabled) advertisedServices.emplace_back("tts-piper");
    if (config_.doorbellEnabled) advertisedServices.emplace_back("doorbell-alerts");
    if (config_.httpEnabled) advertisedServices.emplace_back("pmachine");
    services::discovery::NetworkAnnouncer announcer(config_, advertisedServices);
    services::ffs::FederatedFileClient ffsClient(config_);
    services::pmachine::PmachineQueueBridge pmachineBridge(config_);
    services::nodeapi::NodeApiServer nodeApi(config_, pmachineBridge, bluetooth, tts);

    bluetooth.start();
    announcer.start();
    ffsClient.start();
    const bool nodeApiStarted = nodeApi.start();
    services::discovery::ServicePresencePublisher presence(config_, nodeApi.port());
    if (nodeApiStarted) {
        presence.start();
    }

    // Poll queue manager and run PMachine route execution continuously.
    const int pollMs = (config_.queuePollIntervalMs > 100) ? config_.queuePollIntervalMs : 100;
    while (!gStopRequested.load()) {
        pmachineBridge.pollOnce();

        std::this_thread::sleep_for(std::chrono::milliseconds(pollMs));
    }

    presence.stop();
    nodeApi.stop();
    ffsClient.stop();
    announcer.stop();
    bluetooth.stop();
    std::cout << "[pi-node] shutdown complete\n";
    return 0;
}

} // namespace pulse::platform::pi
