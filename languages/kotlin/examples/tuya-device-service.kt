import pulse.host.*
import pulse.http.*

@HttpGet("/api/tuya/devices/snapshot")
fun snapshot(): String =
    cacheSnapshot("tuya-devices", requestQuery("cursor"), requestQuery("revision"))

@HttpGet("/api/tuya/devices/names")
fun names(): String {
    var body = jsonSetInteger("{}", "count", cacheCount("tuya-devices"))
    body = jsonEmbed(body, "names", "[]")
    var cursor = cacheNext("tuya-devices", requestQuery("cursor"))
    var last = ""
    var listed = 0
    while (cursor != "" && listed < 10) {
        val device = cacheGet("tuya-devices", cursor)
        body = jsonAppendText(body, "names", jsonText(device, "name"))
        listed = listed + 1
        last = cursor
        cursor = cacheNext("tuya-devices", cursor)
    }
    if (cursor == "") {
        body = jsonSetText(body, "continuation", "end")
        return jsonSetText(body, "nextCursor", "")
    }
    body = jsonSetText(body, "continuation", "continue")
    return jsonSetText(body, "nextCursor", last)
}

@HttpGet("/health")
fun health(): String =
    "{\"status\":\"ok\",\"service\":\"tuya-device-cache\",\"runtime\":\"kotlin-hosted\"}"
