#pragma once
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include "pmachine.h"
#include "ffs/FederatedFileSystem.h"

struct PMachineFileExecutionResult {
	int statusCode = 500;
	String body;
};

PMachineFileExecutionResult executePMachineFile(
	pmachine::PMachine& machine,
	FederatedFileSystem* ffs,
	const String& file,
	const String& programMap,
	const String& inputQueue = "",
	const String& message = "",
	size_t maxBytes = 65536
);

void registerPMachineRoutes(
	AsyncWebServer& server,
	pmachine::PMachine& pm,
	FederatedFileSystem* ffs = nullptr,
	pmachine::PMachine* asyncWorkerMachine = nullptr
);
// Gives the hosted service host its FFS for string-arena swap; nothing is reserved until a
// service is installed.
void configurePMachineHostedStorage(FederatedFileSystem& ffs);
// Called from the firmware beacon path when an aggregator acknowledges this node.
void pmachineLearnAggregator(const char* aggregatorId, const char* address, uint16_t httpPort);
#if defined(ESP32)
void collectPMachineDiagnostics(JsonObject doc);
#endif
void invalidateRouterExecutionCache();
