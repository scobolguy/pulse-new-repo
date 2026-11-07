import pulse.http.HttpGet

fun status(): String = "{\"status\":\"ok\"}"

@HttpGet("/api/kotlin/status")
fun getStatus(): String = status()

@HttpGet("/api/kotlin/version")
fun getVersion(): String = "{\"version\":1}"
