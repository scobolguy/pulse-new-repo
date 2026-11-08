#pragma once
#include <ArduinoJson.h>
#include <algorithm>
#include <cctype>
#include <cstdio>
#include <sstream>
#include <string>

namespace pulse::swift::native {
inline std::string trimCopy(const std::string& raw) {
    const auto first = raw.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    return raw.substr(first, raw.find_last_not_of(" \t\r\n") - first + 1);
}
inline std::string toUpperCopy(std::string value) {
    for (char& ch : value) ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
    return value;
}

inline std::string normalizeMtAmount(const std::string& raw) {
    std::string s = trimCopy(raw);
    s.erase(std::remove(s.begin(), s.end(), ' '), s.end());
    std::replace(s.begin(), s.end(), ',', '.');
    return s;
}

inline std::string mapOpYymmddToIso(const std::string& raw) {
    const std::string s = trimCopy(raw);
    if (s.size() != 6) return s;
    const int yy = std::stoi(s.substr(0, 2));
    const int mm = std::stoi(s.substr(2, 2));
    const int dd = std::stoi(s.substr(4, 2));
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return s;
    char out[11];
    snprintf(out, sizeof(out), "%04d-%02d-%02d", (yy >= 70 ? 1900 + yy : 2000 + yy), mm, dd);
    return std::string(out);
}

inline std::string mapOpMtPartyName(const std::string& raw) {
    const std::string s = trimCopy(raw);
    const size_t nl = s.find('\n');
    if (nl == std::string::npos) return s;
    const std::string first = trimCopy(s.substr(0, nl));
    if (!first.empty() && first[0] == '/') return trimCopy(s.substr(nl + 1));
    return s;
}

inline std::string mapOpMtChargeToIso(const std::string& raw) {
    const std::string s = toUpperCopy(trimCopy(raw));
    if (s == "OUR" || s == "SHA" || s == "BEN") return s;
    return trimCopy(raw);
}

inline bool isMT103FinText(const std::string& text) {
    // Detect :TAG: at start of any line, or FIN block delimiters
    if (text.rfind("{1:", 0) == 0 || text.rfind("{2:", 0) == 0 || text.rfind("{4:", 0) == 0) return true;
    for (size_t i = 0; i < text.size(); i += 1) {
        if (text[i] != ':') continue;
        if (i == 0 || text[i - 1] == '\n' || text[i - 1] == '\r') {
            // Check if followed by 1-3 alnum chars then ':'
            size_t j = i + 1;
            size_t count = 0;
            while (j < text.size() && (isalnum((unsigned char)text[j])) && count < 4) {
                j += 1;
                count += 1;
            }
            if (count >= 1 && count <= 3 && j < text.size() && text[j] == ':') return true;
        }
    }
    return false;
}

inline void parseMT103FinText(const std::string& text, JsonDocument& result) {
    result.to<JsonObject>();
    JsonObject block4 = result["block4"].to<JsonObject>();

    // Extract block 4 content if wrapped in FIN block delimiters
    std::string block4Text = text;
    const size_t b4Start = text.find("{4:");
    if (b4Start != std::string::npos) {
        const size_t b4End = text.find("-}", b4Start);
        block4Text = (b4End != std::string::npos)
            ? text.substr(b4Start + 3, b4End - b4Start - 3)
            : text.substr(b4Start + 3);
    }

    // Parse tag:value pairs, tags start at line beginning with :XX:
    std::string currentTag;
    std::string currentValue;

    auto flushField = [&]() {
        if (currentTag.empty()) return;
        const std::string val = trimCopy(currentValue);
        if (currentTag == "32A" && val.size() >= 10) {
            // YYMMDD + 3-char currency + amount
            JsonObject f32a = block4["32A"].to<JsonObject>();
            f32a["raw"] = val;
            f32a["date"] = val.substr(0, 6);
            f32a["currency"] = val.substr(6, 3);
            f32a["amount"] = val.size() > 9 ? trimCopy(val.substr(9)) : "";
        } else {
            block4[currentTag.c_str()] = val;
        }
        currentTag.clear();
        currentValue.clear();
    };

    std::istringstream ss(block4Text);
    std::string line;
    while (std::getline(ss, line)) {
        // Strip trailing CR
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.size() >= 3 && line[0] == ':') {
            // Find closing ':' for tag
            const size_t tagEnd = line.find(':', 1);
            if (tagEnd != std::string::npos && tagEnd >= 2 && tagEnd <= 4) {
                flushField();
                currentTag = line.substr(1, tagEnd - 1);
                currentValue = line.substr(tagEnd + 1);
                continue;
            }
        }
        if (!currentTag.empty()) {
            currentValue += '\n';
            currentValue += line;
        }
    }
    flushField();
}
}
