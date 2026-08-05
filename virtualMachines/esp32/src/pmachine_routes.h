#pragma once
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

void registerPMachineRoutes(AsyncWebServer& server, pmachine::PMachine& pm, FederatedFileSystem* ffs = nullptr);
