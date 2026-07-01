#ifdef ENABLE_EVENT_SCHEDULER

#include "EventScheduler.h"
#include <LittleFS.h>
#include <sys/time.h>

// Global instance
EventScheduler* globalEventScheduler = nullptr;

// ============================================================================
// TimeParser Implementation
// ============================================================================

bool TimeParser::parseTime(const String& timeStr, int& hour, int& minute) {
    String str = timeStr;
    str.trim();
    str.toLowerCase();
    
    // Handle "10 PM", "10:30 AM", etc.
    bool isPM = str.indexOf("pm") >= 0;
    bool isAM = str.indexOf("am") >= 0;
    
    // Remove AM/PM
    str.replace("am", "");
    str.replace("pm", "");
    str.trim();
    
    // Parse hour and minute
    int colonPos = str.indexOf(':');
    if (colonPos > 0) {
        hour = str.substring(0, colonPos).toInt();
        minute = str.substring(colonPos + 1).toInt();
    } else {
        hour = str.toInt();
        minute = 0;
    }
    
    // Convert to 24-hour format
    if (isPM && hour < 12) {
        hour += 12;
    } else if (isAM && hour == 12) {
        hour = 0;
    }
    
    // Validate
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return false;
    }
    
    return true;
}

uint32_t TimeParser::parseDuration(const String& durationStr) {
    String str = durationStr;
    str.trim();
    str.toLowerCase();
    
    // Extract number
    int value = 0;
    int i = 0;
    while (i < str.length() && isdigit(str[i])) {
        value = value * 10 + (str[i] - '0');
        i++;
    }
    
    // Extract unit
    String unit = str.substring(i);
    unit.trim();
    
    // Convert to seconds
    if (unit.startsWith("sec")) {
        return value;
    } else if (unit.startsWith("min")) {
        return value * 60;
    } else if (unit.startsWith("hour") || unit.startsWith("hr")) {
        return value * 3600;
    } else if (unit.startsWith("day")) {
        return value * 86400;
    }
    
    // Default to seconds
    return value;
}

bool TimeParser::parseCron(const String& cronExpr, int& minute, int& hour,
                          int& dayOfMonth, int& month, int& dayOfWeek) {
    // Parse cron expression: "minute hour dayOfMonth month dayOfWeek"
    // Example: "0 22 * * *" = 10 PM every day
    
    int parts[5] = {-1, -1, -1, -1, -1};
    int partIndex = 0;
    String current = "";
    
    for (int i = 0; i < cronExpr.length() && partIndex < 5; i++) {
        char c = cronExpr[i];
        if (c == ' ') {
            if (current.length() > 0) {
                if (current == "*") {
                    parts[partIndex] = -1;
                } else {
                    parts[partIndex] = current.toInt();
                }
                current = "";
                partIndex++;
            }
        } else {
            current += c;
        }
    }
    
    // Handle last part
    if (current.length() > 0 && partIndex < 5) {
        if (current == "*") {
            parts[partIndex] = -1;
        } else {
            parts[partIndex] = current.toInt();
        }
    }
    
    minute = parts[0];
    hour = parts[1];
    dayOfMonth = parts[2];
    month = parts[3];
    dayOfWeek = parts[4];
    
    return true;
}

time_t TimeParser::calculateNextRun(const String& cronExpr, time_t fromTime) {
    if (fromTime == 0) {
        fromTime = time(nullptr);
    }
    
    int minute, hour, dayOfMonth, month, dayOfWeek;
    if (!parseCron(cronExpr, minute, hour, dayOfMonth, month, dayOfWeek)) {
        return 0;
    }
    
    struct tm timeinfo;
    localtime_r(&fromTime, &timeinfo);
    
    // Set time components
    if (minute >= 0) timeinfo.tm_min = minute;
    if (hour >= 0) timeinfo.tm_hour = hour;
    if (dayOfMonth >= 0) timeinfo.tm_mday = dayOfMonth;
    if (month >= 0) timeinfo.tm_mon = month - 1;
    
    // Convert back to time_t
    time_t nextRun = mktime(&timeinfo);
    
    // If the calculated time is in the past, add one day
    if (nextRun <= fromTime) {
        nextRun += 86400; // Add 24 hours
    }
    
    return nextRun;
}

time_t TimeParser::parseRelativeTime(const String& relativeStr) {
    String str = relativeStr;
    str.trim();
    
    if (!str.startsWith("+")) {
        return 0;
    }
    
    str = str.substring(1); // Remove '+'
    uint32_t duration = parseDuration(str);
    
    return time(nullptr) + duration;
}

