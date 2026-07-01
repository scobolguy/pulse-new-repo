#include "serial_compat.h"
#if defined(ENABLE_DISPLAY) && !defined(DISPLAY_NO_LVGL)


#include "DDLRenderer.h"
#include <LittleFS.h>

// Global instance
DDLRenderer ddlRenderer;

DDLRenderer::DDLRenderer() 
    : display(nullptr), screen(nullptr), container(nullptr), 
      initialized(false), registryCallback(nullptr), actionCallback(nullptr) {
}

DDLRenderer::~DDLRenderer() {
    end();
}

bool DDLRenderer::begin(lv_disp_t* disp) {
    if (initialized) {
        SERIAL_PRINTLN("[DDLRenderer] Already initialized");
        return true;
    }
    
    if (!disp) {
        SERIAL_PRINTLN("[DDLRenderer] ERROR: Display is null");
        return false;
    }
    
    display = disp;
    
    // Create main screen
    screen = lv_obj_create(NULL);
    lv_scr_load(screen);
    
    // Create container for DDL content
    container = lv_obj_create(screen);
    lv_obj_set_size(container, LV_HOR_RES, LV_VER_RES);
    lv_obj_set_pos(container, 0, 0);
    lv_obj_set_style_pad_all(container, 0, 0);
    lv_obj_clear_flag(container, LV_OBJ_FLAG_SCROLLABLE);
    
    initialized = true;
    SERIAL_PRINTLN("[DDLRenderer] Initialized successfully");
    return true;
}

void DDLRenderer::end() {
    if (!initialized) return;
    
    clear();
    
    if (container) {
        lv_obj_del(container);
        container = nullptr;
    }
    
    if (screen) {
        lv_obj_del(screen);
        screen = nullptr;
    }
    
    widgets.clear();
    widgetBindings.clear();
    widgetActions.clear();
    
    initialized = false;
    SERIAL_PRINTLN("[DDLRenderer] Shutdown complete");
}

bool DDLRenderer::loadDDL(const String& ddlPath) {
    SERIAL_PRINTF("[DDLRenderer] Loading DDL from: %s\n", ddlPath.c_str());

    if (!LittleFS.exists(ddlPath)) {
        SERIAL_PRINTF("[DDLRenderer] ERROR: DDL file not found: %s\n", ddlPath.c_str());
        return false;
    }

    File file = LittleFS.open(ddlPath, "r");
    if (!file) {
        SERIAL_PRINTF("[DDLRenderer] ERROR: Failed to open DDL file: %s\n", ddlPath.c_str());
        return false;
    }
    
    String ddlJson = file.readString();
    file.close();
    
    return parseDDL(ddlJson);
}

bool DDLRenderer::parseDDL(const String& ddlJson) {
    SERIAL_PRINTLN("[DDLRenderer] Parsing DDL JSON...");

    DeserializationError error = deserializeJson(ddlDoc, ddlJson);
    if (error) {
        SERIAL_PRINTF("[DDLRenderer] ERROR: JSON parse failed: %s\n", error.c_str());
        return false;
    }

    SERIAL_PRINTLN("[DDLRenderer] DDL parsed successfully");
    return true;
}

void DDLRenderer::render() {
    if (!initialized) {
        SERIAL_PRINTLN("[DDLRenderer] ERROR: Not initialized");
        return;
    }

    SERIAL_PRINTLN("[DDLRenderer] Rendering DDL...");
    
    // Clear existing content
    clear();
    
    // Get layout from DDL
    JsonObject layout = ddlDoc["layout"];
    if (!layout.isNull()) {
        renderLayout(layout);
    } else {
        SERIAL_PRINTLN("[DDLRenderer] WARNING: No layout found in DDL");
    }

    SERIAL_PRINTLN("[DDLRenderer] Rendering complete");
}

void DDLRenderer::clear() {
    // Delete all child objects from container
    lv_obj_clean(container);
    
    // Clear widget maps
    widgets.clear();
    widgetBindings.clear();
    widgetActions.clear();
}

void DDLRenderer::renderLayout(JsonObject layout) {
    String layoutType = layout["type"] | "column";
    
    lv_obj_t* layoutContainer = nullptr;
    
    if (layoutType == "column") {
        layoutContainer = createColumn(container);
    } else if (layoutType == "row") {
        layoutContainer = createRow(container);
    } else {
        layoutContainer = createColumn(container);
    }
    
    // Render cards
    JsonArray cards = layout["cards"];
    if (!cards.isNull()) {
        for (JsonObject card : cards) {
            renderCard(card, layoutContainer);
        }
    }
    
    // Render direct content
    JsonArray content = layout["content"];
    if (!content.isNull()) {
        renderContent(content, layoutContainer);
    }
}

