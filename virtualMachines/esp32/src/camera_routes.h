#ifndef CAMERA_ROUTES_H
#define CAMERA_ROUTES_H

#ifdef ENABLE_CAMERA

#include <ESPAsyncWebServer.h>

// Setup all camera-related HTTP routes
void setupCameraRoutes(AsyncWebServer& server);

#endif // ENABLE_CAMERA
#endif // CAMERA_ROUTES_H

// Made with Bob
