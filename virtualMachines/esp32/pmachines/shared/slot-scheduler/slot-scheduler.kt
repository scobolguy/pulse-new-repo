import pulse.scheduler.*
import pulse.host.*

fun respondError(status: Int, message: String): Int {
    var error = jsonSetInteger("{}", "version", 1)
    error = jsonSetText(error, "error", message)
    return schedulerRespond(status, error)
}

fun validSlot(slot: Int): Int {
    if (slot == 0) {
        respondError(403, "Slot 0 is reserved for the scheduler")
        return 0
    }
    if (slot < 1 || slot > 16) {
        respondError(400, "Slot must be between 1 and 16")
        return 0
    }
    return 1
}

fun persistent(descriptor: String): Int {
    val kind = jsonText(descriptor, "kind")
    if (kind == "service" || kind == "daemon") return 1
    return 0
}

fun snapshot(excluded: Int): String {
    var entries = "[]"
    var index = 1
    while (index <= 16) {
        val descriptor = schedulerSlot(index)
        if (index != excluded && descriptor != "{}") {
            if (persistent(descriptor) == 1) entries = jsonArrayAppend(entries, descriptor)
        }
        index = index + 1
    }
    return jsonEmbed("{\"version\":1}", "slots", entries)
}

fun status(): Int {
    var entries = "[{\"slot\":0,\"id\":\"pulse-slot-scheduler\",\"kind\":\"daemon\",\"protected\":true,\"state\":\"running\"}]"
    var index = 1
    while (index <= 16) {
        var descriptor = schedulerSlot(index)
        if (descriptor == "{}") {
            descriptor = jsonSetInteger("{\"state\":\"empty\"}", "slot", index)
        } else {
            descriptor = jsonSetText(descriptor, "state", "running")
        }
        entries = jsonArrayAppend(entries, descriptor)
        index = index + 1
    }
    return schedulerRespond(200, jsonEmbed("{\"version\":1}", "slots", entries))
}

fun load(request: String): Int {
    var slot = -1
    if (jsonHas(request, "slot") == 1) {
        slot = jsonInteger(request, "slot")
        if (validSlot(slot) == 0) return 0
    }
    val manifestPath = jsonText(request, "manifestPath")
    if (manifestPath.length == 0) return respondError(400, "manifestPath is required")
    val manifest = schedulerRead(manifestPath)
    if (jsonKind(manifest) != "object") return respondError(400, "Expected a bundle manifest object")
    val kind = jsonText(manifest, "type")
    if (kind != "service" && kind != "daemon" && kind != "transient") {
        return respondError(400, "Expected a service, daemon or transient program")
    }
    var index = 1
    var freeSlot = -1
    while (index <= 16) {
        val existing = schedulerSlot(index)
        if (existing == "{}") {
            if (freeSlot == -1) freeSlot = index
        } else {
            if (jsonText(existing, "manifestPath") == manifestPath) {
                return respondError(409, "Program is already loaded")
            }
        }
        index = index + 1
    }
    if (slot == -1) slot = freeSlot
    if (slot == -1) return respondError(409, "All program slots are occupied")
    if (schedulerSlot(slot) != "{}") return respondError(409, "Slot is already occupied")
    var descriptor = jsonSetInteger("{}", "slot", slot)
    descriptor = jsonSetText(descriptor, "manifestPath", manifestPath)
    descriptor = jsonSetText(descriptor, "kind", kind)
    descriptor = jsonEmbed(descriptor, "manifest", manifest)
    var oldState = ""
    var newState = ""
    if (kind != "transient") {
        oldState = snapshot(-1)
        val savedSlots = jsonArrayAppend(jsonValue(oldState, "slots"), descriptor)
        newState = jsonEmbed("{\"version\":1}", "slots", savedSlots)
    }
    val staged = schedulerStage(slot, descriptor)
    if (staged != 200) return respondError(staged, schedulerError())
    if (kind != "transient") {
        if (schedulerCommit(newState) != 1) {
            val writeError = schedulerError()
            if (schedulerRemove(slot) != 200) return respondError(503, "Persistence and staging cleanup failed")
            return respondError(503, writeError)
        }
    }
    val activated = schedulerActivate(slot)
    if (activated != 200) {
        val activationError = schedulerError()
        if (schedulerRemove(slot) != 200) return respondError(503, "Activation and staging cleanup failed")
        if (kind != "transient") {
            if (schedulerCommit(oldState) != 1) return respondError(503, "Activation rollback could not be persisted")
        }
        return respondError(activated, activationError)
    }
    var result = jsonSetInteger("{\"version\":1}", "slot", slot)
    result = jsonSetText(result, "manifestPath", manifestPath)
    result = jsonSetText(result, "kind", kind)
    if (kind == "transient") {
        if (schedulerRemove(slot) != 200) return respondError(503, "Completed transient could not be released")
        result = jsonSetText(result, "state", "completed")
    } else {
        result = jsonSetText(result, "state", "running")
    }
    return schedulerRespond(201, result)
}

