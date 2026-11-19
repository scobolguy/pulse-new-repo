import pulse.host.*
import pulse.http.*

@Cache(name = "ssdp-devices", capacity = 50, ttlMs = 180000,
    fields = "name:string,protocol:string,address:string,deviceType:string")
class SsdpDevices {}

fun validUuid(uuid: String): Boolean {
    val bytes = bytesFromText(uuid)
    if (bytesLength(bytes) != 36) return false
    var i = 0
    while (i < 36) {
        val ch = bytesGet(bytes, i)
        if (i == 8 || i == 13 || i == 18 || i == 23) {
            if (ch != 45) return false
        } else {
            if ((ch < 48 || ch > 57) && (ch < 97 || ch > 102)) return false
        }
        i = i + 1
    }
    return true
}

fun maxAge(control: String): Int {
    val offset = textIndex(control, "max-age=")
    if (offset < 0) return 0
    val bytes = bytesFromText(control)
    if (offset > 0) {
        val preceding = bytesGet(bytes, offset - 1)
        if (preceding != 32 && preceding != 44) return 0
    }
    var i = offset + 8
    var age = 0
    val size = bytesLength(bytes)
    while (i < size) {
        val digit = bytesGet(bytes, i)
        if (digit < 48 || digit > 57) break
        age = age * 10 + digit - 48
        if (age > 180) age = 180
        i = i + 1
    }
    if (i == offset + 8 || age == 0) return 0
    while (i < size && bytesGet(bytes, i) == 32) i = i + 1
    if (i < size) {
        if (bytesGet(bytes, i) != 44) return 0
        if (textIndex(textSlice(control, i, size - i), "max-age=") >= 0) return 0
    }
    return age
}

fun main() {
    if (eventMethod() != "UDP") return
    val packet = eventBody()
    if (textHeader(packet, "") != "NOTIFY * HTTP/1.1") return
    if (textLower(textHeader(packet, "HOST")) != "239.255.255.250:1900") return
    val nts = textLower(textHeader(packet, "NTS"))
    if (nts != "ssdp:alive" && nts != "ssdp:update" && nts != "ssdp:byebye") return
    val nt = textLower(textHeader(packet, "NT"))
    if (nt == "") return
    val usn = textLower(textHeader(packet, "USN"))
    val address = eventPeer()
    var key = ""
    var name = ""
    var deviceType = "unknown"
    var age = 180
    if (textIndex(usn, "uuid:") == 0) {
        val size = bytesLength(bytesFromText(usn))
        if (size < 41) return
        if (size == 41) {
            if (usn != nt) return
        } else {
            if (size < 44 || textSlice(usn, 41, 2) != "::") return
            if (textSlice(usn, 43, size - 43) != nt) return
        }
        val uuid = textSlice(usn, 5, 36)
        if (!validUuid(uuid)) return
        key = "ssdp:" + uuid
        name = "SSDP " + uuid
        if (nts != "ssdp:byebye") {
            age = maxAge(textLower(textHeader(packet, "CACHE-CONTROL")))
            if (age == 0) return
        }
    } else {
        if (usn != "" || textIndex(nt, "urn:microsoft:mediaroom:") != 0) return
        if (bytesLength(bytesFromText(nt)) > 64) return
        key = "ssdp:mediaroom:" + address
        name = "Mediaroom " + address
        deviceType = nt
    }
    if (nts == "ssdp:byebye") {
        cacheRemove("ssdp-devices", key)
        return
    }
    var device = jsonSetText("{}", "name", name)
    device = jsonSetText(device, "protocol", "ssdp")
    device = jsonSetText(device, "address", address)
    device = jsonSetText(device, "deviceType", deviceType)
    cachePut("ssdp-devices", key, device, age * 1000)
}
