import pulse.host.*
import pulse.http.*

@HttpGet("/api/network/devices/snapshot")
fun snapshot(): String =
    cacheSnapshot("network-devices", requestQuery("cursor"), requestQuery("revision"))

@HttpGet("/api/network/devices/count")
fun count(): String =
    jsonSetInteger("{}", "count", cacheCount("network-devices"))

@HttpGet("/health")
fun health(): String = "{\"status\":\"ok\",\"service\":\"network-devices\",\"runtime\":\"kotlin-hosted\"}"
