#ifndef PRINTER_ROUTES_H
#define PRINTER_ROUTES_H

#ifdef ENABLE_PRINTER_SCANNER

#include <ESPAsyncWebServer.h>

/**
 * Register Printer/Scanner HTTP Routes
 * 
 * @param server AsyncWebServer instance to register routes with
 */
void registerPrinterRoutes(AsyncWebServer& server);

/**
 * Register Printer/Scanner Alexa Handlers
 * 
 * Registers Alexa Smart Home capability handlers for printer/scanner control
 */
void registerPrinterAlexaHandlers();

/**
 * Report Printer/Scanner State to Alexa
 * 
 * @param deviceId Device ID to report state for
 */
void reportPrinterStateToAlexa(const String& deviceId);

#endif // ENABLE_PRINTER_SCANNER

#endif // PRINTER_ROUTES_H

// Made with Bob