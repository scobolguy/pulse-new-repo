import pulse.host.*
import pulse.net.*

fun main() {
    println("[TUYA DEBUG] standalone program started")
    udpSend("255.255.255.255", 6666, "00")
    udpSend("255.255.255.255", 6667, "00")
    println("[TUYA DEBUG] standalone program completed")
}
