import pulse.net.networkDiscoveryStep

/*
 * Pulse network discovery daemon.
 *
 * The native host binding advances one ten-address camera batch per call. It keeps
 * the scan cursor and five-minute cooldown outside this program. The hosted
 * daemon scheduler invokes this unit once per second, so returning
 * here lets the pmachine scheduler run other work between batches.
 */
fun main() {
    println(networkDiscoveryStep())
}
