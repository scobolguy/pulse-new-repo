#pragma once
#include <ArduinoJson.h>
#include <FS.h>
#include <LittleFS.h>
#include <functional>

namespace ConfigJson {

// Macro to declare fields for each struct



// For each config struct, define:
// template <typename F>
// void forEachField(YourStruct& obj, F&& f) {
//     f("field1", obj.field1);
//     f("field2", obj.field2);
//     ...
// }



// Generic serialize to JsonDocument
// Handles String, int, bool, double
// Extend as needed for other types
    
template<typename T>
void serializeConfig(const T& obj, JsonDocument& doc) {
    forEachField(const_cast<T&>(obj), [&](const char* name, auto& value) {
        if constexpr (std::is_same<decltype(value), String&>::value) {
            doc[name] = value;
        } else if constexpr (std::is_same<decltype(value), int&>::value) {
            doc[name] = value;
        } else if constexpr (std::is_same<decltype(value), bool&>::value) {
            doc[name] = value;
        } else if constexpr (std::is_same<decltype(value), double&>::value) {
            doc[name] = value;
        } else {
            doc[name] = value;
        }
    });
}

template<typename T>
void deserializeConfig(T& obj, const JsonDocument& doc) {
    forEachField(obj, [&](const char* name, auto& value) {
        if (doc.containsKey(name)) {
            if constexpr (std::is_same<decltype(value), String&>::value) {
                value = doc[name].as<String>();
            } else if constexpr (std::is_same<decltype(value), int&>::value) {
                value = doc[name].as<int>();
            } else if constexpr (std::is_same<decltype(value), bool&>::value) {
                value = doc[name].as<bool>();
            } else if constexpr (std::is_same<decltype(value), double&>::value) {
                value = doc[name].as<double>();
            } else {
                value = doc[name];
            }
        }
    });
}

// Save config struct to a file (any FS)
template<typename T>
bool saveToFile(const T& obj, const char* path, fs::FS& fs = LittleFS) {
    File f = fs.open(path, "w");
    if (!f) return false;
    StaticJsonDocument<256> doc;
    serializeConfig(obj, doc);
    serializeJson(doc, f);
    f.close();
    return true;
}

// Load config struct from a file (any FS)
template<typename T>
bool loadFromFile(T& obj, const char* path, fs::FS& fs = LittleFS) {
    File f = fs.open(path, "r");
    if (!f) return false;
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, f);
    if (err) { f.close(); return false; }
    deserializeConfig(obj, doc);
    f.close();
    return true;
}

} // namespace ConfigJson
