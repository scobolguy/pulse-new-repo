#ifndef AWS_IOT_ROUTES_H
#define AWS_IOT_ROUTES_H

#ifdef ENABLE_AWS_IOT

#include <ESPAsyncWebServer.h>

/**
 * AWS IoT Gateway Routes
 * 
 * HTTP API endpoints for managing AWS IoT connection, Alexa integration,
 * and WFL workflows.
 */

/**
 * Register AWS IoT routes with web server
 * @param server AsyncWebServer instance
 */
void registerAwsIotRoutes(AsyncWebServer& server);

/**
 * Initialize AWS IoT gateway
 * @return true if initialization successful
 */
bool initializeAwsIotGateway();

/**
 * Shutdown AWS IoT gateway
 */
void shutdownAwsIotGateway();

/**
 * Update AWS IoT gateway (call in loop)
 */
void updateAwsIotGateway();

#endif // ENABLE_AWS_IOT

#endif // AWS_IOT_ROUTES_H

// Made with Bob