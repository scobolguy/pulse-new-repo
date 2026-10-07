#include "network_bindings.h"
#include "async_diagnostics.h"
#if defined(ESP32)
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiUdp.h>
#include <mbedtls/aes.h>
#include <mbedtls/gcm.h>

namespace pmachine {
namespace {
constexpr size_t BYTE_LIMIT = 4096;
int nibble(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}
bool decode(const std::string& hex, std::string& bytes) {
    if (hex.size() % 2 || hex.size() > BYTE_LIMIT * 2) return false;
    bytes.clear();
    bytes.reserve(hex.size() / 2);
    for (size_t i = 0; i < hex.size(); i += 2) {
        const int high = nibble(hex[i]), low = nibble(hex[i + 1]);
        if (high < 0 || low < 0) return false;
        bytes.push_back(static_cast<char>((high << 4) | low));
    }
    return true;
}
bool validHex(const std::string& hex) {
    if (hex.size() % 2 || hex.size() > BYTE_LIMIT * 2) return false;
    for (char ch : hex) if (nibble(ch) < 0) return false;
    return true;
}
size_t bufferCapacity(size_t bytes) {
    size_t capacity = 32;
    while (capacity < bytes) capacity *= 2;
    return capacity;
}
std::string encode(const uint8_t* bytes, size_t length) {
    constexpr char digits[] = "0123456789abcdef";
    std::string hex;
    hex.reserve(length * 2);
    for (size_t index = 0; index < length; ++index) {
        const uint8_t byte = bytes[index];
        hex.push_back(digits[byte >> 4]);
        hex.push_back(digits[byte & 15]);
    }
    return hex;
}
std::string encode(const std::string& bytes) {
    return encode(reinterpret_cast<const uint8_t*>(bytes.data()), bytes.size());
}
}

std::string NetworkBindings::eventBytes(const std::string& body) {
    return encode(body);
}

void NetworkBindings::diagnostics(JsonObject out, const Session& session) const {
    const auto& last = session.last;
    const auto exchanges = session.exchanges, failures = session.failures;
    out["scratchBytes"] = scratch.size();
    out["allowedPeers"] = session.allowed.size();
    out["exchanges"] = exchanges; out["failures"] = failures;
    out["transport"] = last.tcp ? "tcp" : "udp"; out["phase"] = last.phase;
    out["ok"] = last.ok; out["error"] = last.error;
    out["ip"] = last.ip.data(); out["port"] = last.port;
    out["budgetMs"] = last.budgetMs; out["elapsedMs"] = last.elapsedMs;
    out["connectMs"] = last.connectMs; out["writeMs"] = last.writeMs;
    out["firstByteMs"] = last.firstByteMs; out["expectedBytes"] = last.expectedBytes;
    out["requestBytes"] = last.requestBytes; out["writtenBytes"] = last.writtenBytes;
    out["receivedBytes"] = last.receivedBytes;
    out["wifiStatus"] = last.wifiStatus; out["rssi"] = last.rssi;
}

bool NetworkBindings::configure(JsonVariantConst peers, Session& session, std::string& error) {
    std::vector<std::pair<std::string, uint16_t>> next;
    if (!peers.isNull()) {
        if (!peers.is<JsonArrayConst>() || peers.size() > 8) {
            error = "Invalid network peer allowlist"; return false;
        }
        for (JsonVariantConst peer : peers.as<JsonArrayConst>()) {
            IPAddress address;
            const std::string ip = peer["ip"] | "";
            const int port = peer["port"] | 0;
            if (!address.fromString(ip.c_str()) || ip != address.toString().c_str() || port < 1 || port > 65535) {
                error = "Network peers require literal IPv4 addresses and valid ports"; return false;
            }
            next.emplace_back(ip, static_cast<uint16_t>(port));
        }
    }
    session.allowed = std::move(next);
    return true;
}

bool NetworkBindings::invoke(const std::string& op, const std::vector<HostValue>& args,
                             HostValue& result, std::string& error) {
    if (!current) { error = "Network session unavailable"; return false; }
    auto& last = current->last;
    auto& exchanges = current->exchanges;
    auto& failures = current->failures;
    const auto& allowed = current->allowed;
    auto fail = [&](const char* message) { error = message; return false; };
    auto byte = [](int value) { return value >= 0 && value <= 255; };
    if (op.rfind("buffer_", 0) == 0) {
        if (op == "buffer_create")
            return buffer.create(args[0].integer, result.integer, error);
        const int handle = args[0].integer;
        if (!buffer.valid(handle, error)) return false;
        if (op == "buffer_append") {
            result.integer = handle;
            return buffer.append(handle, args[1].integer, error);
        }
        if (op == "buffer_length") { result.integer = buffer.size(); return true; }
        if (op == "buffer_get") return buffer.get(handle, args[1].integer, result.integer, error);
        if (op == "buffer_set") {
            result.integer = handle;
            return buffer.set(handle, args[1].integer, args[2].integer, error);
        }
        if (op == "buffer_release") { buffer.reset(); result.integer = 0; return true; }
        if (op == "buffer_hex") result.text = encode(buffer.bytes(), buffer.size());
        else if (op == "buffer_text") return buffer.text(handle, result.text, error);
        else return fail("Unavailable byte buffer binding");
        buffer.reset();
        return true;
    }
    if (op == "byte_xor") {
        if (!byte(args[0].integer) || !byte(args[1].integer)) return fail("Invalid byte");
        result.integer = args[0].integer ^ args[1].integer;
        return true;
    }
    std::string data;
    if (op == "bytes_crc32") {
        if (!decode(args[0].text, data)) return fail("Invalid or oversized hex bytes");
        uint32_t crc = 0xffffffff;
        for (unsigned char ch : data) {
            crc ^= ch;
            for (int bit = 0; bit < 8; ++bit)
                crc = (crc >> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        char hex[9];
        snprintf(hex, sizeof(hex), "%08lx", static_cast<unsigned long>(crc ^ 0xffffffff));
        result.text = hex; return true;
    }
    if (op == "bytes_aes_ecb_decrypt" || op == "bytes_aes_gcm_decrypt") {
        std::string key;
        if (!decode(args[0].text, data) || !decode(args[1].text, key) || key.size() != 16)
            return fail("Invalid AES key or ciphertext");
        auto* output = scratch.data();
        int rc = 0;
        size_t length = data.size();
        if (op == "bytes_aes_ecb_decrypt") {
            if (!length || length % 16) return fail("Invalid AES ECB ciphertext length");
            mbedtls_aes_context aes;
            mbedtls_aes_init(&aes);
            rc = mbedtls_aes_setkey_dec(&aes, reinterpret_cast<const uint8_t*>(key.data()), 128);
            for (size_t offset = 0; !rc && offset < length; offset += 16)
                rc = mbedtls_aes_crypt_ecb(&aes, MBEDTLS_AES_DECRYPT,
                    reinterpret_cast<const uint8_t*>(data.data()) + offset, output + offset);
            mbedtls_aes_free(&aes);
            if (rc) return fail("AES ECB decryption failed");
            const uint8_t padding = output[length - 1];
            if (!padding || padding > 16) return fail("Invalid AES ECB padding");
            for (size_t index = length - padding; index < length; ++index)
                if (output[index] != padding) return fail("Invalid AES ECB padding");
            length -= padding;
        } else {
            std::string nonce, aad, tag;
            if (!decode(args[2].text, nonce) || nonce.size() != 12
                || !decode(args[3].text, aad) || !decode(args[4].text, tag) || tag.size() != 16)
                return fail("Invalid AES GCM nonce, AAD or tag");
            mbedtls_gcm_context gcm;
            mbedtls_gcm_init(&gcm);
            rc = mbedtls_gcm_setkey(&gcm, MBEDTLS_CIPHER_ID_AES,
                reinterpret_cast<const uint8_t*>(key.data()), 128);
            if (!rc) rc = mbedtls_gcm_auth_decrypt(&gcm, length,
                reinterpret_cast<const uint8_t*>(nonce.data()), nonce.size(),
                reinterpret_cast<const uint8_t*>(aad.data()), aad.size(),
                reinterpret_cast<const uint8_t*>(tag.data()), tag.size(),
                reinterpret_cast<const uint8_t*>(data.data()), output);
            mbedtls_gcm_free(&gcm);
            if (rc) return fail("AES GCM authentication failed");
        }
        result.text = encode(output, length); return true;
    }
    if (op == "bytes_from_text") {
        if (args[0].text.size() > BYTE_LIMIT) return fail("Text byte limit exceeded");
        result.text = encode(args[0].text); return true;
    }
    if (op.rfind("bytes_", 0) == 0) {
        const auto& hex = args[0].text;
        if (!validHex(hex)) return fail("Invalid or oversized hex bytes");
        const size_t size = hex.size() / 2;
        if (op == "bytes_length") result.integer = size;
        else if (op == "bytes_text") {
            if (!decode(hex, data)) return fail("Invalid or oversized hex bytes");
            // Validate UTF-8 through the JSON parser, without accepting embedded controls.
            std::string quoted = "\"";
            for (unsigned char c : data) {
                if (c < 32 || c == '"' || c == '\\') {
                    char escaped[7];
                    snprintf(escaped, sizeof(escaped), "\\u%04x", c);
                    quoted += escaped;
                } else quoted.push_back(c);
            }
            quoted += '"';
            JsonDocument doc;
            if (deserializeJson(doc, quoted)) return fail("Invalid text bytes");
            result.text = data;
        } else if (op == "bytes_get") {
            if (args[1].integer < 0 || static_cast<size_t>(args[1].integer) >= size)
                return fail("Invalid byte index");
            const size_t offset = static_cast<size_t>(args[1].integer) * 2;
            result.integer = (nibble(hex[offset]) << 4) | nibble(hex[offset + 1]);
        } else if (op == "bytes_append") {
            if (!byte(args[1].integer) || size >= BYTE_LIMIT) return fail("Invalid byte or byte capacity exceeded");
            constexpr char digits[] = "0123456789abcdef";
            result.text.reserve(bufferCapacity(hex.size() + 2));
            result.text = hex;
            result.text.push_back(digits[args[1].integer >> 4]);
            result.text.push_back(digits[args[1].integer & 15]);
        } else if (op == "bytes_slice") {
            const int start = args[1].integer, count = args[2].integer;
            if (start < 0 || count < 0 || static_cast<size_t>(start) > size
                || static_cast<size_t>(count) > size - start) return fail("Invalid byte slice");
            result.text = hex.substr(static_cast<size_t>(start) * 2, static_cast<size_t>(count) * 2);
        } else if (op == "bytes_join") {
            const auto& next = args[1].text;
            if (!validHex(next) || hex.size() + next.size() > BYTE_LIMIT * 2)
                return fail("Invalid bytes or byte capacity exceeded");
            result.text.reserve(bufferCapacity(hex.size() + next.size()));
            result.text = hex;
            result.text += next;
        }
        for (char& ch : result.text) if (ch >= 'A' && ch <= 'F' && op != "bytes_text") ch += 'a' - 'A';
        return true;
    }
    const bool intoBuffer = op == "tcp_exchange_buffer";
    const bool tcp = op == "tcp_exchange" || intoBuffer;
    const int timeout = args[tcp ? 4 : 3].integer, limit = args[tcp ? 5 : 4].integer;
    const int port = args[1].integer, prefix = tcp ? args[3].integer : 0;
    bool permitted = false;
    for (const auto& peer : allowed)
        if (peer.first == args[0].text && peer.second == port) permitted = true;
    if (!permitted) return fail("Network peer is not allowed");
    if (timeout < 1 || timeout > 2000 || limit < 1 || limit > static_cast<int>(BYTE_LIMIT)
        || (tcp && (prefix < 1 || prefix > 4))) return fail("Invalid network bounds");
    const auto& requestHex = args[2].text;
    if (!validHex(requestHex) || requestHex.empty()) return fail("Invalid network request bytes");
    const size_t requestBytes = requestHex.size() / 2;
    for (size_t index = 0; index < requestBytes; ++index)
        scratch[index] = (nibble(requestHex[index * 2]) << 4) | nibble(requestHex[index * 2 + 1]);
    IPAddress address;
    if (!address.fromString(args[0].text.c_str())) return fail("Invalid network address");
    const uint32_t started = millis();
    last = Exchange{};
    last.tcp = tcp; last.port = port; last.budgetMs = timeout;
    last.requestBytes = requestBytes;
    snprintf(last.ip.data(), last.ip.size(), "%s", args[0].text.c_str());
    ++exchanges;
    auto finish = [&](bool ok, const char* message) {
        last.ok = ok; last.error = message; last.elapsedMs = millis() - started;
        last.wifiStatus = WiFi.status(); last.rssi = WiFi.RSSI();
        if (!ok) ++failures;
        PULSE_ASYNC_TRACE("NET end %s peer=%s:%u phase=%s ok=%d error=%s elapsed=%lu budget=%lu connect=%lu write=%lu firstByte=%lu tx=%u/%u rx=%u expected=%lu wifi=%d rssi=%d",
            tcp ? "tcp" : "udp", last.ip.data(), last.port, last.phase, ok, message,
            static_cast<unsigned long>(last.elapsedMs), static_cast<unsigned long>(last.budgetMs),
            static_cast<unsigned long>(last.connectMs), static_cast<unsigned long>(last.writeMs),
            static_cast<unsigned long>(last.firstByteMs), static_cast<unsigned>(last.writtenBytes),
            static_cast<unsigned>(requestBytes), static_cast<unsigned>(last.receivedBytes),
            static_cast<unsigned long>(last.expectedBytes), last.wifiStatus, last.rssi);
        return ok ? true : fail(message);
    };
    PULSE_ASYNC_TRACE("NET begin %s peer=%s:%u request=%u limit=%d prefix=%d budget=%d wifi=%d rssi=%d",
        tcp ? "tcp" : "udp", last.ip.data(), last.port, static_cast<unsigned>(requestBytes),
        limit, prefix, timeout, WiFi.status(), WiFi.RSSI());
    if (tcp) {
        WiFiClient client;
        last.phase = "connect";
        const bool connected = client.connect(address, port, timeout);
        last.connectMs = millis() - started;
        PULSE_ASYNC_TRACE("NET TCP connect peer=%s ok=%d elapsed=%lu", last.ip.data(), connected,
            static_cast<unsigned long>(last.connectMs));
        if (!connected) return finish(false, "TCP connect failed");
        last.phase = "write";
        const uint32_t writeStarted = millis();
        last.writtenBytes = client.write(scratch.data(), requestBytes);
        last.writeMs = millis() - writeStarted;
        if (last.writtenBytes != requestBytes) {
            client.stop(); return finish(false, "Incomplete TCP write");
        }
        PULSE_ASYNC_TRACE("NET TCP write peer=%s bytes=%u elapsed=%lu remaining=%ld",
            last.ip.data(), static_cast<unsigned>(last.writtenBytes),
            static_cast<unsigned long>(last.writeMs),
            static_cast<long>(timeout) - static_cast<long>(millis() - started));
        uint32_t expected = 0;
        bool framed = false;
        last.phase = "frame-prefix";
        while (millis() - started < static_cast<uint32_t>(timeout)) {
            while (client.available()) {
                const int value = client.read();
                if (value < 0) break;
                if (!last.receivedBytes) {
                    last.firstByteMs = millis() - started;
                    PULSE_ASYNC_TRACE("NET TCP first byte peer=%s elapsed=%lu", last.ip.data(),
                        static_cast<unsigned long>(last.firstByteMs));
                }
                if (last.receivedBytes >= scratch.size()) {
                    client.stop(); return finish(false, "TCP response capacity exceeded");
                }
                scratch[last.receivedBytes++] = static_cast<uint8_t>(value);
                if (!framed && last.receivedBytes == static_cast<size_t>(prefix)) {
                    for (int index = 0; index < prefix; ++index) expected = (expected << 8) | scratch[index];
                    last.expectedBytes = expected;
                    if (!expected || expected > static_cast<uint32_t>(limit)) {
                        client.stop(); return finish(false, "Invalid TCP frame length");
                    }
                    framed = true;
                    last.phase = "frame-body";
                    PULSE_ASYNC_TRACE("NET TCP frame peer=%s payload=%lu elapsed=%lu", last.ip.data(),
                        static_cast<unsigned long>(expected), static_cast<unsigned long>(millis() - started));
                }
                if (framed && last.receivedBytes == expected + prefix) {
                    client.stop(); last.phase = "encode";
                    if (intoBuffer) {
                        if (!buffer.load(scratch.data() + prefix, expected, result.integer, error))
                            return finish(false, error.c_str());
                    } else result.text = encode(scratch.data(), last.receivedBytes);
                    last.phase = "complete"; return finish(true, "");
                }
            }
            if (!client.connected()) { client.stop(); return finish(false, "Incomplete TCP frame"); }
            delay(1);
        }
        client.stop(); return finish(false, "TCP exchange timeout");
    }
    WiFiUDP socket;
    last.phase = "bind";
    if (!socket.begin(0)) return finish(false, "UDP bind failed");
    last.phase = "send";
    const uint32_t writeStarted = millis();
    const bool packetStarted = socket.beginPacket(address, port);
    if (packetStarted) last.writtenBytes = socket.write(scratch.data(), requestBytes);
    const bool sent = packetStarted && last.writtenBytes == requestBytes && socket.endPacket();
    last.writeMs = millis() - writeStarted;
    if (!sent) { socket.stop(); return finish(false, "UDP send failed"); }
    last.phase = "datagram";
    while (millis() - started < static_cast<uint32_t>(timeout)) {
        const int size = socket.parsePacket();
        if (size > 0) {
            if (socket.remoteIP() != address || socket.remotePort() != port) { socket.flush(); continue; }
            last.firstByteMs = millis() - started; last.expectedBytes = size;
            if (size > limit) { socket.stop(); return finish(false, "UDP response capacity exceeded"); }
            const int received = socket.read(scratch.data(), size);
            last.receivedBytes = received > 0 ? static_cast<size_t>(received) : 0;
            if (received != size) {
                socket.stop(); return finish(false, "Incomplete UDP datagram");
            }
            socket.stop(); last.phase = "encode";
            result.text = encode(scratch.data(), last.receivedBytes);
            last.phase = "complete"; return finish(true, "");
        }
        delay(1);
    }
    socket.stop(); return finish(false, "UDP exchange timeout");
}
}
#endif
