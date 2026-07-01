#ifndef EVENT_SCHEDULER_H
#define EVENT_SCHEDULER_H

#include <Arduino.h>
#include <vector>
#include <map>
#include <ArduinoJson.h>
#include <time.h>

/**
 * Scheduled Event
 */
struct ScheduledEvent {
    String id;                   // Unique event identifier
    String name;                 // Human-readable name
    String deviceId;             // Target device ID
    String deviceType;           // Device type (bluetooth, printer, upnp)
    String action;               // Action to perform (on, off, dim, etc.)
    JsonDocument params;         // Action parameters
    
    // Timing
    String schedule;             // Cron expression or time specification
    bool recurring;              // Is this a recurring event?
    uint32_t duration;           // Duration in seconds (0 = indefinite)
    
    // State
    bool enabled;                // Is event enabled?
    time_t nextRun;              // Next execution time (Unix timestamp)
    time_t lastRun;              // Last execution time
    uint32_t runCount;           // Number of times executed
    
    ScheduledEvent() 
        : id(""), name(""), deviceId(""), deviceType(""), action(""),
          schedule(""), recurring(false), duration(0), enabled(true),
          nextRun(0), lastRun(0), runCount(0) {
        params = StaticJsonDocument<256>();
    }
};

/**
 * Time Specification Parser
 * Parses natural language and cron expressions
 */
class TimeParser {
public:
    // Parse natural language time (e.g., "10 PM", "10:30 AM")
    static bool parseTime(const String& timeStr, int& hour, int& minute);
    
    // Parse duration (e.g., "20 minutes", "2 hours")
    static uint32_t parseDuration(const String& durationStr);
    
    // Parse cron expression (e.g., "0 22 * * *")
    static bool parseCron(const String& cronExpr, int& minute, int& hour, 
                         int& dayOfMonth, int& month, int& dayOfWeek);
    
    // Calculate next run time from cron expression
    static time_t calculateNextRun(const String& cronExpr, time_t fromTime = 0);
    
    // Parse relative time (e.g., "+30m", "+2h")
    static time_t parseRelativeTime(const String& relativeStr);
};

/**
 * EventScheduler Service
 * 
 * Manages time-based automation for all devices.
 * Supports one-time and recurring events with natural language and cron scheduling.
 */
class EventScheduler {
public:
    EventScheduler();
    ~EventScheduler();
    
    // Initialization
    bool begin();
    void loop();
    void end();
    
    // Event Management
    String createEvent(const ScheduledEvent& event);
    bool updateEvent(const String& eventId, const ScheduledEvent& event);
    bool deleteEvent(const String& eventId);
    ScheduledEvent* getEvent(const String& eventId);
    std::vector<ScheduledEvent> getAllEvents();
    std::vector<ScheduledEvent> getUpcomingEvents(int count = 10);
    std::vector<ScheduledEvent> getEventsByDevice(const String& deviceId);
    int getEventCount() const { return events.size(); }
    
    // Event Control
    bool enableEvent(const String& eventId);
    bool disableEvent(const String& eventId);
    bool triggerEvent(const String& eventId);  // Manually trigger event
    
    // Scheduling
    String scheduleOnce(const String& deviceId, const String& deviceType,
                       const String& action, const String& timeSpec,
                       uint32_t duration = 0, const JsonDocument& params = StaticJsonDocument<256>());
    
    String scheduleRecurring(const String& deviceId, const String& deviceType,
                            const String& action, const String& cronExpr,
                            uint32_t duration = 0, const JsonDocument& params = StaticJsonDocument<256>());
    
    // Natural Language Scheduling (for Alexa)
    String scheduleFromNaturalLanguage(const String& deviceId, const String& deviceType,
                                      const String& action, const String& timePhrase,
                                      const String& durationPhrase = "",
                                      bool recurring = false);
    
    // Configuration
    bool loadConfig(const char* configPath);
    bool saveConfig(const char* configPath);
    String toJson();
    
    // Status
    bool isEnabled() const { return enabled; }
    void setEnabled(bool enable) { enabled = enable; }
    int getCheckInterval() const { return checkInterval; }
    void setCheckInterval(int interval) { checkInterval = interval; }
    
    // Callbacks
    typedef bool (*EventExecutor)(const ScheduledEvent& event);
    void setEventExecutor(EventExecutor executor) { eventExecutor = executor; }
    
    typedef void (*EventCallback)(const String& eventId, const String& status);
    void setEventCallback(EventCallback callback) { eventCallback = callback; }
    
    // Service registration and advertisement
    String getServiceManifest() const;
    String getServiceCapabilities() const;
    void registerService();
    
private:
    std::map<String, ScheduledEvent> events;
    String nextEventId;
    bool enabled;
    int checkInterval;          // Check interval in milliseconds
    int maxEvents;              // Maximum number of events
    bool persistEvents;         // Persist events to file
    String timezone;            // Timezone (e.g., "America/New_York")
    unsigned long lastCheck;    // Last check time
    EventExecutor eventExecutor;
    EventCallback eventCallback;
    
    // Helper methods
    void checkEvents();
    bool executeEvent(ScheduledEvent& event);
    void scheduleNextRun(ScheduledEvent& event);
    String generateEventId();
    void notifyEventStatus(const String& eventId, const String& status);
    time_t getCurrentTime();
    void initializeTimeZone();
};

// Global instance
extern EventScheduler* globalEventScheduler;

// Initialization helper
void initializeEventScheduler();

#endif // EVENT_SCHEDULER_H

// Made with Bob