// ============================================================================
// EventScheduler Implementation
// ============================================================================

EventScheduler::EventScheduler()
    : nextEventId("evt_001"), enabled(true), checkInterval(1000),
      maxEvents(100), persistEvents(true), timezone("America/New_York"),
      lastCheck(0), eventExecutor(nullptr), eventCallback(nullptr) {
}

EventScheduler::~EventScheduler() {
    end();
}

bool EventScheduler::begin() {
    Serial.println("EventScheduler: Initializing...");
    
    // Initialize timezone
    initializeTimeZone();
    
    // Load configuration if available
    if (LittleFS.exists("/config/schedules.json")) {
        loadConfig("/config/schedules.json");
    }
    
    lastCheck = millis();
    
    Serial.println("EventScheduler: Initialized successfully");
    Serial.printf("EventScheduler: Loaded %d scheduled events\n", events.size());
    
    // Register service for advertisement
    registerService();
    
    return true;
}

void EventScheduler::loop() {
    if (!enabled) {
        return;
    }
    
    unsigned long now = millis();
    if (now - lastCheck >= checkInterval) {
        checkEvents();
        lastCheck = now;
    }
}

void EventScheduler::end() {
    if (persistEvents) {
        saveConfig("/config/schedules.json");
    }
    events.clear();
}

// ============================================================================
// Event Management
// ============================================================================

String EventScheduler::createEvent(const ScheduledEvent& event) {
    if (events.size() >= maxEvents) {
        Serial.println("EventScheduler: Maximum events reached");
        return "";
    }
    
    ScheduledEvent newEvent = event;
    if (newEvent.id.isEmpty()) {
        newEvent.id = generateEventId();
    }
    
    // Calculate next run time
    if (newEvent.nextRun == 0) {
        if (newEvent.recurring) {
            newEvent.nextRun = TimeParser::calculateNextRun(newEvent.schedule);
        } else {
            // Parse one-time schedule
            int hour, minute;
            if (TimeParser::parseTime(newEvent.schedule, hour, minute)) {
                struct tm timeinfo;
                time_t now = time(nullptr);
                localtime_r(&now, &timeinfo);
                timeinfo.tm_hour = hour;
                timeinfo.tm_min = minute;
                timeinfo.tm_sec = 0;
                newEvent.nextRun = mktime(&timeinfo);
                
                // If time is in the past, schedule for tomorrow
                if (newEvent.nextRun <= now) {
                    newEvent.nextRun += 86400;
                }
            }
        }
    }
    
    events[newEvent.id] = newEvent;
    
    Serial.printf("EventScheduler: Created event %s for device %s\n",
                  newEvent.id.c_str(), newEvent.deviceId.c_str());
    
    if (persistEvents) {
        saveConfig("/config/schedules.json");
    }
    
    notifyEventStatus(newEvent.id, "created");
    
    return newEvent.id;
}

bool EventScheduler::updateEvent(const String& eventId, const ScheduledEvent& event) {
    auto it = events.find(eventId);
    if (it == events.end()) {
        return false;
    }
    
    it->second = event;
    it->second.id = eventId; // Preserve ID
    
    if (persistEvents) {
        saveConfig("/config/schedules.json");
    }
    
    notifyEventStatus(eventId, "updated");
    
    return true;
}

bool EventScheduler::deleteEvent(const String& eventId) {
    auto it = events.find(eventId);
    if (it == events.end()) {
        return false;
    }
    
    events.erase(it);
    
    Serial.printf("EventScheduler: Deleted event %s\n", eventId.c_str());
    
    if (persistEvents) {
        saveConfig("/config/schedules.json");
    }
    
    notifyEventStatus(eventId, "deleted");
    
    return true;
}

ScheduledEvent* EventScheduler::getEvent(const String& eventId) {
    auto it = events.find(eventId);
    if (it == events.end()) {
        return nullptr;
    }
    return &(it->second);
}

std::vector<ScheduledEvent> EventScheduler::getAllEvents() {
    std::vector<ScheduledEvent> result;
    for (const auto& pair : events) {
        result.push_back(pair.second);
    }
    return result;
}

std::vector<ScheduledEvent> EventScheduler::getUpcomingEvents(int count) {
    std::vector<ScheduledEvent> result;
    time_t now = getCurrentTime();
    
    // Collect all enabled events
    for (const auto& pair : events) {
        if (pair.second.enabled && pair.second.nextRun > now) {
            result.push_back(pair.second);
        }
    }
    
    // Sort by next run time
    std::sort(result.begin(), result.end(), 
              [](const ScheduledEvent& a, const ScheduledEvent& b) {
                  return a.nextRun < b.nextRun;
              });
    
    // Limit to count
    if (result.size() > count) {
        result.resize(count);
    }
    
    return result;
}

