import pulse.http.HttpGet
import pulse.http.HttpPost
import pulse.http.requestBody
import pulse.http.requestQuery
import pulse.pmachine.checkpoint
import pulse.pmachine.installBundle
import pulse.pmachine.networkReady
import pulse.pmachine.restore
import pulse.pmachine.start
import pulse.pmachine.status
import pulse.pmachine.stop

@HttpGet("/api/pmachine/status")
fun statusRoute(): String = status()

@HttpGet("/api/pmachine/network")
fun networkReadyRoute(): String = networkReady()

@HttpPost("/api/pmachine/programs")
fun installRoute(): String = installBundle(requestQuery("fileName"), requestBody())

@HttpPost("/api/pmachine/start")
fun startRoute(): String = start(requestQuery("slot"), requestQuery("fileName"))

@HttpPost("/api/pmachine/stop")
fun stopRoute(): String = stop(requestQuery("slot"))

@HttpPost("/api/pmachine/checkpoint")
fun checkpointRoute(): String =
    checkpoint(requestQuery("taskId"), requestQuery("state"), requestBody())

@HttpPost("/api/pmachine/restore")
fun restoreRoute(): String =
    restore(requestQuery("taskId"), requestQuery("checkpointId"))
