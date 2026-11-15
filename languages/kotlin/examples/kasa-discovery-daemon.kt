import pulse.host.*
import pulse.net.*

const val KASA_PORT = 9999
const val KASA_TTL_MS = 360000
const val KASA_REQUEST = "d0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf08bf68bf6"

fun main() {
    val subnets = localIpv4Subnets()
    var subnet = ""
    var subnetIndex = 0
    while (subnetIndex < jsonArrayCount(subnets)) {
        val candidate = jsonArrayGet(subnets, subnetIndex)
        if (networkPeerAllowed(jsonText(candidate, "broadcast"), KASA_PORT) == 1) {
            if (subnet != "") {
                raiseError("Kasa broadcast matches multiple interfaces")
                return
            }
            subnet = candidate
        }
        subnetIndex = subnetIndex + 1
    }
    if (subnet == "") {
        raiseError("Kasa broadcast is not allowed on an active interface")
        return
    }
    if (eventMethod() != "UDP") {
        udpSend(jsonText(subnet, "broadcast"), KASA_PORT, KASA_REQUEST)
        return
    }

    val address = eventPeer()
    if (address == jsonText(subnet, "address")) return
    if (eventPort() != KASA_PORT) return
    val encrypted = eventBytes()
    if (encrypted == KASA_REQUEST) return
    val length = bytesLength(encrypted)
    val buffer = bufferCreate(length)
    var index = 0
    var key = 171
    while (index < length) {
        val cipher = bytesGet(encrypted, index)
        bufferAppend(buffer, byteXor(key, cipher))
        key = cipher
        index = index + 1
    }
    if (bufferJsonPathInteger(buffer, "system.get_sysinfo.err_code") != 0) {
        raiseError("Kasa get_sysinfo failed")
        return
    }
    val name = bufferJsonPathText(buffer, "system.get_sysinfo.alias")
    val model = bufferJsonPathText(buffer, "system.get_sysinfo.model")
    bufferRelease(buffer)
    val cacheKey = "kasa:" + address
    if (cacheCount("devices") >= 50) {
        var cursor = cacheNext("devices", "")
        while (cursor != "" && cursor != cacheKey) {
            cursor = cacheNext("devices", cursor)
        }
        if (cursor == "") {
            raiseError("Kasa device cache capacity exceeded")
            return
        }
    }
    var device = jsonSetText("{}", "name", name)
    device = jsonSetText(device, "protocol", "kasa")
    device = jsonSetText(device, "address", address)
    device = jsonSetText(device, "deviceType", model)
    cachePut("devices", cacheKey, device, KASA_TTL_MS)
}