std::vector<ScheduledEvent> EventScheduler::getEventsByDevice(const String& deviceId) {
    std::vector<ScheduledEvent> result;
    for (const auto& pair : events) {
        if (pair.second.deviceId == deviceId) {
            result.push_back(pair.second);
        }
    }
    return result;
}

// ============================================================================
// Event Control
// ============================================================================

bool EventScheduler::enableEvent(const String& eventId) {
    ScheduledEvent* event = getEvent(eventId);
    if (!event) {
        return false;
    }
    
    event->enabled = true;
    notifyEventStatus(eventId, "enabled");
    
    if (persistEvents) {
        saveConfig("/config/schedules.json");
    }
    
    return true;
}

bool EventScheduler::disableEvent(const String& eventId) {
    ScheduledEvent* event = getEvent(eventId);
    if (!event) {
        return false;
    }
    
    event->enabled = false;
    notifyEventStatus(eventId, "disabled");
    
    if (persistEvents) {
        saveConfig("/config/schedules.json");
    }
    
    return true;
}

bool EventScheduler::triggerEvent(const String& eventId) {
    ScheduledEvent* event = getEvent(eventId);
    if (!event) {
        return false;
    }
    
    Serial.printf("EventScheduler: Manually triggering event %s\n", eventId.c_str());
    return executeEvent(*event);
}

// ============================================================================
// Scheduling
// ============================================================================

String EventScheduler::scheduleOnce(const String& deviceId, const String& deviceType,
                                   const String& action, const String& timeSpec,
                                   uint32_t duration, const JsonDocument& params) {
    ScheduledEvent event;
    event.deviceId = deviceId;
    event.deviceType = deviceType;
    event.action = action;
    event.schedule = timeSpec;
    event.recurring = false;
    event.duration = duration;
    event.params = params;
    event.name = action + " " + deviceId + " at " + timeSpec;
    
    return createEvent(event);
}

String EventScheduler::scheduleRecurring(const String& deviceId, const String& deviceType,
                                        const String& action, const String& cronExpr,
                                        uint32_t duration, const JsonDocument& params) {
    ScheduledEvent event;
    event.deviceId = deviceId;
    event.deviceType = deviceType;
    event.action = action;
    event.schedule = cronExpr;
    event.recurring = true;
    event.duration = duration;
    event.params = params;
    event.name = action + " " + deviceId + " (recurring)";
    
    return createEvent(event);
}

String EventScheduler::scheduleFromNaturalLanguage(const String& deviceId, 
                                                   const String& deviceType,
                                                   const String& action,
                                                   const String& timePhrase,
                                                   const String& durationPhrase,
                                                   bool recurring) {
    uint32_t duration = 0;
    if (!durationPhrase.isEmpty()) {
        duration = TimeParser::parseDuration(durationPhrase);
    }
    
    if (recurring) {
        // Convert to cron expression
        int hour, minute;
        if (TimeParser::parseTime(timePhrase, hour, minute)) {
            String cronExpr = String(minute) + " " + String(hour) + " * * *";
            return scheduleRecurring(deviceId, deviceType, action, cronExpr, duration);
        }
    } else {
        return scheduleOnce(deviceId, deviceType, action, timePhrase, duration);
    }
    
    return "";
}

// ============================================================================
// Configuration
// ============================================================================

bool EventScheduler::loadConfig(const char* configPath) {
    Serial.printf("EventScheduler: Loading configuration from %s\n", configPath);
    
    File file = LittleFS.open(configPath, "r");
    if (!file) {
        Serial.println("EventScheduler: Failed to open config file");
        return false;
    }
    
    StaticJsonDocument<8192> doc;
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) {
        Serial.printf("EventScheduler: Failed to parse config: %s\n", error.c_str());
        return false;
    }
    
    // Load settings
    if (doc.containsKey("settings")) {
        JsonObject settings = doc["settings"];
        enabled = settings["enabled"] | true;
        checkInterval = settings["checkInterval"] | 1000;
        maxEvents = settings["maxEvents"] | 100;
        persistEvents = settings["persistEvents"] | true;
        timezone = settings["timezone"] | "America/New_York";
    }
    
    // Load events
    if (doc.containsKey("events")) {
        JsonArray eventsArray = doc["events"];
        for (JsonObject eventObj : eventsArray) {
            ScheduledEvent event;
            event.id = eventObj["id"] | "";
            event.name = eventObj["name"] | "";
            event.deviceId = eventObj["deviceId"] | "";
            event.deviceType = eventObj["deviceType"] | "";
            event.action = eventObj["action"] | "";
            event.schedule = eventObj["schedule"] | "";
            event.recurring = eventObj["recurring"] | false;
            event.duration = eventObj["duration"] | 0;
            event.enabled = eventObj["enabled"] | true;
            event.nextRun = eventObj["nextRun"] | 0;
            event.lastRun = eventObj["lastRun"] | 0;
            event.runCount = eventObj["runCount"] | 0;
            
            if (eventObj.containsKey("params")) {
                event.params = eventObj["params"];
            }
            
            if (!event.id.isEmpty()) {
                events[event.id] = event;
            }
        }
    }
    
    Serial.printf("EventScheduler: Loaded %d events from config\n", events.size());
    return true;
}