void DDLRenderer::renderCard(JsonObject card, lv_obj_t* parent) {
    String cardId = card["id"] | "";
    String title = card["title"] | "";
    String subtitle = card["subtitle"] | "";
    SERIAL_PRINTF("[DDLRenderer] Rendering card: %s\n", cardId.c_str());

    
    // Create card container
    lv_obj_t* cardObj = createCard(parent);
    
    if (cardId.length() > 0) {
        registerWidget(cardId, cardObj);
    }
    
    // Add title
    if (title.length() > 0) {
        lv_obj_t* titleLabel = lv_label_create(cardObj);
        lv_label_set_text(titleLabel, title.c_str());
        lv_obj_set_style_text_font(titleLabel, &lv_font_montserrat_16, 0);
        lv_obj_set_style_text_color(titleLabel, lv_color_hex(0xFFFFFF), 0);
    }
    
    // Add subtitle
    if (subtitle.length() > 0) {
        lv_obj_t* subtitleLabel = lv_label_create(cardObj);
        lv_label_set_text(subtitleLabel, subtitle.c_str());
        lv_obj_set_style_text_font(subtitleLabel, &lv_font_montserrat_12, 0);
        lv_obj_set_style_text_color(subtitleLabel, lv_color_hex(0xCCCCCC), 0);
    }
    
    // Render card content
    JsonArray content = card["content"];
    if (!content.isNull()) {
        renderContent(content, cardObj);
    }
    
    // Render card actions
    JsonArray actions = card["actions"];
    if (!actions.isNull()) {
        lv_obj_t* actionRow = createRow(cardObj);
        for (JsonObject action : actions) {
            String type = action["type"] | "button";
            if (type == "button") {
                createButtonWidget(action, actionRow);
            }
        }
    }
}

void DDLRenderer::renderContent(JsonArray content, lv_obj_t* parent) {
    for (JsonObject widget : content) {
        String type = widget["type"] | "text";
        
        if (type == "text") {
            createTextWidget(widget, parent);
        } else if (type == "button") {
            createButtonWidget(widget, parent);
        } else if (type == "switch") {
            createSwitchWidget(widget, parent);
        } else if (type == "image") {
            createImageWidget(widget, parent);
        } else if (type == "chart") {
            createChartWidget(widget, parent);
        }
    }
}

lv_obj_t* DDLRenderer::createTextWidget(JsonObject widget, lv_obj_t* parent) {
    String id = getWidgetId(widget);
    String label = widget["label"] | "";
    String bind = getWidgetBind(widget);
    
    lv_obj_t* labelObj = lv_label_create(parent);
    lv_label_set_text(labelObj, label.c_str());
    
    if (id.length() > 0) {
        registerWidget(id, labelObj);
    }
    
    if (bind.length() > 0) {
        bindWidget(id, bind);
    }
    
    return labelObj;
}

lv_obj_t* DDLRenderer::createButtonWidget(JsonObject widget, lv_obj_t* parent) {
    String id = getWidgetId(widget);
    String label = widget["label"] | "Button";
    String action = getWidgetAction(widget);
    
    lv_obj_t* btn = lv_btn_create(parent);
    lv_obj_t* labelObj = lv_label_create(btn);
    lv_label_set_text(labelObj, label.c_str());
    lv_obj_center(labelObj);
    
    if (id.length() > 0) {
        registerWidget(id, btn);
    }
    
    if (action.length() > 0) {
        setWidgetAction(id, action);
        lv_obj_add_event_cb(btn, buttonEventHandler, LV_EVENT_CLICKED, (void*)this);
    }
    
    return btn;
}

lv_obj_t* DDLRenderer::createSwitchWidget(JsonObject widget, lv_obj_t* parent) {
    String id = getWidgetId(widget);
    String bind = getWidgetBind(widget);
    
    lv_obj_t* sw = lv_switch_create(parent);
    
    if (id.length() > 0) {
        registerWidget(id, sw);
    }
    
    if (bind.length() > 0) {
        bindWidget(id, bind);
        lv_obj_add_event_cb(sw, switchEventHandler, LV_EVENT_VALUE_CHANGED, (void*)this);
    }
    
    return sw;
}

lv_obj_t* DDLRenderer::createImageWidget(JsonObject widget, lv_obj_t* parent) {
    String id = getWidgetId(widget);
    
    lv_obj_t* img = lv_img_create(parent);
    
    if (id.length() > 0) {
        registerWidget(id, img);
    }
    
    return img;
}

lv_obj_t* DDLRenderer::createChartWidget(JsonObject widget, lv_obj_t* parent) {
    String id = getWidgetId(widget);
    
    lv_obj_t* chart = lv_chart_create(parent);
    lv_obj_set_size(chart, 200, 100);
    lv_chart_set_type(chart, LV_CHART_TYPE_LINE);
    
    if (id.length() > 0) {
        registerWidget(id, chart);
    }
    
    return chart;
}

