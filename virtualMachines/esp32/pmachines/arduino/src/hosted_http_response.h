#pragma once
#if defined(ESP32)
#include <WebResponseImpl.h>
#include "service_host.h"
#include "async_diagnostics.h"
#include <cstring>

namespace pmachine {
class HostedBoundedResponse : public AsyncWebServerResponse {
public:
    HostedBoundedResponse() {
        addHeader("Connection", "close");
    }
    bool _sourceValid() const override { return true; }
    void _respond(AsyncWebServerRequest* request) override {
        head = _assembleHead(request->version());
        if (head.length() != _headLength || !head.length()) {
            Serial.println("[SERVICE-HOST] Hosted response header allocation failed");
            _state = RESPONSE_FAILED;
            request->client()->close();
            return;
        }
        _state = RESPONSE_HEADERS;
        _ack(request, 0, 0);
    }
    size_t _ack(AsyncWebServerRequest* request, size_t length, uint32_t) override {
        _ackedLength += length;
        if (_writtenLength > _ackedLength) {
            request->client()->send();
            return 0;
        }
        size_t written = 0;
        while (_state == RESPONSE_HEADERS || _state == RESPONSE_CONTENT) {
            const bool sendingHead = _state == RESPONSE_HEADERS;
            if (!sendingHead && offset == _contentLength) {
                _state = RESPONSE_WAIT_ACK;
                break;
            }
            if (sendingHead && headOffset == head.length()) {
                _state = RESPONSE_CONTENT;
                continue;
            }
            size_t available = sendingHead ? head.length() - headOffset : 0;
            const char* data = sendingHead ? head.c_str() + headOffset : contentAt(offset, available);
            const size_t amount = std::min(size_t(256),
                std::min(request->client()->space(), available));
            if (!amount) break;
            // Header and content remain immutable until queued bytes are ACKed.
            const size_t sent = request->client()->add(data, amount, 0);
            _writtenLength += sent;
            written += sent;
            if (sendingHead) headOffset += sent;
            else { _sentLength += sent; offset += sent; }
            if (sent) request->client()->send();
            if (sent < amount) {
                if (!writeBlocked) {
                    writeBlocked = true;
                    PULSE_ASYNC_TRACE("Hosted response partial write requested=%u sent=%u bodySent=%u total=%u heap=%u",
                        static_cast<unsigned>(amount), static_cast<unsigned>(sent),
                        static_cast<unsigned>(offset), static_cast<unsigned>(_contentLength), ESP.getFreeHeap());
                }
                break;
            }
            break;
        }
        if (_state == RESPONSE_WAIT_ACK && _ackedLength >= _writtenLength)
            _state = RESPONSE_END;
        return written;
    }
protected:
    virtual const char* contentAt(size_t position, size_t& available) const = 0;
    size_t offset = 0;
private:
    String head;
    size_t headOffset = 0;
    bool writeBlocked = false;
};

class HostedStatusResponse : public HostedBoundedResponse {
public:
    HostedStatusResponse(int code, std::string body) {
        _code = code;
        _contentType = "application/json";
        _contentLength = body.size();
        chunks.reserve((_contentLength + 255) / 256);
        for (size_t position = 0; position < _contentLength; position += 256)
            chunks.emplace_back(body, position, std::min(size_t(256), _contentLength - position));
    }
protected:
    const char* contentAt(size_t position, size_t& available) const override {
        const auto& chunk = chunks[position / 256];
        const size_t within = position % 256;
        available = chunk.size() - within;
        return chunk.data() + within;
    }
private:
    std::vector<std::string> chunks;
};

// Poll completion only on the web-server task. The worker never retains a
// request pointer or sends a response to a potentially disconnected client.
class HostedHttpResponse : public HostedBoundedResponse {
public:
    explicit HostedHttpResponse(std::shared_ptr<ServiceHost::HttpEvent> pending)
        : event(std::move(pending)), startedAt(millis()) {}
    ~HostedHttpResponse() override {
        PULSE_ASYNC_TRACE("HTTP response released event=%llu ready=%d begun=%d sent=%u elapsed=%lu",
            static_cast<unsigned long long>(event->order), event->ready.load(), begun,
            static_cast<unsigned>(offset), static_cast<unsigned long>(millis() - startedAt));
        event->abandoned.store(true);
    }
    bool _sourceValid() const override { return true; }
    void _respond(AsyncWebServerRequest* request) override { _ack(request, 0, 0); }
    size_t _ack(AsyncWebServerRequest* request, size_t length, uint32_t time) override {
        if (!begun) {
            if (event->ready.load()) {
                _code = event->status;
                _contentType = event->ok ? "application/json" : "text/plain";
                _contentLength = event->errorText ? strlen(event->errorText) : event->response.size();
            } else if (static_cast<uint32_t>(millis() - startedAt) >= 12000) {
                expired = true;
                event->abandoned.store(true);
                _code = 504; _contentType = "text/plain";
                _contentLength = strlen(timeoutText);
                Serial.println("[SERVICE-HOST] HTTP response deadline exceeded");
            } else {
                if (static_cast<uint32_t>(millis() - lastWaitTraceAt) >= 1000) {
                    lastWaitTraceAt = millis();
                    PULSE_ASYNC_TRACE("HTTP response waiting event=%llu submitted=%d elapsed=%lu",
                        static_cast<unsigned long long>(event->order), event->submitted.load(),
                        static_cast<unsigned long>(millis() - startedAt));
                }
                return 0;
            }
            begun = true;
            PULSE_ASYNC_TRACE("HTTP response begin event=%llu status=%d bytes=%u elapsed=%lu",
                static_cast<unsigned long long>(event->order), _code,
                static_cast<unsigned>(_contentLength), static_cast<unsigned long>(millis() - startedAt));
            HostedBoundedResponse::_respond(request);
            return 0;
        }
        return HostedBoundedResponse::_ack(request, length, time);
    }
protected:
    const char* contentAt(size_t position, size_t& available) const override {
        const char* text = expired ? timeoutText
            : (event->errorText ? event->errorText : event->response.data());
        available = _contentLength - position;
        return text + position;
    }
private:
    std::shared_ptr<ServiceHost::HttpEvent> event;
    uint32_t startedAt;
    uint32_t lastWaitTraceAt = 0;
    bool begun = false, expired = false;
    static constexpr const char* timeoutText =
        "Hosted response deadline exceeded; an already-started action may have completed";
};
}
#endif