bool EventScheduler::saveConfig(const char* configPath) {
    Serial.printf("EventScheduler: Saving configuration to %s\n", configPath);
    
    StaticJsonDocument<8192> doc;
    
    // Save settings
    JsonObject settings = doc.createNestedObject("settings");
    settings["enabled"] = enabled;
    settings["checkInterval"] = checkInterval;
    settings["maxEvents"] = maxEvents;
    settings["persistEvents"] = persistEvents;
    settings["timezone"] = timezone;
    
    // Save events
    JsonArray eventsArray = doc.createNestedArray("events");
    for (const auto& pair : events) {
        JsonObject eventObj = eventsArray.createNestedObject();
        eventObj["id"] = pair.second.id;
        eventObj["name"] = pair.second.name;
        eventObj["deviceId"] = pair.second.deviceId;
        eventObj["deviceType"] = pair.second.deviceType;
        eventObj["action"] = pair.second.action;
        eventObj["schedule"] = pair.second.schedule;
        eventObj["recurring"] = pair.second.recurring;
        eventObj["duration"] = pair.second.duration;
        eventObj["enabled"] = pair.second.enabled;
        eventObj["nextRun"] = pair.second.nextRun;
        eventObj["lastRun"] = pair.second.lastRun;
        eventObj["runCount"] = pair.second.runCount;
        eventObj["params"] = pair.second.params;
    }
    
    File file = LittleFS.open(configPath, "w");
    if (!file) {
        Serial.println("EventScheduler: Failed to open config file for writing");
        return false;
    }
    
    serializeJson(doc, file);
    file.close();
    
    Serial.println("EventScheduler: Configuration saved successfully");
    return true;
}

String EventScheduler::toJson() {
    StaticJsonDocument<8192> doc;
    
    JsonArray eventsArray = doc.createNestedArray("events");
    for (const auto& pair : events) {
        JsonObject eventObj = eventsArray.createNestedObject();
        eventObj["id"] = pair.second.id;
        eventObj["name"] = pair.second.name;
        eventObj["deviceId"] = pair.second.deviceId;
        eventObj["action"] = pair.second.action;
        eventObj["nextRun"] = pair.second.nextRun;
        eventObj["enabled"] = pair.second.enabled;
    }
    
    String output;
    serializeJson(doc, output);
    return output;
}

// ============================================================================
// Helper Methods
// ============================================================================

void EventScheduler::checkEvents() {
    time_t now = getCurrentTime();
    
    for (auto& pair : events) {
        ScheduledEvent& event = pair.second;
        
        if (!event.enabled) {
            continue;
        }
        
        if (event.nextRun > 0 && now >= event.nextRun) {
            Serial.printf("EventScheduler: Executing event %s\n", event.id.c_str());
            
            if (executeEvent(event)) {
                event.lastRun = now;
                event.runCount++;
                
                // Schedule next run for recurring events
                if (event.recurring) {
                    scheduleNextRun(event);
                } else {
                    // Disable one-time events after execution
                    event.enabled = false;
                }
                
                if (persistEvents) {
                    saveConfig("/config/schedules.json");
                }
            }
        }
    }
}

