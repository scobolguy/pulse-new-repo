import pulse.host.*
import pulse.http.*

@Cache(name = "ssdp-devices", capacity = 50, ttlMs = 180000,
    fields = "name:string,protocol:string,address:string,deviceType:string")
class SsdpDevices {}

@HttpGet("/api/ssdp/devices/snapshot")
fun snapshot(): String =
    cacheSnapshot("ssdp-devices", requestQuery("cursor"), requestQuery("revision"))

@HttpGet("/api/ssdp/devices/names")
fun names(): String {
    var body = jsonSetInteger("{}", "count", cacheCount("ssdp-devices"))
    body = jsonEmbed(body, "names", "[]")
    var cursor = cacheNext("ssdp-devices", requestQuery("cursor"))
    var last = ""
    var listed = 0
    while (cursor != "" && listed < 10) {
        val device = cacheGet("ssdp-devices", cursor)
        body = jsonAppendText(body, "names", jsonText(device, "name"))
        listed = listed + 1
        last = cursor
        cursor = cacheNext("ssdp-devices", cursor)
    }
    if (cursor == "") {
        body = jsonSetText(body, "continuation", "end")
        return jsonSetText(body, "nextCursor", "")
    }
    body = jsonSetText(body, "continuation", "continue")
    return jsonSetText(body, "nextCursor", last)
}
