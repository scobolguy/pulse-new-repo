import pulse.host.*
import pulse.net.*

const val KASA_TTL_MS = 360000
const val KASA_CACHE_LIMIT = 50
const val KASA_REQUEST = "d0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf08bf68bf6"

fun main() {
    val subnets = localIpv4Subnets()
    var index = 0
    while (index < jsonArrayCount(subnets)) {
        val subnet = jsonArrayGet(subnets, index)
        if (networkPeerAllowed(jsonText(subnet, "broadcast"), 9999) == 1) {
            udpSend(jsonText(subnet, "broadcast"), 9999, KASA_REQUEST)
        }
        index = index + 1
    }
    if (eventMethod() != "UDP") return
    val address = eventPeer()
    val port = eventPort()
    if (port != 9999 || cacheCount("kasa-devices") >= KASA_CACHE_LIMIT) return
    val payload = eventBytes()
    if (payload == "") return
    var device = jsonSetText("{}", "name", address)
    device = jsonSetText(device, "protocol", "kasa")
    device = jsonSetText(device, "address", address)
    device = jsonSetText(device, "port", port.toString())
    device = jsonSetText(device, "deviceType", "kasa-device")
    cachePut("kasa-devices", "kasa:" + address, device, KASA_TTL_MS)
}
