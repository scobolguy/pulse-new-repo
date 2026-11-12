import pulse.http.*
import pulse.net.*

/*
 * TP-Link Kasa discovery daemon.
 *
 * The caller supplies one IP address in the "ip" query parameter. Configure
 * that address and UDP port 9999 in the hosted service's network peer list.
 * Timeouts and denied peers are reported by the host rather than suppressed.
 */
const val KASA_DISCOVERY_PORT = 9999
const val KASA_TIMEOUT_MS = 500
const val KASA_MAX_RESPONSE_BYTES = 4096
const val KASA_DISCOVERY_PACKET_HEX = "d0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf08bf68bf6"

@HttpGet("/api/kasa/discover")
fun discover(): String {
    val address = requestQuery("ip")
    val response = udpExchange(address, KASA_DISCOVERY_PORT, KASA_DISCOVERY_PACKET_HEX, KASA_TIMEOUT_MS, KASA_MAX_RESPONSE_BYTES)
    return "{\"address\":\"$address\",\"responseHex\":\"$response\"}"
}
