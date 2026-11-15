import pulse.host.*
import pulse.net.*

const val BLUETOOTH_DEVICE_TTL_MS = 120000

fun main() {
    val discovered = bluetoothScan(3)
    var index = 0
    while (index < jsonArrayCount(discovered)) {
        val item = jsonArrayGet(discovered, index)
        val address = jsonText(item, "address")
        if (address != "") {
            val cacheKey = "ble:" + address
            var cursor = cacheNext("bluetooth-devices", "")
            while (cursor != "" && cursor != cacheKey) {
                cursor = cacheNext("bluetooth-devices", cursor)
            }
            if (cacheCount("bluetooth-devices") < 50 || cursor == cacheKey) {
                var device = jsonSetText("{}", "name", jsonText(item, "name"))
                device = jsonSetText(device, "address", address)
                device = jsonSetText(device, "protocol", "bluetooth-le")
                device = jsonSetText(device, "rssi", jsonText(item, "rssi"))
                device = jsonSetText(device, "serviceUuid", jsonText(item, "serviceUuid"))
                device = jsonSetText(device, "manufacturerData", jsonText(item, "manufacturerData"))
                device = jsonSetText(device, "deviceType", jsonText(item, "deviceType"))
                device = jsonSetText(device, "classificationReason", jsonText(item, "classificationReason"))
                cachePut("bluetooth-devices", cacheKey, device, BLUETOOTH_DEVICE_TTL_MS)
            }
        }
        index = index + 1
    }
}