lv_obj_t* DDLRenderer::createColumn(lv_obj_t* parent) {
    lv_obj_t* col = lv_obj_create(parent);
    lv_obj_set_flex_flow(col, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(col, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
    lv_obj_set_size(col, LV_PCT(100), LV_SIZE_CONTENT);
    return col;
}

lv_obj_t* DDLRenderer::createRow(lv_obj_t* parent) {
    lv_obj_t* row = lv_obj_create(parent);
    lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(row, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_START);
    lv_obj_set_size(row, LV_PCT(100), LV_SIZE_CONTENT);
    return row;
}

lv_obj_t* DDLRenderer::createCard(lv_obj_t* parent) {
    lv_obj_t* card = lv_obj_create(parent);
    lv_obj_set_size(card, LV_PCT(95), LV_SIZE_CONTENT);
    lv_obj_set_style_radius(card, 8, 0);
    lv_obj_set_style_bg_color(card, lv_color_hex(0x2C2C2C), 0);
    lv_obj_set_style_border_width(card, 1, 0);
    lv_obj_set_style_border_color(card, lv_color_hex(0x444444), 0);
    lv_obj_set_style_pad_all(card, 10, 0);
    lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
    return card;
}

void DDLRenderer::buttonEventHandler(lv_event_t* e) {
    DDLRenderer* renderer = (DDLRenderer*)lv_event_get_user_data(e);
    lv_obj_t* btn = lv_event_get_target(e);
    
    // Find widget ID and action
    for (auto& pair : renderer->widgets) {
        if (pair.second == btn) {
            String action = renderer->widgetActions[pair.first];
            if (action.length() > 0) {
                renderer->handleAction(action);
            }
            break;
        }
    }
}

void DDLRenderer::switchEventHandler(lv_event_t* e) {
    DDLRenderer* renderer = (DDLRenderer*)lv_event_get_user_data(e);
    lv_obj_t* sw = lv_event_get_target(e);
    
    bool state = lv_obj_has_state(sw, LV_STATE_CHECKED);
    
    // Find widget ID and binding
    for (auto& pair : renderer->widgets) {
        if (pair.second == sw) {
            String bind = renderer->widgetBindings[pair.first];
            if (bind.length() > 0 && renderer->registryCallback) {
                // Convert bool to JsonVariant
                JsonDocument doc;
                doc.set(state);
                renderer->registryCallback(bind, doc.as<JsonVariant>());
            }
            break;
        }
    }
}

void DDLRenderer::setRegistryCallback(RegistryCallback callback) {
    registryCallback = callback;
}

void DDLRenderer::onRegistryUpdate(const String& key, JsonVariant value) {
    // Find all widgets bound to this key
    for (auto& pair : widgetBindings) {
        if (pair.second == key) {
            updateWidget(pair.first, value);
        }
    }
}

void DDLRenderer::setActionCallback(ActionCallback callback) {
    actionCallback = callback;
}

void DDLRenderer::handleAction(const String& action) {
    SERIAL_PRINTF("[DDLRenderer] Action: %s\n", action.c_str());

    if (actionCallback) {
        actionCallback(action);
    }
}

lv_obj_t* DDLRenderer::getWidget(const String& widgetId) {
    auto it = widgets.find(widgetId);
    return (it != widgets.end()) ? it->second : nullptr;
}

void DDLRenderer::updateWidget(const String& widgetId, JsonVariant value) {
    lv_obj_t* widget = getWidget(widgetId);
    if (!widget) return;
    
    // Update based on widget type
    if (lv_obj_check_type(widget, &lv_label_class)) {
        String text = value.as<String>();
        lv_label_set_text(widget, text.c_str());
    } else if (lv_obj_check_type(widget, &lv_switch_class)) {
        bool state = value.as<bool>();
        if (state) {
            lv_obj_add_state(widget, LV_STATE_CHECKED);
        } else {
            lv_obj_clear_state(widget, LV_STATE_CHECKED);
        }
    }
}

void DDLRenderer::registerWidget(const String& id, lv_obj_t* obj) {
    widgets[id] = obj;
}

void DDLRenderer::bindWidget(const String& id, const String& registryKey) {
    widgetBindings[id] = registryKey;
}

void DDLRenderer::setWidgetAction(const String& id, const String& action) {
    widgetActions[id] = action;
}

String DDLRenderer::getWidgetId(JsonObject widget) {
    return widget["id"] | "";
}

String DDLRenderer::getWidgetBind(JsonObject widget) {
    return widget["bind"] | "";
}

String DDLRenderer::getWidgetAction(JsonObject widget) {
    return widget["action"] | "";
}

#endif // ENABLE_DISPLAY && !DISPLAY_NO_LVGL

// Made with Bob
