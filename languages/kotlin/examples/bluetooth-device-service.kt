import pulse.host.*
import pulse.http.*

@HttpGet("/api/bluetooth/devices")
fun devices(): String =
    cacheSnapshot("bluetooth-devices", requestQuery("cursor"), requestQuery("revision"))

@HttpGet("/health")
fun health(): String =
    "{\"status\":\"ok\",\"service\":\"bluetooth-device-cache\",\"runtime\":\"kotlin-hosted\"}"
