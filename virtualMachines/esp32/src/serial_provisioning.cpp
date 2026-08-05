#include "serial_provisioning.h"

#include "control_plane_commands.h"

namespace {

String gSerialBuffer;

}  // namespace

void serialProvisioningPoll() {
    controlPlanePollStream(Serial, gSerialBuffer, "SERIAL-PROV");
}
