import pulse.http.*
import pulse.net.*

// The Kasa protocol uses a four-byte big-endian payload length followed by
// an XOR-encrypted JSON request. The response is returned as hexadecimal bytes.
@HttpGet("/api/kasa")
fun kasa(): String = tcpExchange(
  requestQuery("ip"),
  9999,
  "0000001dd0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf0",
  4,
  1500,
  2048
)