bool EventScheduler::executeEvent(ScheduledEvent& event) {
    Serial.printf("EventScheduler: Executing %s on %s (%s)\n",
                  event.action.c_str(), event.deviceId.c_str(), event.deviceType.c_str());
    
    if (eventExecutor) {
        bool success = eventExecutor(event);
        
        if (success) {
            notifyEventStatus(event.id, "executed");
            
            // Schedule auto-off if duration is specified
            if (event.duration > 0 && event.action == "on") {
                ScheduledEvent offEvent;
                offEvent.deviceId = event.deviceId;
                offEvent.deviceType = event.deviceType;
                offEvent.action = "off";
                offEvent.schedule = "+" + String(event.duration) + "s";
                offEvent.recurring = false;
                offEvent.duration = 0;
                offEvent.name = "Auto-off " + event.deviceId;
                offEvent.nextRun = getCurrentTime() + event.duration;
                
                createEvent(offEvent);
            }
        } else {
            notifyEventStatus(event.id, "failed");
        }
        
        return success;
    }
    
    return false;
}

void EventScheduler::scheduleNextRun(ScheduledEvent& event) {
    if (event.recurring) {
        event.nextRun = TimeParser::calculateNextRun(event.schedule, event.nextRun);
        Serial.printf("EventScheduler: Next run for %s scheduled at %ld\n",
                      event.id.c_str(), event.nextRun);
    }
}

String EventScheduler::generateEventId() {
    // Simple incrementing ID
    int num = nextEventId.substring(4).toInt();
    num++;
    nextEventId = "evt_" + String(num);
    while (nextEventId.length() < 7) {
        nextEventId = nextEventId.substring(0, 4) + "0" + nextEventId.substring(4);
    }
    return nextEventId;
}

void EventScheduler::notifyEventStatus(const String& eventId, const String& status) {
    if (eventCallback) {
        eventCallback(eventId, status);
    }
}

time_t EventScheduler::getCurrentTime() {
    return time(nullptr);
}

void EventScheduler::initializeTimeZone() {
    // Set timezone
    setenv("TZ", timezone.c_str(), 1);
    tzset();
    
    Serial.printf("EventScheduler: Timezone set to %s\n", timezone.c_str());
}

// ============================================================================
// Initialization Helper
// ============================================================================

void initializeEventScheduler() {
    if (!globalEventScheduler) {
        globalEventScheduler = new EventScheduler();
        globalEventScheduler->begin();
    }
}

// ============================================================================
// Service Registration and Advertisement
// ============================================================================

String EventScheduler::getServiceManifest() const {
    StaticJsonDocument<2048> doc;
    
    doc["type"] = "service";
    doc["name"] = "EventSchedulerService";
    doc["description"] = "Time-based automation and scheduling for smart home devices";
    doc["version"] = "1.0.0";
    doc["enabled"] = enabled;
    
    JsonArray endpoints = doc.createNestedArray("endpoints");
    endpoints.add("/scheduler/schedules");
    endpoints.add("/scheduler/schedule/:id");
    endpoints.add("/scheduler/execute/:id");
    endpoints.add("/scheduler/status");
    
    JsonArray features = doc.createNestedArray("features");
    features.add("Natural language time parsing");
    features.add("Cron expressions");
    features.add("Duration-based actions");
    features.add("Recurring events");
    features.add("Multi-device support");
    
    JsonObject stats = doc.createNestedObject("statistics");
    stats["totalEvents"] = events.size();
    stats["activeEvents"] = 0;
    stats["checkInterval"] = checkInterval;
    stats["timezone"] = timezone;
    
    // Count active events
    for (const auto& pair : events) {
        if (pair.second.enabled) {
            stats["activeEvents"] = stats["activeEvents"].as<int>() + 1;
        }
    }
    
    String manifest;
    serializeJson(doc, manifest);
    return manifest;
}

String EventScheduler::getServiceCapabilities() const {
    StaticJsonDocument<512> doc;
    
    doc["service"] = "EventSchedulerService";
    doc["features"] = "scheduling,cron,natural_language,duration";
    doc["deviceTypes"] = "all";
    doc["eventCount"] = events.size();
    doc["status"] = enabled ? "enabled" : "disabled";
    doc["timezone"] = timezone;
    
    String capabilities;
    serializeJson(doc, capabilities);
    return capabilities;
}

void EventScheduler::registerService() {
    Serial.println("========================================");
    Serial.println("⏰ EVENT SCHEDULER SERVICE REGISTERED");
    Serial.println("   Service: EventSchedulerService");
    Serial.println("   Features: Natural language, cron, duration-based");
    Serial.println("   Endpoints: /scheduler/*");
    Serial.printf("   Status: %s\n", enabled ? "Enabled" : "Disabled");
    Serial.printf("   Events: %d scheduled\n", events.size());
    Serial.printf("   Timezone: %s\n", timezone.c_str());
    Serial.println("========================================");
}

#endif // ENABLE_EVENT_SCHEDULER

// Made with Bob