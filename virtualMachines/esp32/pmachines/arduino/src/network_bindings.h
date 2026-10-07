#pragma once
#if defined(ESP32)
#include "pmachine.h"
#include <ArduinoJson.h>
#include <array>
#include "byte_buffer.h"

namespace pmachine {
class NetworkBindings {
public:
    static std::string eventBytes(const std::string& body);
    bool invoke(const std::string& operation, const std::vector<HostValue>& args,
                HostValue& result, std::string& error);
    struct Exchange {
        bool tcp = false, ok = false;
        const char* phase = "idle";
        const char* error = "";
        std::array<char, 16> ip{};
        uint16_t port = 0;
        uint32_t budgetMs = 0, elapsedMs = 0, connectMs = 0, writeMs = 0;
        uint32_t firstByteMs = 0, expectedBytes = 0;
        size_t requestBytes = 0, writtenBytes = 0, receivedBytes = 0;
        int wifiStatus = 0, rssi = 0;
    };
    struct Session {
        Exchange last;
        uint32_t exchanges = 0, failures = 0;
        std::vector<std::pair<std::string, uint16_t>> allowed;
    };
    static bool configure(JsonVariantConst peers, Session& session, std::string& error);
    void select(Session& session) { current = &session; }
    void diagnostics(JsonObject out, const Session& session) const;
    void resetBuffers() { buffer.reset(); }
    bool bufferTextView(int handle, const char*& data, size_t& count, std::string& error) const {
        return buffer.textView(handle, data, count, error);
    }
private:
    // ServiceHost serializes calls on its worker; scratch never escapes invoke().
    std::array<uint8_t, 4100> scratch{};
    ByteBuffer buffer;
    Session* current = nullptr;
};
}
#endif
