import pulse.process.*

fun main() {
    val state: String = restoreCheckpoint("helloBye", "latest")
    if (state == "start") {
        println("Hello")
        checkpointProcess("helloBye", "afterHello", "{}")
    } else if (state == "afterHello") {
        println("Bye")
    } else {
        throw "Invalid helloBye checkpoint state"
    }
}
