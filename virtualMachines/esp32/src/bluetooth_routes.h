#ifndef BLUETOOTH_ROUTES_H
#define BLUETOOTH_ROUTES_H

#ifdef ENABLE_BLUETOOTH_DEVICES

#include <ESPAsyncWebServer.h>
#include "BluetoothService.h"
#include "EventScheduler.h"

/**
 * Register Bluetooth device management routes
 */
void registerBluetoothRoutes(AsyncWebServer& server);

/**
 * Register event scheduler routes
 */
void registerSchedulerRoutes(AsyncWebServer& server);

#endif // ENABLE_BLUETOOTH_DEVICES

#endif // BLUETOOTH_ROUTES_H

// Made with Bob