import pulse.host.*
import pulse.http.*

@HttpGet("/api/debug/aggregator")
fun snapshot(): String =
    cacheSnapshot("aggregator-debug", requestQuery("cursor"), requestQuery("revision"))

@HttpGet("/health")
fun health(): String =
    "{\"status\":\"ok\",\"service\":\"debug-aggregator\",\"runtime\":\"kotlin-hosted\"}"
