import pulse.host.*
import pulse.http.*

@HttpGet("/api/cameras/snapshot")
fun snapshot(): String =
    cacheSnapshot("cameras", requestQuery("cursor"), requestQuery("revision"))

@HttpGet("/api/cameras/names")
fun names(): String {
    var body = jsonSetInteger("{}", "count", cacheCount("cameras"))
    body = jsonEmbed(body, "names", "[]")
    var cursor = cacheNext("cameras", requestQuery("cursor"))
    var last = ""
    var listed = 0
    while (cursor != "" && listed < 10) {
        body = jsonAppendText(body, "names", jsonText(cacheGet("cameras", cursor), "name"))
        body = jsonAppendText(body, "names", jsonText(cacheGet("cameras", cursor), "address"))
        listed = listed + 1
        last = cursor
        cursor = cacheNext("cameras", cursor)
    }
    if (cursor == "") {
        body = jsonSetText(body, "continuation", "end")
        return jsonSetText(body, "nextCursor", "")
    }
    body = jsonSetText(body, "continuation", "continue")
    return jsonSetText(body, "nextCursor", last)
}

@HttpGet("/health")
fun health(): String = "{\"status\":\"ok\",\"service\":\"tapo-camera-cache\",\"runtime\":\"kotlin-hosted\"}"
