import pulse.boot.*
import pulse.host.*

fun boolLike(value: String, defaultValue: Int): Int {
    val normalized = bootTextLower(bootTextTrim(value))
    if (normalized.length == 0) return defaultValue
    if (normalized == "1" || normalized == "true" || normalized == "yes" || normalized == "on") return 1
    return 0
}

fun jsonBoolean(value: Int): String {
    if (value == 1) return "true"
    return "false"
}

fun normalizeAuthMode(value: String): String {
    val normalized = bootTextLower(bootTextTrim(value))
    if (normalized.length == 0) return "wpa2-psk"
    if (normalized == "wpa2-enterprise" || normalized == "enterprise" || normalized == "wpa-eap") {
        return "wpa2-enterprise"
    }
    return "wpa2-psk"
}

fun scannedNetworks(): String {
    val total = bootWifiScanCount()
    if (total < 0) {
        var errorBody = jsonEmbed("{}", "ok", "false")
        errorBody = jsonSetText(errorBody, "method", "wifi_scanner")
        errorBody = jsonEmbed(errorBody, "networks", "[]")
        errorBody = jsonSetInteger(errorBody, "count", 0)
        bootProvisionRespond(500, errorBody, 0)
        return ""
    }

    var networks = "["
    var count = 0
    var index = 0
    while (index < total) {
        val ssid = bootWifiScanSsid(index)
        if (ssid.length > 0) {
            if (count > 0) networks = networks + ","
            var network = jsonSetText("{}", "ssid", ssid)
            network = jsonSetInteger(network, "rssi", bootWifiScanRssi(index))
            network = jsonSetInteger(network, "channel", bootWifiScanChannel(index))
            network = jsonEmbed(network, "secure", jsonBoolean(bootWifiScanSecure(index)))
            networks = networks + network
            count = count + 1
        }
        index = index + 1
    }
    networks = networks + "]"
    var body = jsonEmbed("{}", "ok", "true")
    body = jsonSetText(body, "method", "wifi_scanner")
    body = jsonEmbed(body, "networks", networks)
    body = jsonSetInteger(body, "count", count)
    bootProvisionRespond(200, body, 0)
    return ""
}

fun profilesJson(): String {
    val count = bootProfileCount()
    var profiles = "["
    var index = 0
    while (index < count) {
        if (index > 0) profiles = profiles + ","
        var profile = jsonSetText("{}", "ssid", bootWifiProfileField(index, "ssid"))
        profile = jsonSetText(profile, "hostname", bootWifiProfileField(index, "hostname"))
        profile = jsonSetText(profile, "authMode", normalizeAuthMode(bootWifiProfileField(index, "authMode")))
        profile = jsonSetText(profile, "eapMethod", bootWifiProfileField(index, "eapMethod"))
        profile = jsonSetText(profile, "identity", bootWifiProfileField(index, "identity"))
        profile = jsonSetText(profile, "username", bootWifiProfileField(index, "username"))
        profile = jsonEmbed(profile, "dhcp", jsonBoolean(boolLike(bootWifiProfileField(index, "dhcp"), 1)))
        profile = jsonEmbed(profile, "hasPassword", jsonBoolean(bootWifiProfileHasPassword(index, 0)))
        profile = jsonEmbed(profile, "hasEnterprisePassword", jsonBoolean(bootWifiProfileHasPassword(index, 1)))
        profile = jsonSetText(profile, "staticIP", bootWifiProfileField(index, "staticIP"))
        profiles = profiles + profile
        index = index + 1
    }
    profiles = profiles + "]"
    var body = jsonEmbed("{}", "ok", "true")
    body = jsonSetInteger(body, "count", count)
    body = jsonEmbed(body, "profiles", profiles)
    bootProvisionRespond(200, body, 0)
    return ""
}

