import pulse.host.*
import pulse.net.*

const val AGGREGATOR_TTL_MS = 180000

fun main() {
    println("[AGG DEBUG] invocation method=" + eventMethod() + " port=" + eventPort().toString())
    if (eventMethod() == "UDP") {
        val address = eventPeer()
        val payload = eventBytes()
        println("[AGG DEBUG] UDP peer=" + address + " bytes=" + bytesLength(payload).toString())
        var record = jsonSetText("{}", "message", "udp-event")
        record = jsonSetText(record, "address", address)
        record = jsonSetText(record, "port", eventPort().toString())
        record = jsonSetText(record, "method", eventMethod())
        record = jsonSetText(record, "payloadHex", payload)
        println("[AGG DEBUG] writing cache record")
        cachePut("aggregator-debug", "event:" + address + ":" + eventPort().toString(),
            record, AGGREGATOR_TTL_MS)
        println("[AGG DEBUG] cache record written")
    } else {
        println("[AGG DEBUG] timer invocation")
    }
}
