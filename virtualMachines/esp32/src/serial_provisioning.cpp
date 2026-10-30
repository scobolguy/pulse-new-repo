#include "serial_provisioning.h"

#include "control_plane_commands.h"
#include "SerialConsoleLease.h"

namespace {

String gSerialBuffer;

}  // namespace

void serialProvisioningPoll() {
    SerialConsoleLease console;
    if (!console.acquire()) return;
    controlPlanePollStream(Serial, gSerialBuffer, "SERIAL-PROV");
}
