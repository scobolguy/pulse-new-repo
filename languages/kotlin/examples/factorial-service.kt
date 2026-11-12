import pulse.http.HttpGet
import pulse.http.requestQuery

@HttpGet("/api/factorial")
fun factorial(): String {
    val input: String = requestQuery("n")
    val n: Int = when (input) {
        "1" -> 1
        "2" -> 2
        "3" -> 3
        "4" -> 4
        "5" -> 5
        "6" -> 6
        "7" -> 7
        "8" -> 8
        "9" -> 9
        "10" -> 10
        else -> 0
    }
    if (n == 0) return "{\"error\":\"n must be an integer from 1 through 10\"}"
    var result: Int = 1
    var factor: Int = 2
    while (factor <= n) {
        result = result * factor
        factor = factor + 1
    }
    return "{\"n\":" + n.toString() + ",\"factorial\":" + result.toString() + "}"
}
