#ifdef ARDUINO
// Supported field types
enum class FieldType {
    StringType,
    IntType,
    BoolType,
    DoubleType
};

// Field descriptor for schema-driven config
struct FieldDescriptor {
    const char* name;
    FieldType type;
    size_t offset;
};
#endif
#pragma once
#include <ArduinoJson.h>
#include <type_traits>
/*
    JsonDocument doc;
    serializeWithSchema(obj, schema, fieldCount, doc);
    serializeJson(doc, f);
    f.close();
    return true;
}
*/
template<typename T>
bool loadConfigFromFile(T& obj, const FieldDescriptor* schema, size_t fieldCount, const char* path) {
    /*File f = fs.open(path, "r");
    if (!f) return false;
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    if (err) { f.close(); return false; }
    deserializeWithSchema(obj, schema, fieldCount, doc);
    f.close();
    */
    return true;
}

struct WifiConfig {
    String ssid = "";
    String password = "";
    static const FieldDescriptor schema[2];
    static constexpr size_t schemaSize = 2;
};

#pragma once
#include <ArduinoJson.h>
#include <type_traits>
#include <cstring>
#include <FS.h>
#include <LittleFS.h>



// Helper to get offset of member
#define FIELD_OFFSET(type, member) (size_t)(&(((type*)0)->member))
// Macro to define schema for a struct
#define CONFIG_SCHEMA(type, ...) \
    static constexpr FieldDescriptor schema[] = { __VA_ARGS__ };

// Macro to define a field in schema
#define FIELD_DESC(type, member, ftype) { #member, ftype, FIELD_OFFSET(type, member) }

// Serialize using schema


   /* template<typename T>
void serializeWithSchema(const T& obj, const FieldDescriptor* schema, size_t fieldCount, JsonDocument& doc) {
    for (size_t i = 0; i < fieldCount; ++i) {
        const FieldDescriptor& desc = schema[i];
        const void* ptr = (const void*)(((const uint8_t*)&obj) + desc.offset);
        switch (desc.type) {
            case FieldType::StringType:
                doc[desc.name] = *(const String*)ptr;
                break;
            case FieldType::IntType:
                doc[desc.name] = *(const int*)ptr;
                break;
            case FieldType::BoolType:
                doc[desc.name] = *(const bool*)ptr;
                break;
            case FieldType::DoubleType:
                doc[desc.name] = *(const double*)ptr;
                break;
        }
    }
}


template<typename T>
void deserializeWithSchema(T& obj, const FieldDescriptor* schema, size_t fieldCount, const JsonDocument& doc) {
    for (size_t i = 0; i < fieldCount; ++i) {
        const FieldDescriptor& desc = schema[i];
        void* ptr = ((uint8_t*)&obj) + desc.offset;
        if (!doc.containsKey(desc.name)) continue;
        switch (desc.type) {
            case FieldType::StringType:
                *(String*)ptr = doc[desc.name].as<String>();
                break;
            case FieldType::IntType:
                *(int*)ptr = doc[desc.name].as<int>();
                break;
            case FieldType::BoolType:
                *(bool*)ptr = doc[desc.name].as<bool>();
                break;
            case FieldType::DoubleType:
                *(double*)ptr = doc[desc.name].as<double>();
                break;
        }
    }
}
*/
// Helper functions for file I/O using schema
/*template<typename T>
bool saveConfigToFile(const T& obj, const FieldDescriptor* schema, size_t fieldCount, const char* path, fs::FS& fs = LittleFS) {
    File f = fs.open(path, "w");
    if (!f) return false;
    JsonDocument doc;
    serializeWithSchema(obj, schema, fieldCount, doc);
    serializeJson(doc, f);
    f.close();
    return true;
}
*/
/*template<typename T>
bool loadConfigFromFile(T& obj, const FieldDescriptor* schema, size_t fieldCount, const char* path, fs::FS& fs = LittleFS) {
    File f = fs.open(path, "r");
    if (!f) return false;
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, f);
    if (err) { f.close(); return false; }
    deserializeWithSchema(obj, schema, fieldCount, doc);
    f.close();
    return true;
}
    */
