#pragma once

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace pulse::native {

class XmlRecordStream {
public:
    struct Event {
        std::string kind;
        std::string name;
        std::string namespaceUri;
        std::string path;
        std::string text;
        std::map<std::string, std::string> attributes;
    };

    XmlRecordStream(std::string xml, std::string recordPath, std::string headerPath,
        std::string expectedNamespace, std::set<std::string> allowedPaths)
        : xml_(std::move(xml)), recordPath_(std::move(recordPath)),
          headerPath_(std::move(headerPath)), expectedNamespace_(std::move(expectedNamespace)),
          allowedPaths_(std::move(allowedPaths)) {
        if (xml_.size() > 20000000) throw std::runtime_error("XML stream capacity exceeded");
        if (recordPath_.empty() || headerPath_.empty() || expectedNamespace_.empty()
            || allowedPaths_.find(recordPath_) == allowedPaths_.end()
            || allowedPaths_.find(headerPath_) == allowedPaths_.end()) {
            throw std::runtime_error("Invalid XML stream record configuration");
        }
        if (xml_.compare(0, 3, "\xef\xbb\xbf") == 0) {
            position_ = 3;
            locationOffset_ = position_;
        }
    }

    bool nextEvent(Event& event) {
        try {
            return nextEventImpl(event);
        } catch (const std::exception& error) {
            const std::string message = error.what();
            if (message.rfind("XML_DIAGNOSTIC|", 0) == 0) throw;
            const auto [line, position] = location();
            throw std::runtime_error("XML_DIAGNOSTIC|" + std::to_string(line) + "|"
                + std::to_string(position) + "|" + message);
        }
    }

    std::pair<size_t, size_t> location(size_t offset = std::string::npos) const {
        if (offset == std::string::npos) offset = position_;
        size_t index = 0;
        size_t line = 1;
        size_t position = 1;
        if (offset >= locationOffset_) {
            index = locationOffset_;
            line = locationLine_;
            position = locationColumn_;
        }
        for (; index < offset && index < xml_.size(); ++index) {
            const unsigned char value = static_cast<unsigned char>(xml_[index]);
            if (value == '\r') {
                ++line;
                position = 1;
            } else if (value == '\n') {
                if (index == 0 || xml_[index - 1] != '\r') ++line;
                position = 1;
            } else if ((value & 0xc0) != 0x80) {
                ++position;
            }
        }
        if (offset >= locationOffset_) {
            locationOffset_ = offset;
            locationLine_ = line;
            locationColumn_ = position;
        }
        return {line, position};
    }

    bool nextEventImpl(Event& event) {
        while (!finished_) {
            if (pendingEnd_) {
                pendingEnd_ = false;
                closeElement(event);
                return true;
            }
            if (position_ >= xml_.size()) {
                if (!stack_.empty()) fail("Unclosed element");
                if (rootCount_ != 1) fail("Document must have exactly one root element");
                finished_ = true;
                return false;
            }
            if (xml_[position_] != '<') {
                if (readText(event)) return true;
                continue;
            }
            if (startsWith("<!--")) {
                position_ += 4;
                const auto comment = readUntil("-->", "comment");
                if (comment.find("--") != std::string::npos) fail("Invalid comment");
                continue;
            }
            if (startsWith("<![CDATA[")) {
                position_ += 9;
                event = {};
                event.kind = "text";
                event.text = readUntil("]]>", "CDATA section");
                if (stack_.empty()) fail("CDATA outside root element");
                event.path = stack_.back().path;
                if (!event.text.empty()) return true;
                continue;
            }
            if (startsWith("<?")) {
                position_ += 2;
                readUntil("?>", "processing instruction");
                continue;
            }
            if (startsWith("<!")) {
                if (startsWith("<!DOCTYPE") || startsWith("<!doctype")
                    || startsWith("<!ENTITY") || startsWith("<!entity")) {
                    throw std::runtime_error("XML DTD and entity declarations are disabled");
                }
                fail("Unsupported declaration");
            }
            if (startsWith("</")) {
                position_ += 2;
                const auto name = readName();
                whitespace();
                expect('>');
                if (stack_.empty() || stack_.back().qName != name) fail("Mismatched closing element");
                closeElement(event);
                return true;
            }
            openElement(event);
            return true;
        }
        return false;
    }

    std::string nextEventJson() {
        Event event;
        if (!nextEvent(event)) return {};
        std::string json = "{\"kind\":" + quote(event.kind);
        if (event.kind == "start" || event.kind == "end") {
            json += ",\"name\":" + quote(event.name)
                + ",\"namespace\":" + quote(event.namespaceUri);
        }
        json += ",\"path\":" + quote(event.path);
        if (event.kind == "text") json += ",\"text\":" + quote(event.text);
        if (event.kind == "start") {
            json += ",\"attributes\":{";
            bool first = true;
            for (const auto& [name, value] : event.attributes) {
                if (!first) json += ',';
                first = false;
                json += quote(name) + ":" + quote(value);
            }
            json += '}';
        }
        return json + '}';
    }

    std::string nextRecordJson() {
        Event event;
        while (nextEvent(event)) {
            if (event.kind == "start") {
                if (event.namespaceUri != expectedNamespace_) xmlFail("Unexpected XML namespace");
                if (allowedPaths_.find(event.path) == allowedPaths_.end()) {
                    xmlFail("Element is not declared in the XML profile: " + event.path);
                }
                if (event.path == headerPath_) {
                    if (headerCaptured_) xmlFail("Duplicate XML group header");
                    capture_ = Capture{"header", headerPath_, {}, {}};
                } else if (event.path == recordPath_) {
                    if (capture_.active() || !headerCaptured_) {
                        xmlFail("Transaction record is out of sequence");
                    }
                    capture_ = Capture{"transaction", recordPath_, {}, {}};
                }
                if (capture_.active()) {
                    if (!capture_.frames.empty()) capture_.frames.back().hasChild = true;
                    auto relative = event.path == capture_.boundaryPath
                        ? std::string{} : event.path.substr(capture_.boundaryPath.size() + 1);
                    std::replace(relative.begin(), relative.end(), '/', '.');
                    CaptureFrame frame{event.path, relative, {}, false};
                    for (const auto& [name, value] : event.attributes) {
                        addValue(capture_.values, relative.empty() ? name : relative + "." + name, value);
                    }
                    capture_.frames.push_back(std::move(frame));
                }
            } else if (event.kind == "text" && capture_.active() && !capture_.frames.empty()) {
                capture_.frames.back().text += event.text;
            } else if (event.kind == "end" && capture_.active() && !capture_.frames.empty()) {
                auto frame = std::move(capture_.frames.back());
                capture_.frames.pop_back();
                if (!frame.hasChild && !frame.relativePath.empty()) {
                    addValue(capture_.values, frame.relativePath, frame.text);
                }
                if (event.path == capture_.boundaryPath) {
                    const auto mode = capture_.mode;
                    const auto values = std::move(capture_.values);
                    capture_ = {};
                    if (mode == "header") {
                        headerValues_ = values;
                        headerCaptured_ = true;
                    } else {
                        const auto [line, position] = location();
                        return "{\"headerValues\":" + valuesJson(headerValues_)
                            + ",\"transactionValues\":" + valuesJson(values)
                            + ",\"line\":\"" + std::to_string(line)
                            + "\",\"position\":\"" + std::to_string(position) + "\"}";
                    }
                }
            }
        }
        return {};
    }

    static std::string escapeText(const std::string& value) {
        std::string result;
        result.reserve(value.size());
        for (const char character : value) {
            switch (character) {
                case '&': result += "&amp;"; break;
                case '<': result += "&lt;"; break;
                case '>': result += "&gt;"; break;
                case '"': result += "&quot;"; break;
                case '\'': result += "&apos;"; break;
                default: result.push_back(character); break;
            }
        }
        return result;
    }

private:
    struct Frame {
        std::string qName;
        std::string localName;
        std::string namespaceUri;
        std::string path;
        std::map<std::string, std::string> namespaces;
    };
    struct CaptureFrame {
        std::string path;
        std::string relativePath;
        std::string text;
        bool hasChild;
    };
    struct Values {
        std::map<std::string, std::vector<std::string>> fields;
    };
    struct Capture {
        std::string mode;
        std::string boundaryPath;
        Values values;
        std::vector<CaptureFrame> frames;
        bool active() const { return !mode.empty(); }
    };

    std::string xml_;
    std::string recordPath_;
    std::string headerPath_;
    std::string expectedNamespace_;
    std::set<std::string> allowedPaths_;
    size_t position_ = 0;
    mutable size_t locationOffset_ = 0;
    mutable size_t locationLine_ = 1;
    mutable size_t locationColumn_ = 1;
    size_t nodeCount_ = 0;
    size_t rootCount_ = 0;
    bool pendingEnd_ = false;
    bool finished_ = false;
    bool headerCaptured_ = false;
    std::vector<Frame> stack_;
    Values headerValues_;
    Capture capture_;

    [[noreturn]] void fail(const std::string& message) const {
        const auto [line, position] = location();
        throw std::runtime_error("Invalid XML at line " + std::to_string(line)
            + ", position " + std::to_string(position) + ": " + message);
    }

    [[noreturn]] void xmlFail(const std::string& message) const {
        const auto [line, position] = location();
        throw std::runtime_error("XML_DIAGNOSTIC|" + std::to_string(line) + "|"
            + std::to_string(position) + "|" + message);
    }

    bool startsWith(const std::string& value) const {
        return xml_.compare(position_, value.size(), value) == 0;
    }

    void whitespace() {
        while (position_ < xml_.size()
            && (xml_[position_] == ' ' || xml_[position_] == '\t'
                || xml_[position_] == '\r' || xml_[position_] == '\n')) ++position_;
    }

    void expect(char value) {
        if (position_ >= xml_.size() || xml_[position_] != value) fail("Unexpected XML token");
        ++position_;
    }

    std::string readName() {
        const auto start = position_;
        if (position_ >= xml_.size()
            || !(std::isalpha(static_cast<unsigned char>(xml_[position_])) || xml_[position_] == '_')) {
            fail("Expected XML name");
        }
        ++position_;
        while (position_ < xml_.size()) {
            const unsigned char value = static_cast<unsigned char>(xml_[position_]);
            if (!(std::isalnum(value) || value == '_' || value == ':' || value == '-' || value == '.')) break;
            ++position_;
        }
        const auto name = xml_.substr(start, position_ - start);
        (void)splitName(name);
        return name;
    }

    static std::pair<std::string, std::string> splitName(const std::string& name) {
        const auto colon = name.find(':');
        if (colon == std::string::npos) return {"", name};
        if (colon == 0 || colon + 1 == name.size() || name.find(':', colon + 1) != std::string::npos) {
            throw std::runtime_error("Invalid XML qualified name: " + name);
        }
        return {name.substr(0, colon), name.substr(colon + 1)};
    }

    std::string readUntil(const std::string& terminator, const std::string& label) {
        const auto end = xml_.find(terminator, position_);
        if (end == std::string::npos) fail("Unterminated " + label);
        auto value = xml_.substr(position_, end - position_);
        position_ = end + terminator.size();
        return value;
    }

    static void appendUtf8(std::string& result, uint32_t codePoint) {
        if (codePoint == 0 || codePoint > 0x10ffff
            || (codePoint >= 0xd800 && codePoint <= 0xdfff)
            || (codePoint < 0x20 && codePoint != 9 && codePoint != 10 && codePoint != 13)
            || codePoint == 0xfffe || codePoint == 0xffff) {
            throw std::runtime_error("Invalid XML character reference");
        }
        if (codePoint <= 0x7f) result.push_back(static_cast<char>(codePoint));
        else if (codePoint <= 0x7ff) {
            result.push_back(static_cast<char>(0xc0 | (codePoint >> 6)));
            result.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
        } else if (codePoint <= 0xffff) {
            result.push_back(static_cast<char>(0xe0 | (codePoint >> 12)));
            result.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3f)));
            result.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
        } else {
            result.push_back(static_cast<char>(0xf0 | (codePoint >> 18)));
            result.push_back(static_cast<char>(0x80 | ((codePoint >> 12) & 0x3f)));
            result.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3f)));
            result.push_back(static_cast<char>(0x80 | (codePoint & 0x3f)));
        }
    }

    static std::string decodeEntities(const std::string& value) {
        std::string result;
        for (size_t index = 0; index < value.size();) {
            if (value[index] != '&') {
                result.push_back(value[index++]);
                continue;
            }
            const auto end = value.find(';', index + 1);
            if (end == std::string::npos) throw std::runtime_error("Unterminated XML entity");
            const auto entity = value.substr(index + 1, end - index - 1);
            if (entity == "amp") result.push_back('&');
            else if (entity == "lt") result.push_back('<');
            else if (entity == "gt") result.push_back('>');
            else if (entity == "quot") result.push_back('"');
            else if (entity == "apos") result.push_back('\'');
            else if (!entity.empty() && entity[0] == '#') {
                const bool hex = entity.size() > 1 && (entity[1] == 'x' || entity[1] == 'X');
                const auto digits = entity.substr(hex ? 2 : 1);
                if (digits.empty()) throw std::runtime_error("Invalid XML character reference");
                uint32_t codePoint = 0;
                for (const char digit : digits) {
                    unsigned int valueDigit;
                    if (digit >= '0' && digit <= '9') valueDigit = static_cast<unsigned int>(digit - '0');
                    else if (hex && digit >= 'a' && digit <= 'f') valueDigit = static_cast<unsigned int>(digit - 'a' + 10);
                    else if (hex && digit >= 'A' && digit <= 'F') valueDigit = static_cast<unsigned int>(digit - 'A' + 10);
                    else throw std::runtime_error("Invalid XML character reference");
                    const unsigned int base = hex ? 16 : 10;
                    if (codePoint > (0x10ffffu - valueDigit) / base) {
                        throw std::runtime_error("Invalid XML character reference");
                    }
                    codePoint = codePoint * base + valueDigit;
                }
                appendUtf8(result, codePoint);
            } else throw std::runtime_error("Unknown XML entity: &" + entity + ";");
            index = end + 1;
        }
        return result;
    }

    bool readText(Event& event) {
        const auto start = position_;
        while (position_ < xml_.size() && xml_[position_] != '<') ++position_;
        const auto raw = xml_.substr(start, position_ - start);
        if (raw.find("]]>") != std::string::npos) fail("CDATA terminator in text");
        const auto text = decodeEntities(raw);
        if (stack_.empty()) {
            if (std::any_of(text.begin(), text.end(), [](unsigned char value) {
                return value != ' ' && value != '\t' && value != '\r' && value != '\n';
            })) fail("Text outside root element");
            return false;
        }
        if (text.empty()) return false;
        event = {};
        event.kind = "text";
        event.path = stack_.back().path;
        event.text = text;
        return true;
    }

    void closeElement(Event& event) {
        if (stack_.empty()) fail("Unexpected closing element");
        const auto frame = std::move(stack_.back());
        stack_.pop_back();
        event = {};
        event.kind = "end";
        event.name = frame.localName;
        event.namespaceUri = frame.namespaceUri;
        event.path = frame.path;
    }

    void openElement(Event& event) {
        ++position_;
        const auto qName = readName();
        std::map<std::string, std::string> attributes;
        bool selfClosing = false;
        for (;;) {
            whitespace();
            if (startsWith("/>")) {
                position_ += 2;
                selfClosing = true;
                break;
            }
            if (startsWith(">")) {
                ++position_;
                break;
            }
            const auto name = readName();
            if (attributes.find(name) != attributes.end()) fail("Duplicate attribute " + name);
            whitespace();
            expect('=');
            whitespace();
            if (position_ >= xml_.size() || (xml_[position_] != '\'' && xml_[position_] != '"')) {
                fail("Expected quoted attribute value");
            }
            const char quote = xml_[position_++];
            const auto start = position_;
            while (position_ < xml_.size() && xml_[position_] != quote) {
                if (xml_[position_] == '<') fail("Less-than sign in attribute value");
                ++position_;
            }
            if (position_ >= xml_.size()) fail("Unterminated attribute value");
            attributes.emplace(name, decodeEntities(xml_.substr(start, position_ - start)));
            ++position_;
        }
        if (stack_.size() >= 64) throw std::runtime_error("XML depth capacity exceeded");
        if (++nodeCount_ > 250000) throw std::runtime_error("XML node capacity exceeded");
        if (stack_.empty() && ++rootCount_ > 1) fail("Document must have exactly one root element");

        auto namespaces = stack_.empty() ? std::map<std::string, std::string>{}
            : stack_.back().namespaces;
        namespaces["xml"] = "http://www.w3.org/XML/1998/namespace";
        for (const auto& [name, value] : attributes) {
            if (name == "xmlns") namespaces[""] = value;
            else if (name.rfind("xmlns:", 0) == 0) {
                const auto prefix = name.substr(6);
                if (prefix.empty() || prefix == "xmlns"
                    || (prefix == "xml" && value != "http://www.w3.org/XML/1998/namespace")
                    || (prefix != "xml" && value == "http://www.w3.org/XML/1998/namespace")
                    || value == "http://www.w3.org/2000/xmlns/") fail("Invalid namespace declaration");
                namespaces[prefix] = value;
            }
        }
        const auto nameParts = splitName(qName);
        const auto prefix = nameParts.first;
        if (!prefix.empty() && namespaces.find(prefix) == namespaces.end()) fail("Unbound namespace prefix");
        Frame frame;
        frame.qName = qName;
        frame.localName = nameParts.second;
        frame.namespaceUri = prefix.empty() ? (namespaces.count("") ? namespaces[""] : "") : namespaces[prefix];
        frame.path = (stack_.empty() ? "" : stack_.back().path) + "/" + frame.localName;
        frame.namespaces = std::move(namespaces);
        stack_.push_back(frame);

        event = {};
        event.kind = "start";
        event.name = frame.localName;
        event.namespaceUri = frame.namespaceUri;
        event.path = frame.path;
        for (const auto& [name, value] : attributes) {
            if (name == "xmlns" || name.rfind("xmlns:", 0) == 0) continue;
            const auto parts = splitName(name);
            if (!parts.first.empty() && frame.namespaces.find(parts.first) == frame.namespaces.end()) {
                fail("Unbound attribute namespace prefix");
            }
            event.attributes[parts.first.empty() ? parts.second : parts.first + ":" + parts.second] = value;
        }
        if (selfClosing) pendingEnd_ = true;
    }

    static std::string quote(const std::string& value) {
        std::string result = "\"";
        for (const unsigned char character : value) {
            switch (character) {
                case '"': result += "\\\""; break;
                case '\\': result += "\\\\"; break;
                case '\b': result += "\\b"; break;
                case '\f': result += "\\f"; break;
                case '\n': result += "\\n"; break;
                case '\r': result += "\\r"; break;
                case '\t': result += "\\t"; break;
                default:
                    if (character < 0x20) {
                        static constexpr char hex[] = "0123456789abcdef";
                        result += "\\u00";
                        result.push_back(hex[character >> 4]);
                        result.push_back(hex[character & 0x0f]);
                    } else result.push_back(static_cast<char>(character));
            }
        }
        return result + "\"";
    }

    static void addValue(Values& values, const std::string& key, const std::string& value) {
        if (key.empty()) return;
        values.fields[key].push_back(value);
    }

    static std::string valuesJson(const Values& values) {
        std::string result = "{";
        bool first = true;
        for (const auto& [key, items] : values.fields) {
            if (!first) result += ',';
            first = false;
            result += quote(key) + ":";
            if (items.size() == 1) result += quote(items.front());
            else {
                result += '[';
                for (size_t index = 0; index < items.size(); ++index) {
                    if (index) result += ',';
                    result += quote(items[index]);
                }
                result += ']';
            }
        }
        return result + '}';
    }
};

} // namespace pulse::native
