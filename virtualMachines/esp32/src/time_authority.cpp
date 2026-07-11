#include "time_authority.h"

#ifdef ENABLE_TIME_AUTHORITY

#include <time.h>
#include <vector>
#include <algorithm>
#include <ArduinoJson.h>

#if defined(ARDUINO_ARCH_ESP8266)
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#else
#include <HTTPClient.h>
#include <WiFi.h>
#endif

#ifndef TIME_AUTHORITY_NTP_SERVER_PRIMARY
#define TIME_AUTHORITY_NTP_SERVER_PRIMARY "pool.ntp.org"
#endif

#ifndef TIME_AUTHORITY_NTP_SERVER_SECONDARY
#define TIME_AUTHORITY_NTP_SERVER_SECONDARY "time.nist.gov"
#endif

#ifndef TIME_AUTHORITY_NTP_SERVER_TERTIARY
#define TIME_AUTHORITY_NTP_SERVER_TERTIARY "time.google.com"
#endif

#ifndef TIME_AUTHORITY_NTP_RESYNC_MS
#define TIME_AUTHORITY_NTP_RESYNC_MS 300000UL
#endif

#ifndef TIME_AUTHORITY_COOP_ENABLED
#define TIME_AUTHORITY_COOP_ENABLED 1
#endif

#ifndef TIME_AUTHORITY_COOP_POLL_MS
#define TIME_AUTHORITY_COOP_POLL_MS 15000UL
#endif

#ifndef TIME_AUTHORITY_PEERS
#define TIME_AUTHORITY_PEERS ""
#endif

namespace {

struct TimeAuthorityState {
    bool started = false;
    String nodeName;
    unsigned long lastNtpAttemptMs = 0;
    unsigned long long lastNtpSyncEpochMs = 0;
    unsigned long ntpOkCount = 0;
    unsigned long ntpFailCount = 0;
    String lastError;

    unsigned long lastPeerPollMs = 0;
    unsigned long lastPeerOkMs = 0;
    long cooperativeOffsetMs = 0;
    unsigned long coopOkCount = 0;
    unsigned long coopFailCount = 0;
    std::vector<String> peers;
};

TimeAuthorityState gTimeAuthority;

String trimToken(const String& input) {
    String token = input;
    token.trim();
    return token;
}

void parsePeersCsv(const String& csv, std::vector<String>& out) {
    out.clear();
    String normalized = csv;
    normalized.replace(';', ',');

    int start = 0;
    while (start < normalized.length()) {
        int comma = normalized.indexOf(',', start);
        if (comma < 0) comma = normalized.length();
        String token = trimToken(normalized.substring(start, comma));
        if (token.length() > 0) {
            out.push_back(token);
        }
        start = comma + 1;
    }
}

unsigned long long localEpochMs() {
    const time_t nowSec = time(nullptr);
    if (nowSec < 1700000000) {
        return 0;
    }
    return (static_cast<unsigned long long>(nowSec) * 1000ULL) + static_cast<unsigned long long>(millis() % 1000UL);
}

bool beginHttpClientForUrl(HTTPClient& http, const String& url) {
#if defined(ARDUINO_ARCH_ESP8266)
    static WiFiClient sharedClient;
    return http.begin(sharedClient, url);
#else
    return http.begin(url);
#endif
}

void maybeResyncNtp(const char* reason) {
    const unsigned long nowMs = millis();
    // Allow an immediate first attempt on boot/manual resync.
    // `lastNtpAttemptMs == 0` means "no attempt yet".
    if (gTimeAuthority.lastNtpAttemptMs != 0 &&
        (nowMs - gTimeAuthority.lastNtpAttemptMs) < TIME_AUTHORITY_NTP_RESYNC_MS) {
        return;
    }

    gTimeAuthority.lastNtpAttemptMs = nowMs;
    configTime(
        0,
        0,
        TIME_AUTHORITY_NTP_SERVER_PRIMARY,
        TIME_AUTHORITY_NTP_SERVER_SECONDARY,
        TIME_AUTHORITY_NTP_SERVER_TERTIARY
    );

    const unsigned long long epochNow = localEpochMs();
    if (epochNow > 0) {
        gTimeAuthority.lastNtpSyncEpochMs = epochNow;
        gTimeAuthority.ntpOkCount += 1;
        gTimeAuthority.lastError = "";
    } else {
        gTimeAuthority.ntpFailCount += 1;
        gTimeAuthority.lastError = String("ntp-unsynced:") + String(reason ? reason : "periodic");
    }
}

long medianOffset(const std::vector<long>& offsets) {
    if (offsets.empty()) return 0;
    std::vector<long> sorted = offsets;
    std::sort(sorted.begin(), sorted.end());
    const size_t mid = sorted.size() / 2;
    if ((sorted.size() % 2U) == 1U) {
        return sorted[mid];
    }
    const long a = sorted[mid - 1];
    const long b = sorted[mid];
    return static_cast<long>((a + b) / 2L);
}

String normalizeAuthorityUrl(const String& baseUrl) {
    String url = trimToken(baseUrl);
    if (url.length() == 0) return "";
    while (url.endsWith("/")) {
        url.remove(url.length() - 1);
    }
    return url + "/time/authority";
}

void maybePollPeerAuthorities() {
#if TIME_AUTHORITY_COOP_ENABLED
    if (gTimeAuthority.peers.empty()) return;
    if (WiFi.status() != WL_CONNECTED) return;

    const unsigned long nowMs = millis();
    if ((nowMs - gTimeAuthority.lastPeerPollMs) < TIME_AUTHORITY_COOP_POLL_MS) {
        return;
    }
    gTimeAuthority.lastPeerPollMs = nowMs;

    const unsigned long long localNow = localEpochMs();
    if (localNow == 0) {
        gTimeAuthority.coopFailCount += 1;
        return;
    }

    std::vector<long> offsets;
    for (const String& peerBase : gTimeAuthority.peers) {
        const String url = normalizeAuthorityUrl(peerBase);
        if (url.length() == 0) continue;

        HTTPClient http;
        if (!beginHttpClientForUrl(http, url)) {
            continue;
        }

        http.setTimeout(2500);
        const int code = http.GET();
        if (code < 200 || code >= 300) {
            http.end();
            continue;
        }

        const String body = http.getString();
        http.end();

        JsonDocument doc;
        if (deserializeJson(doc, body)) {
            continue;
        }

        unsigned long long peerNowMs = 0;
        if (doc["nowMs"].is<unsigned long long>()) {
            peerNowMs = doc["nowMs"].as<unsigned long long>();
        } else if (doc["time"]["nowMs"].is<unsigned long long>()) {
            peerNowMs = doc["time"]["nowMs"].as<unsigned long long>();
        }

        if (peerNowMs == 0) continue;
        offsets.push_back(static_cast<long>(peerNowMs - localNow));
    }

    if (!offsets.empty()) {
        gTimeAuthority.cooperativeOffsetMs = medianOffset(offsets);
        gTimeAuthority.lastPeerOkMs = nowMs;
        gTimeAuthority.coopOkCount += 1;
        gTimeAuthority.lastError = "";
    } else {
        gTimeAuthority.coopFailCount += 1;
        gTimeAuthority.lastError = "coop-peer-poll-failed";
    }
#endif
}

} // namespace

