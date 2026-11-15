import pulse.host.*
import pulse.net.*

fun main() {
    println("[AGG DEBUG] standalone program started")
    val subnets = localIpv4Subnets()
    println("[AGG DEBUG] local subnets received")
    val hosts = localIpv4Batch(0, 10)
    println("[AGG DEBUG] local address batch received")
    println("[AGG DEBUG] standalone program completed")
}
