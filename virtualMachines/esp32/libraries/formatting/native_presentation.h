#pragma once
#include "../../pmachines/arduino/src/scalar_runtime.h"
#include <algorithm>
#include <cstdio>

namespace pulse::formatting {
using pmachine::rtl::detail::Decimal;
using pmachine::rtl::detail::rescaleDecimal;

inline std::string padStart(const std::string& text, size_t width, char fill) {
    return text.size() >= width ? text : std::string(width - text.size(), fill) + text;
}

inline std::string formatRealE6(float value) {
    char buffer[48];
    std::snprintf(buffer, sizeof(buffer), "%.6E", static_cast<double>(value));
    return buffer;
}

inline std::string formatRealE16(double value) {
    char buffer[48];
    std::snprintf(buffer, sizeof(buffer), "%.16E", value);
    return buffer;
}

inline std::string formatCobolDisplay(const Decimal& value, int precision, int scale, int signMode) {
    const Decimal decimal = rescaleDecimal(value, scale, false);
    const std::string digits = padStart(decimal.magnitude, static_cast<size_t>(std::max(0, precision)), '0');
    if (signMode == 1) return std::string(decimal.negative ? "-" : "+") + digits;
    if (signMode == 2) return digits + (decimal.negative ? "-" : "+");
    return std::string(decimal.negative ? "-" : "") + digits;
}

inline std::string formatCobolEdited(const Decimal& value, const std::string& mask, bool decimalComma, bool blankWhenZero) {
    const int length = static_cast<int>(mask.size());
    auto isDigitMarker = [](char c) { return c == '9' || c == 'Z' || c == '*'; };
    const size_t decimalFound = mask.rfind(decimalComma ? ',' : '.');
    const int decimalAt = decimalFound == std::string::npos ? -1 : static_cast<int>(decimalFound);
    int scale = 0;
    if (decimalAt >= 0) {
        for (int i = decimalAt + 1; i < length; ++i) if (isDigitMarker(mask[i])) ++scale;
    }
    const int integerEnd = decimalAt < 0 ? length : decimalAt;
    int lastRequiredDigit = -1;
    if (length > 0) {
        for (int i = std::min(std::max(integerEnd - 1, 0), length - 1); i >= 0; --i) {
            if (mask[i] == '9') {
                lastRequiredDigit = i;
                break;
            }
        }
    }
    auto isFloating = [&](char c) {
        if (c != '$' && c != '+' && c != '-') return false;
        int occurrences = 0;
        for (int i = 0; i < integerEnd; ++i) if (mask[i] == c) ++occurrences;
        return occurrences > 1;
    };
    std::vector<int> integerPositions;
    for (int i = 0; i < integerEnd; ++i) {
        if (isDigitMarker(mask[i]) || (isFloating(mask[i]) && i < lastRequiredDigit)) integerPositions.push_back(i);
    }
    std::vector<int> fractionPositions;
    if (decimalAt >= 0) {
        for (int i = decimalAt + 1; i < length; ++i) if (isDigitMarker(mask[i])) fractionPositions.push_back(i);
    }
    const Decimal decimal = rescaleDecimal(value, scale, false);
    const bool negative = decimal.negative;
    const size_t integerCount = integerPositions.size();
    const std::string absolute = padStart(decimal.magnitude, integerCount + static_cast<size_t>(scale), '0');
    const size_t cut = absolute.size() - static_cast<size_t>(scale);
    const std::string integerDigits = padStart(cut == 0 ? absolute : absolute.substr(0, cut), integerCount, '0');
    const std::string fractionDigits = scale ? absolute.substr(absolute.size() - scale) : "";
    const bool isZero = decimal.magnitude == "0";
    if (blankWhenZero && isZero) return std::string(mask.size(), ' ');

    std::string output = mask;
    bool significant = false;
    for (size_t slot = 0; slot < integerCount; ++slot) {
        const int position = integerPositions[slot];
        const char digit = slot < integerDigits.size() ? integerDigits[slot] : '0';
        const char marker = mask[position];
        if (digit != '0') significant = true;
        output[position] = (marker == '9' || significant) ? digit : (marker == '*' ? '*' : ' ');
    }
    for (size_t index = 0; index < fractionPositions.size(); ++index) {
        const int position = fractionPositions[index];
        const char marker = mask[position];
        const char digit = index < fractionDigits.size() ? fractionDigits[index] : '0';
        output[position] = (marker == 'Z' && digit == '0') ? ' ' : ((marker == '*' && isZero) ? '*' : digit);
    }

    int firstPosition = length;
    {
        int firstDigit = -1;
        for (size_t index = 0; index < integerCount; ++index) {
            if (index >= integerDigits.size() || integerDigits[index] != '0') {
                firstDigit = static_cast<int>(index);
                break;
            }
        }
        if (firstDigit >= 0) firstPosition = integerPositions[firstDigit];
        else if (integerCount > 0) firstPosition = integerPositions.back();
    }
    std::vector<int> currencies;
    std::vector<int> signs;
    const bool maskHasStar = mask.find('*') != std::string::npos;
    const char separator = decimalComma ? '.' : ',';
    for (int position = 0; position < length; ++position) {
        if (mask[position] == '$') currencies.push_back(position);
        if (mask[position] == '+' || mask[position] == '-') signs.push_back(position);
        if (mask[position] == separator) {
            bool anySignificant = false;
            for (int index : integerPositions) {
                if (index < position && output[index] >= '1' && output[index] <= '9') anySignificant = true;
            }
            if (!anySignificant) output[position] = ' ';
        }
        if (position == decimalAt && isZero && !maskHasStar) output[position] = ' ';
    }
    for (int position = 0; position < length; ++position) {
        if (mask[position] == 'B') output[position] = ' ';
    }
    for (int pass = 0; pass < 2; ++pass) {
        const std::vector<int>& positions = pass == 0 ? currencies : signs;
        std::vector<int> floating;
        for (int position : positions) if (position < firstPosition) floating.push_back(position);
        if (!floating.empty()) {
            for (int position : floating) output[position] = ' ';
            output[floating.back()] = pass == 0 ? '$' : (negative ? '-' : ' ');
        }
    }
    for (const char* marker : {"CR", "DB"}) {
        const size_t position = mask.rfind(marker);
        if (position != std::string::npos) {
            output[position] = negative ? marker[0] : ' ';
            output[position + 1] = negative ? marker[1] : ' ';
        }
    }
    for (int position : signs) {
        if (position >= firstPosition) {
            output[position] = mask[position] == '+' ? (negative ? '-' : '+') : (negative ? '-' : ' ');
        }
    }
    return output;
}
}
