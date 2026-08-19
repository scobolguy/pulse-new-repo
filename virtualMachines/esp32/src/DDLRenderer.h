#ifndef DDL_RENDERER_H
#define DDL_RENDERER_H

#if defined(ENABLE_DISPLAY) && !defined(DISPLAY_NO_LVGL)

#include <Arduino.h>
#include <ArduinoJson.h>
#include <lvgl.h>
#include <map>
#include <functional>

// Forward declarations
class DDLWidget;
class DDLCard;

// Widget update callback type
typedef std::function<void(const String& key, JsonVariant value)> RegistryCallback;

// Action handler callback type
typedef std::function<void(const String& action)> ActionCallback;

/**
 * DDLRenderer - Pulse DDL rendering engine for CYD/ESP32 using LVGL
 * 
 * Responsibilities:
 * - Parse DDL JSON definitions
 * - Create LVGL widgets from DDL
 * - Bind widgets to registry keys
 * - Handle touch actions
 * - Update UI on registry changes
 */
class DDLRenderer {
public:
    DDLRenderer();
    ~DDLRenderer();
    
    // Initialization
    bool begin(lv_disp_t* display);
    void end();
    
    // DDL parsing and rendering
    bool loadDDL(const String& ddlPath);
    bool parseDDL(const String& ddlJson);
    void render();
    void clear();
    
    // Registry integration
    void setRegistryCallback(RegistryCallback callback);
    void onRegistryUpdate(const String& key, JsonVariant value);
    
    // Action handling
    void setActionCallback(ActionCallback callback);
    void handleAction(const String& action);
    
    // Widget management
    lv_obj_t* getWidget(const String& widgetId);
    void updateWidget(const String& widgetId, JsonVariant value);
    void updateTextWidget(const String& widgetId, const String& text);
    
    // Layout management
    lv_obj_t* getScreen() { return screen; }
    
private:
    // LVGL objects
    lv_disp_t* display;
    lv_obj_t* screen;
    lv_obj_t* container;
    
    // DDL document
    JsonDocument ddlDoc;
    bool initialized;
    
    // Widget registry
    std::map<String, lv_obj_t*> widgets;
    std::map<String, String> widgetBindings;  // widgetId -> registry key
    std::map<String, String> widgetActions;   // widgetId -> action string
    
    // Callbacks
    RegistryCallback registryCallback;
    ActionCallback actionCallback;
    
    // Rendering methods
    void renderLayout(JsonObject layout);
    void renderCard(JsonObject card, lv_obj_t* parent);
    void renderContent(JsonArray content, lv_obj_t* parent);
    
    // Widget factory methods
    lv_obj_t* createTextWidget(JsonObject widget, lv_obj_t* parent);
    lv_obj_t* createButtonWidget(JsonObject widget, lv_obj_t* parent);
    lv_obj_t* createSwitchWidget(JsonObject widget, lv_obj_t* parent);
    lv_obj_t* createImageWidget(JsonObject widget, lv_obj_t* parent);
    lv_obj_t* createChartWidget(JsonObject widget, lv_obj_t* parent);
    
    // Layout helpers
    lv_obj_t* createColumn(lv_obj_t* parent);
    lv_obj_t* createRow(lv_obj_t* parent);
    lv_obj_t* createCard(lv_obj_t* parent);
    
    // Event handlers
    static void buttonEventHandler(lv_event_t* e);
    static void switchEventHandler(lv_event_t* e);
    
    // Helper methods
    void registerWidget(const String& id, lv_obj_t* obj);
    void bindWidget(const String& id, const String& registryKey);
    void setWidgetAction(const String& id, const String& action);
    String getWidgetId(JsonObject widget);
    String getWidgetBind(JsonObject widget);
    String getWidgetAction(JsonObject widget);
};

// Global instance
extern DDLRenderer ddlRenderer;

#endif // ENABLE_DISPLAY && !DISPLAY_NO_LVGL
#endif // DDL_RENDERER_H

// Made with Bob