fun saveProfile(): String {
    val ssid = bootProvisionParam("ssid")
    if (ssid.length == 0) {
        bootProvisionRespond(400, jsonSetText("{}", "error", "ssid is required"), 0)
        return ""
    }

    val authMode = normalizeAuthMode(bootProvisionParam("authMode"))
    val password = bootProvisionParam("password")
    val eapMethod = bootProvisionParam("eapMethod")
    val identity = bootProvisionParam("identity")
    val username = bootProvisionParam("username")
    var enterprisePassword = bootProvisionParam("enterprisePassword")
    if (authMode == "wpa2-enterprise" && enterprisePassword.length == 0) {
        enterprisePassword = password
    }
    var hostname = bootProvisionParam("hostname")
    val requestedNodeName = bootProvisionParam("nodeName")
    val dhcp = boolLike(bootProvisionParam("dhcp"), 1)
    var nodeName = bootCurrentNodeName()
    if (requestedNodeName.length > 0) {
        nodeName = bootSaveNodeName(requestedNodeName)
        if (nodeName.length == 0) {
            bootProvisionRespond(400, jsonSetText("{}", "error", "invalid nodeName"), 0)
            return ""
        }
        if (hostname.length == 0) hostname = nodeName
    }

    var staticIP = ""
    var gateway = ""
    var subnet = ""
    var dns1 = ""
    var dns2 = ""
    if (dhcp == 0) {
        staticIP = bootProvisionParam("staticIP")
        gateway = bootProvisionParam("gateway")
        subnet = bootProvisionParam("subnet")
        dns1 = bootProvisionParam("dns1")
        dns2 = bootProvisionParam("dns2")
    }

    val saved = bootSaveWifiProfile(ssid, password, authMode, eapMethod, identity, username,
        enterprisePassword, hostname, dhcp, staticIP, gateway, subnet, dns1, dns2)
    if (saved != 1) {
        bootProvisionRespond(500, jsonSetText("{}", "error", "failed to save WiFi credentials"), 0)
        return ""
    }

    val profilesStored = bootProfileCount()
    val reboot = boolLike(bootProvisionParam("reboot"), 0)
    var body = jsonEmbed("{}", "ok", "true")
    body = jsonSetText(body, "ssid", ssid)
    body = jsonSetText(body, "authMode", authMode)
    body = jsonSetText(body, "eapMethod", eapMethod)
    body = jsonSetText(body, "identity", identity)
    body = jsonSetText(body, "username", username)
    body = jsonSetText(body, "hostname", hostname)
    body = jsonSetText(body, "nodeName", nodeName)
    body = jsonEmbed(body, "saved", "true")
    body = jsonSetInteger(body, "profilesStored", profilesStored)
    body = jsonEmbed(body, "rebooting", jsonBoolean(reboot))
    bootProvisionRespond(200, body, reboot)
    return ""
}

fun clearProfiles(): String {
    val removed = bootClearWifiProfiles()
    var body = jsonEmbed("{}", "ok", jsonBoolean(removed))
    body = jsonEmbed(body, "cleared", jsonBoolean(removed))
    if (removed == 1) {
        body = jsonSetText(body, "status", "wifi_profiles_cleared")
        bootProvisionRespond(200, body, 0)
    } else {
        body = jsonSetText(body, "status", "clear_failed")
        bootProvisionRespond(500, body, 0)
    }
    return ""
}

fun main() {
    val method = bootProvisionMethod()
    val path = bootProvisionPath()
    if (path == "/api/wifi/scan" && method == "GET") {
        scannedNetworks()
        return
    }
    if (path == "/api/wifi/provision" && method == "POST") {
        saveProfile()
        return
    }
    if (path == "/api/wifi/profiles" && method == "GET") {
        profilesJson()
        return
    }
    if (path == "/api/wifi/profiles" && method == "DELETE") {
        clearProfiles()
        return
    }
    bootProvisionRespond(405, jsonSetText("{}", "error", "method not allowed"), 0)
}
