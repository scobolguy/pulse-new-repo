import pulse.host.*
import pulse.http.*

@HttpGet("/api/devices/snapshot")
fun snapshot(): String =
    cacheSnapshot("devices", requestQuery("cursor"), requestQuery("revision"))

@HttpGet("/api/devices/names")
fun names(): String {
    var body = jsonSetInteger("{}", "count", cacheCount("devices"))
    body = jsonEmbed(body, "names", "[]")
    var cursor = cacheNext("devices", requestQuery("cursor"))
    var last = ""
    var listed = 0
    while (cursor != "" && listed < 10) {
        body = jsonAppendText(body, "names", jsonText(cacheGet("devices", cursor), "name"))
        listed = listed + 1
        last = cursor
        cursor = cacheNext("devices", cursor)
    }
    if (cursor == "") {
        body = jsonSetText(body, "continuation", "end")
        return jsonSetText(body, "nextCursor", "")
    }
    body = jsonSetText(body, "continuation", "continue")
    return jsonSetText(body, "nextCursor", last)
}

@HttpGet("/health")
fun health(): String = "{\"status\":\"ok\",\"service\":\"device-cache\",\"runtime\":\"kotlin-hosted\"}"
