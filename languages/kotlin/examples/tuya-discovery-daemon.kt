import pulse.host.*
import pulse.net.*

const val TUYA_TTL_MS = 180000

fun main() {
    println("[TUYA DEBUG] invocation method=" + eventMethod() + " port=" + eventPort().toString())
    val subnets = localIpv4Subnets()
    var index = 0
    while (index < jsonArrayCount(subnets)) {
        val subnet = jsonArrayGet(subnets, index)
        if (networkPeerAllowed(jsonText(subnet, "broadcast"), 6667) == 1) {
            udpSend(jsonText(subnet, "broadcast"), 6667, "")
            udpSend(jsonText(subnet, "broadcast"), 6666, "")
        }
        index = index + 1
    }

    if (eventMethod() != "UDP") return
    val address = eventPeer()
    val port = eventPort()
    val payload = eventBytes()
    println("[TUYA DEBUG] UDP peer=" + address + " bytes=" + bytesLength(payload).toString())
    if (payload == "") {
        println("[TUYA DEBUG] ignored empty payload")
        return
    }

    var device = jsonSetText("{}", "name", address)
    device = jsonSetText(device, "protocol", "tuya")
    device = jsonSetText(device, "address", address)
    device = jsonSetText(device, "port", port.toString())
    device = jsonSetText(device, "deviceType", "tuya-device")
    device = jsonSetText(device, "payloadHex", payload)
    println("[TUYA DEBUG] writing cache record")
    cachePut("tuya-devices", "tuya:" + address + ":" + port.toString(), device, TUYA_TTL_MS)
    println("[TUYA DEBUG] cache record written")
}
