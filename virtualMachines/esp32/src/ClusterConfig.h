#ifndef CLUSTERCONFIG_H
#define CLUSTERCONFIG_H

#include <Arduino.h>
#include "ConfigSchema.h"

struct ClusterConfig {
    String clusterId = "";
    bool isGateway = false;
    static const FieldDescriptor schema[2];
    static constexpr size_t schemaSize = 2;
};

#endif // CLUSTERCONFIG_H