fun unload(request: String): Int {
    val slot = jsonInteger(request, "slot")
    if (validSlot(slot) == 0) return 0
    val descriptor = schedulerSlot(slot)
    if (descriptor == "{}") return respondError(404, "Slot is empty")
    val oldState = snapshot(-1)
    val durable = persistent(descriptor)
    if (durable == 1) {
        if (schedulerCommit(snapshot(slot)) != 1) return respondError(503, schedulerError())
    }
    val removed = schedulerRemove(slot)
    if (removed != 200) {
        val removeError = schedulerError()
        if (durable == 1) {
            if (schedulerCommit(oldState) != 1) return respondError(503, "Unload rollback could not be persisted")
        }
        return respondError(removed, removeError)
    }
    var result = jsonSetInteger("{\"version\":1,\"state\":\"empty\"}", "slot", slot)
    return schedulerRespond(200, result)
}

fun restoreSlots(): Int {
    val saved = schedulerSavedState()
    if (jsonKind(saved) != "object" || jsonInteger(saved, "version") != 1) {
        return respondError(503, "Invalid scheduler state version")
    }
    val entries = jsonValue(saved, "slots")
    if (jsonKind(entries) != "array") return respondError(503, "Invalid saved slots")
    val count = jsonArrayCount(entries)
    if (count > 16) return respondError(503, "Too many saved slots")
    var index = 0
    var seen = "[]"
    // Validate the entire snapshot before starting any recovered program.
    while (index < count) {
        val descriptor = jsonArrayGet(entries, index)
        val slot = jsonInteger(descriptor, "slot")
        if (slot < 1 || slot > 16 || persistent(descriptor) == 0) {
            return respondError(503, "Invalid persistent slot descriptor")
        }
        if (jsonText(jsonValue(descriptor, "manifest"), "type") != jsonText(descriptor, "kind")) {
            return respondError(503, "Saved manifest kind mismatch")
        }
        var earlier = 0
        while (earlier < index) {
            val previous = jsonArrayGet(seen, earlier)
            if (jsonInteger(previous, "slot") == slot || jsonText(previous, "manifestPath") == jsonText(descriptor, "manifestPath")) {
                return respondError(503, "Duplicate saved slot or program")
            }
            earlier = earlier + 1
        }
        seen = jsonArrayAppend(seen, descriptor)
        index = index + 1
    }
    index = 0
    while (index < count) {
        val recovered = jsonArrayGet(entries, index)
        val target = jsonInteger(recovered, "slot")
        val current = schedulerSlot(target)
        if (current != "{}" && current != recovered) return respondError(409, "Recovery slot is occupied")
        index = index + 1
    }
    index = 0
    while (index < count) {
        val entry = jsonArrayGet(entries, index)
        val destination = jsonInteger(entry, "slot")
        if (schedulerSlot(destination) == "{}") {
            val stageStatus = schedulerStage(destination, entry)
            if (stageStatus != 200) return respondError(stageStatus, schedulerError())
            val startStatus = schedulerActivate(destination)
            if (startStatus != 200) {
                val startError = schedulerError()
                if (schedulerRemove(destination) != 200) return respondError(503, "Recovery cleanup failed")
                return respondError(startStatus, startError)
            }
        }
        index = index + 1
    }
    return status()
}

fun main() {
    val operation = schedulerOperation()
    if (operation == "status") {
        status()
        return
    }
    if (operation == "restore") {
        restoreSlots()
        return
    }
    val request = schedulerRequest()
    if (jsonKind(request) != "object") {
        respondError(400, "Expected a JSON request object")
        return
    }
    if (operation == "load") {
        load(request)
        return
    }
    if (operation == "unload") {
        unload(request)
        return
    }
    respondError(400, "Invalid scheduler operation")
}
