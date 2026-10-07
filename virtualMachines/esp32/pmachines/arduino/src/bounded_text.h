#pragma once
#include <string>
#include <cstring>

namespace pmachine {
inline char asciiLower(char ch) { return ch >= 'A' && ch <= 'Z' ? ch + ('a' - 'A') : ch; }
inline bool headerText(const std::string& input, const std::string& requested,
                       std::string& output, std::string& error) {
    if (input.empty() || input.size() > 1024 || requested.size() > 64) {
        error = "Invalid header text bounds"; return false;
    }
    output.clear();
    size_t start = 0, lines = 0;
    bool found = false;
    while (start < input.size()) {
        const size_t end = input.find("\r\n", start);
        if (end == std::string::npos || end - start > 256 || ++lines > 32) {
            error = "Invalid header line framing or bounds"; return false;
        }
        for (size_t index = start; index < end; ++index)
            if ((static_cast<unsigned char>(input[index]) < 32 && input[index] != '\t') ||
                static_cast<unsigned char>(input[index]) > 126) {
                error = "Invalid header character"; return false;
            }
        if (lines == 1) {
            if (end == start) { error = "Missing header start line"; return false; }
            if (requested.empty()) output.assign(input, start, end - start);
        } else if (end == start) {
            if (end + 2 != input.size()) { error = "Unexpected header body"; return false; }
            return true;
        } else {
            const size_t colon = input.find(':', start);
            if (colon == std::string::npos || colon == start || colon >= end || colon - start > 64) {
                error = "Invalid header name"; return false;
            }
            bool matches = colon - start == requested.size();
            for (size_t index = start; index < colon; ++index) {
                const char ch = input[index];
                if (!((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
                      (ch >= '0' && ch <= '9') || std::strchr("!#$%&'*+-.^_`|~", ch))) {
                    error = "Invalid header name"; return false;
                }
                if (matches && asciiLower(ch) != asciiLower(requested[index - start])) matches = false;
            }
            if (matches) {
                if (found) { error = "Duplicate header"; return false; }
                found = true;
                size_t first = colon + 1, last = end;
                while (first < last && (input[first] == ' ' || input[first] == '\t')) ++first;
                while (last > first && (input[last - 1] == ' ' || input[last - 1] == '\t')) --last;
                output.assign(input, first, last - first);
            }
        }
        start = end + 2;
    }
    error = "Missing header terminator"; return false;
}
}
