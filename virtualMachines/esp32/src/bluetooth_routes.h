#ifndef BLUETOOTH_ROUTES_H
#define BLUETOOTH_ROUTES_H

#ifdef ENABLE_BLUETOOTH_DEVICES

#include <ESPAsyncWebServer.h>
#include "BluetoothService.h"

#ifdef ENABLE_EVENT_SCHEDULER
#include "EventScheduler.h"
#endif

/**
 * Register Bluetooth device management routes
 */
void registerBluetoothRoutes(AsyncWebServer& server);

/**
 * Register event scheduler routes
 */
#ifdef ENABLE_EVENT_SCHEDULER
void registerSchedulerRoutes(AsyncWebServer& server);
#endif

#endif // ENABLE_BLUETOOTH_DEVICES

#endif // BLUETOOTH_ROUTES_H

// Made with Bob