void timeAuthorityBegin(const String& nodeName) {
    gTimeAuthority.nodeName = nodeName;
    parsePeersCsv(String(TIME_AUTHORITY_PEERS), gTimeAuthority.peers);

    configTime(
        0,
        0,
        TIME_AUTHORITY_NTP_SERVER_PRIMARY,
        TIME_AUTHORITY_NTP_SERVER_SECONDARY,
        TIME_AUTHORITY_NTP_SERVER_TERTIARY
    );

    gTimeAuthority.started = true;
    gTimeAuthority.lastNtpAttemptMs = 0;
    maybeResyncNtp("boot");
}

void timeAuthorityLoop() {
    if (!gTimeAuthority.started) return;
    maybeResyncNtp("loop");
    maybePollPeerAuthorities();
}

bool timeAuthorityForceResync(const char* reason) {
    if (!gTimeAuthority.started) return false;
    gTimeAuthority.lastNtpAttemptMs = 0;
    maybeResyncNtp(reason ? reason : "manual");
    return gTimeAuthority.lastNtpSyncEpochMs > 0;
}

unsigned long long timeAuthorityNowMs() {
    const unsigned long long base = localEpochMs();
    if (base == 0) return 0;
#if TIME_AUTHORITY_COOP_ENABLED
    const long coopOffset = gTimeAuthority.cooperativeOffsetMs;
    return static_cast<unsigned long long>(static_cast<long long>(base) + static_cast<long long>(coopOffset));
#else
    return base;
#endif
}

String timeAuthorityBuildStatusJson() {
    JsonDocument doc;
    doc["enabled"] = true;
    doc["started"] = gTimeAuthority.started;
    doc["nodeName"] = gTimeAuthority.nodeName;
    doc["source"] = "ntp";
    doc["nowMs"] = timeAuthorityNowMs();
    doc["localNowMs"] = localEpochMs();
    doc["cooperativeOffsetMs"] = gTimeAuthority.cooperativeOffsetMs;
    doc["lastNtpSyncEpochMs"] = gTimeAuthority.lastNtpSyncEpochMs;
    doc["ntp"] ["primaryServer"] = TIME_AUTHORITY_NTP_SERVER_PRIMARY;
    doc["ntp"] ["secondaryServer"] = TIME_AUTHORITY_NTP_SERVER_SECONDARY;
    doc["ntp"] ["tertiaryServer"] = TIME_AUTHORITY_NTP_SERVER_TERTIARY;
    doc["ntp"] ["okCount"] = gTimeAuthority.ntpOkCount;
    doc["ntp"] ["failCount"] = gTimeAuthority.ntpFailCount;
    doc["cooperation"] ["enabled"] = (TIME_AUTHORITY_COOP_ENABLED != 0);
    doc["cooperation"] ["peerCount"] = static_cast<unsigned long>(gTimeAuthority.peers.size());
    doc["cooperation"] ["okCount"] = gTimeAuthority.coopOkCount;
    doc["cooperation"] ["failCount"] = gTimeAuthority.coopFailCount;
    doc["cooperation"] ["lastPeerOkMs"] = gTimeAuthority.lastPeerOkMs;
    doc["lastError"] = gTimeAuthority.lastError;

    String out;
    serializeJson(doc, out);
    return out;
}

#else

void timeAuthorityBegin(const String& nodeName) {
    (void)nodeName;
}

void timeAuthorityLoop() {
}

bool timeAuthorityForceResync(const char* reason) {
    (void)reason;
    return false;
}

unsigned long long timeAuthorityNowMs() {
    return 0;
}

String timeAuthorityBuildStatusJson() {
    return "{\"enabled\":false}";
}

#endif
