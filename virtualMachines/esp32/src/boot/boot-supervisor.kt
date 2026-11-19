import pulse.boot.*
import pulse.host.*

fun main() {
    val now = bootMillis()
    val profileCount = bootProfileCount()
    if (now < 0) {
        raiseError("Invalid signed boot clock value")
        return
    }
    if (profileCount < 0) {
        bootLog("Invalid negative Wi-Fi profile count")
        raiseError("Invalid Wi-Fi profile count")
        return
    }

    if (bootStateGet(0) == 0) {
        bootStateSet(0, 1)
        bootStateSet(1, 0)
        bootStateSet(2, 0)
        bootStateSet(3, now)
        bootStateSet(4, 0)
        bootStateSet(5, now)
        bootStateSet(6, 0)
        bootStateSet(7, now)
        bootStateSet(8, 0)
        bootStateSet(9, now)
        bootStateSet(10, 0)
        bootStateSet(11, 0)
        bootStateSet(12, now)
        bootStateSet(13, profileCount)
        bootStateSet(14, now)
        bootStateSet(15, 0)
        bootStateSet(16, 0)
        bootStateSet(31, 0)
        if (profileCount == 0) bootLog("No saved Wi-Fi profiles; entering provisioning")
    }

    if (profileCount != bootStateGet(13)) {
        bootStateSet(13, profileCount)
        bootStateSet(1, 0)
        bootStateSet(2, 0)
        bootStateSet(4, 0)
        bootStateSet(5, now)
        bootStateSet(6, 0)
        bootLog("Saved Wi-Fi profile list changed; retrying profile sweep")
    }

    val connected = bootWifiConnected()
    if (connected != 0 && connected != 1) {
        raiseError("Invalid boot Wi-Fi-connected result")
        return
    }

    var elapsed = 0
    var delay = 0
    var selected = -1
    var started = 0
    var result = 0
    var active = 0
    var attempted = 0
    var failures = 0
    var skip = 0

    if (connected == 1) {
        bootStateSet(31, 1)
        if (bootStateGet(11) == 0) {
            bootStateSet(11, 1)
            bootStateSet(12, now)
            bootStateSet(1, 0)
            bootStateSet(2, 0)
            bootStateSet(4, 0)
            bootStateSet(6, 0)
            bootLog("Wi-Fi associated; starting filesystem")
        }

        result = bootFfsReady()
        if (result != 0 && result != 1) {
            raiseError("Invalid boot FFS-ready result")
            return
        }
        if (result == 1) {
            bootStateSet(8, 1)
            bootStateSet(10, 0)
        } else {
            delay = bootStateGet(10)
            elapsed = now - bootStateGet(9)
            if (now < bootStateGet(9)) {
                elapsed = (2147483647 - bootStateGet(9)) + now + 1
            }
            if (delay == 0 || elapsed >= delay) {
                val remoteConfigured = bootRemoteConfigured()
                if (remoteConfigured != 0 && remoteConfigured != 1) {
                    raiseError("Invalid boot remote-configured result")
                    return
                }
                if (remoteConfigured == 1) {
                    started = bootFfsStart(2)
                    if (started != 0 && started != 1) {
                        raiseError("Invalid boot FFS-start result")
                        return
                    }
                    if (started == 1) selected = 2
                } else {
                    started = bootFfsStart(0)
                    if (started != 0 && started != 1) {
                        raiseError("Invalid boot FFS-start result")
                        return
                    }
                    if (started == 1) {
                        selected = 0
                    } else {
                        started = bootFfsStart(1)
                        if (started != 0 && started != 1) {
                            raiseError("Invalid boot FFS-start result")
                            return
                        }
                        if (started == 1) {
                            selected = 1
                        } else {
                            val remoteAvailable = bootRemoteAvailable()
                            if (remoteAvailable != 0 && remoteAvailable != 1) {
                                raiseError("Invalid boot remote-available result")
                                return
                            }
                            if (remoteAvailable == 1) {
                                started = bootFfsStart(2)
                                if (started != 0 && started != 1) {
                                    raiseError("Invalid boot FFS-start result")
                                    return
                                }
                                if (started == 1) selected = 2
                            }
                        }
                    }
                }

                bootStateSet(9, now)
                delay = bootStateGet(10)
                if (delay == 0) {
                    delay = 2000
                } else if (delay >= 15000) {
                    delay = 30000
                } else {
                    delay = delay * 2
                }
                bootStateSet(10, delay)
                if (selected >= 0) {
                    bootStateSet(8, 1)
                    if (selected == 0) {
                        bootLog("FFS started from SD")
                    } else if (selected == 1) {
                        bootLog("FFS started from LittleFS")
                    } else {
                        bootLog("FFS started from remote backend")
                    }
                } else {
                    bootLog("FFS startup failed; retry scheduled")
                }
            }
        }

        active = bootApActive()
        if (active != 0 && active != 1) {
            raiseError("Invalid boot AP-active result")
            return
        }
        elapsed = now - bootStateGet(12)
        if (now < bootStateGet(12)) {
            elapsed = (2147483647 - bootStateGet(12)) + now + 1
        }
        if (active == 1 && elapsed >= 3000) {
            attempted = bootStateGet(16)
            elapsed = now - bootStateGet(14)
            if (now < bootStateGet(14)) {
                elapsed = (2147483647 - bootStateGet(14)) + now + 1
            }
            if (attempted == 0 || elapsed >= 2000) {
                bootStateSet(14, now)
                bootStateSet(16, 1)
                result = bootApStop()
                if (result != 0 && result != 1) {
                    raiseError("Invalid boot AP-stop result")
                    return
                }
                if (result == 1) bootLog("Provisioning AP stopped after connection grace")
                else bootLog("Provisioning AP stop failed; retry scheduled")
            }
        }
        return
    }

    if (bootStateGet(11) == 1) {
        bootStateSet(11, 0)
        bootStateSet(1, 0)
        bootStateSet(2, 0)
        bootStateSet(4, 0)
        bootStateSet(5, now)
        bootStateSet(6, 0)
        bootLog("Wi-Fi disconnected; preserving profiles and retrying")
    }

    if (profileCount == 0) {
        active = bootApActive()
        if (active != 0 && active != 1) {
            raiseError("Invalid boot AP-active result")
            return
        }
        if (active == 1) bootStateSet(31, 1)
        attempted = bootStateGet(15)
        elapsed = now - bootStateGet(7)
        if (now < bootStateGet(7)) {
            elapsed = (2147483647 - bootStateGet(7)) + now + 1
        }
        if (active == 0 && (attempted == 0 || elapsed >= 5000)) {
            bootStateSet(7, now)
            bootStateSet(15, 1)
            result = bootApStart()
            if (result != 0 && result != 1) {
                raiseError("Invalid boot AP-start result")
                return
            }
            if (result == 1) {
                bootLog("Provisioning AP start accepted")
            } else {
                bootLog("Provisioning AP start failed; retry scheduled")
            }
        }
        return
    }

    if (bootStateGet(2) == 1) {
        elapsed = now - bootStateGet(3)
        if (now < bootStateGet(3)) {
            elapsed = (2147483647 - bootStateGet(3)) + now + 1
        }
        if (elapsed >= 15000) {
            bootLog("Wi-Fi profile connection deadline expired")
            bootStateSet(2, 0)
            if (bootStateGet(1) + 1 >= profileCount) {
                failures = bootStateGet(4)
                if (failures < 12) failures = failures + 1
                bootStateSet(4, failures)
                bootStateSet(1, 0)
                bootStateSet(5, now)
                delay = bootStateGet(6)
                if (failures <= 1 || delay == 0) delay = 5000
                else if (delay >= 30000) delay = 60000
                else delay = delay * 2
                bootStateSet(6, delay)
                bootLog("Saved Wi-Fi profile sweep failed; provisioning fallback enabled")
            } else {
                bootStateSet(1, bootStateGet(1) + 1)
            }
        }
    } else {
        skip = 0
        delay = bootStateGet(6)
        if (bootStateGet(1) == 0 && delay > 0) {
            elapsed = now - bootStateGet(5)
            if (now < bootStateGet(5)) {
                elapsed = (2147483647 - bootStateGet(5)) + now + 1
            }
            if (elapsed < delay) skip = 1
        }

        if (skip == 0) {
            if (bootStateGet(1) >= profileCount) bootStateSet(1, 0)
            result = bootProfileStart(bootStateGet(1))
            if (result != 0 && result != 1) {
                raiseError("Invalid boot profile-start result")
                return
            }
            if (result == 1) {
                bootStateSet(2, 1)
                bootStateSet(3, now)
                bootLog("Started saved Wi-Fi profile connection attempt")
            } else {
                bootLog("Saved Wi-Fi profile start failed")
                if (bootStateGet(1) + 1 >= profileCount) {
                    failures = bootStateGet(4)
                    if (failures < 12) failures = failures + 1
                    bootStateSet(4, failures)
                    bootStateSet(1, 0)
                    bootStateSet(5, now)
                    delay = bootStateGet(6)
                    if (failures <= 1 || delay == 0) delay = 5000
                    else if (delay >= 30000) delay = 60000
                    else delay = delay * 2
                    bootStateSet(6, delay)
                    bootLog("Saved Wi-Fi profile sweep failed; provisioning fallback enabled")
                } else {
                    bootStateSet(1, bootStateGet(1) + 1)
                }
            }
        }
    }

    if (bootStateGet(4) > 0) {
        active = bootApActive()
        if (active != 0 && active != 1) {
            raiseError("Invalid boot AP-active result")
            return
        }
        if (active == 1) bootStateSet(31, 1)
        attempted = bootStateGet(15)
        elapsed = now - bootStateGet(7)
        if (now < bootStateGet(7)) {
            elapsed = (2147483647 - bootStateGet(7)) + now + 1
        }
        if (active == 0 && (attempted == 0 || elapsed >= 5000)) {
            bootStateSet(7, now)
            bootStateSet(15, 1)
            result = bootApStart()
            if (result != 0 && result != 1) {
                raiseError("Invalid boot AP-start result")
                return
            }
            if (result == 1) {
                bootLog("Provisioning AP start accepted")
            } else {
                bootLog("Provisioning AP start failed; retry scheduled")
            }
        }
    }
}
