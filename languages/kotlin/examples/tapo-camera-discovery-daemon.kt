import pulse.host.*
import pulse.net.*

const val CAMERA_TTL_MS = 360000

fun main() {
    val discovered = cameraDiscover()
    var index = 0
    while (index < jsonArrayCount(discovered)) {
        val item = jsonArrayGet(discovered, index)
        val address = jsonText(item, "address")
        val protocol = jsonText(item, "protocol")
        val port = jsonInteger(item, "port").toString()
        val serviceUrl = jsonText(item, "serviceUrl")
        if (address != "" && protocol == "onvif" && serviceUrl != "") {
            val cacheKey = "camera:" + protocol + ":" + address + ":" + port
            if (cacheCount("cameras") < 50 || cacheGet("cameras", cacheKey) != "") {
                var camera = jsonSetText("{}", "name", "ONVIF camera " + address)
                camera = jsonSetText(camera, "protocol", protocol)
                camera = jsonSetText(camera, "address", address)
                camera = jsonSetText(camera, "port", port)
                camera = jsonSetText(camera, "serviceUrl", serviceUrl)
                camera = jsonSetText(camera, "deviceType", "tapo-camera")
                cachePut("cameras", cacheKey, camera, CAMERA_TTL_MS)
            }
        }
        index = index + 1
    }
}
