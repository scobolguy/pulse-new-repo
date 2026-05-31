using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;

var root = Environment.GetEnvironmentVariable("PULSE_CTL_REPO_ROOT") ?? ResolveRepoRoot();
var mode = args.Length > 0 ? args[0].Trim().ToLowerInvariant() : "cycle";

var options = new LauncherOptions(
    RepoRoot: root,
    BackendUrl: Environment.GetEnvironmentVariable("PULSE_CTL_BACKEND_URL") ?? "http://127.0.0.1:4000/api/develop/files",
    FrontendUrl: Environment.GetEnvironmentVariable("PULSE_CTL_FRONTEND_URL") ?? "http://127.0.0.1:5173/",
    BackendPort: ReadIntEnv("PULSE_CTL_BACKEND_PORT", 4000),
    FrontendPort: ReadIntEnv("PULSE_CTL_FRONTEND_PORT", 5173),
    BackendFsmCommand: Environment.GetEnvironmentVariable("PULSE_CTL_BACKEND_FSM_CMD") ?? "npm run startup:fsm:backend",
    FrontendFsmCommand: Environment.GetEnvironmentVariable("PULSE_CTL_FRONTEND_FSM_CMD") ?? "npm run startup:fsm:frontend",
    FrontendRawCommand: Environment.GetEnvironmentVariable("PULSE_CTL_FRONTEND_RAW_CMD") ?? "npm run dev:raw -- --host 0.0.0.0 --port 5173 --strictPort --force",
    StatusPathBackend: Path.Combine(root, "data", "startup-fsm-status.json"),
    StatusPathFrontend: Path.Combine(root, "data", "frontend-startup-fsm-status.json")
);

try
{
    var result = mode switch
    {
        "stop" => await StopAsync(options),
        "start" => await StartAsync(options),
        "cycle" => await CycleAsync(options),
        "status" => await StatusAsync(options),
        _ => throw new InvalidOperationException($"Unknown mode '{mode}'. Use stop, start, cycle, or status.")
    };

    WriteResult(result);
    Environment.ExitCode = result.Ok ? 0 : 1;
}
catch (Exception ex)
{
    WriteResult(new ControlResult(false, "FAILED", ex.Message, null, null, null));
    Environment.ExitCode = 1;
}

static async Task<ControlResult> StopAsync(LauncherOptions options)
{
    var ports = new[] { options.BackendPort, options.FrontendPort, options.FrontendPort + 1 };
    var killed = await KillPortsAsync(ports);
    var closed = await WaitForClosedAsync(ports, 20000, 500);

    if (!closed)
    {
        return new ControlResult(false, "FAILED", "One or more ports remained occupied after stop.", options.BackendPort, options.FrontendPort, killed);
    }

    return new ControlResult(true, "STOPPED", "Ports are clear.", options.BackendPort, options.FrontendPort, killed);
}

static async Task<ControlResult> StartAsync(LauncherOptions options)
{
    var backend = await RunCommandAsync(options.BackendFsmCommand, options.RepoRoot);
    if (backend.ExitCode != 0)
    {
        return new ControlResult(false, "FAILED", $"Backend FSM failed: {backend.ExitCode}", options.BackendPort, options.FrontendPort, backend);
    }

    var frontend = await RunCommandAsync(options.FrontendFsmCommand, options.RepoRoot);
    if (frontend.ExitCode != 0)
    {
        return new ControlResult(false, "FAILED", $"Frontend FSM failed: {frontend.ExitCode}", options.BackendPort, options.FrontendPort, frontend);
    }

    var ok = await WaitForHealthyAsync(options.BackendUrl, options.FrontendUrl, 180000, 1000);
    if (!ok)
    {
        return new ControlResult(false, "FAILED", "Backend or frontend did not become healthy in time.", options.BackendPort, options.FrontendPort, new { backend, frontend });
    }

    return new ControlResult(true, "READY", "Backend and frontend are healthy.", options.BackendPort, options.FrontendPort, new { backend, frontend });
}

static async Task<ControlResult> CycleAsync(LauncherOptions options)
{
    var stop = await StopAsync(options);
    if (!stop.Ok)
    {
        return new ControlResult(false, "FAILED", stop.Message, options.BackendPort, options.FrontendPort, stop.Details);
    }

    var start = await StartAsync(options);
    if (!start.Ok)
    {
        return new ControlResult(false, "FAILED", start.Message, options.BackendPort, options.FrontendPort, start.Details);
    }

    return start;
}

static async Task<ControlResult> StatusAsync(LauncherOptions options)
{
    var backendReady = await IsHealthyAsync(options.BackendUrl);
    var frontendReady = await IsHealthyAsync(options.FrontendUrl);
    var state = backendReady && frontendReady ? "READY" : backendReady ? "BACKEND_ONLY" : frontendReady ? "FRONTEND_ONLY" : "OFFLINE";
    return new ControlResult(true, state, "Status check complete.", options.BackendPort, options.FrontendPort, new { backendReady, frontendReady });
}

static void WriteResult(ControlResult result)
{
    var payload = new
    {
        ok = result.Ok,
        state = result.State,
        message = result.Message,
        backendPort = result.BackendPort,
        frontendPort = result.FrontendPort,
        details = result.Details
    };

    Console.Out.WriteLine(JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = false }));
}

static string ResolveRepoRoot()
{
    var current = new DirectoryInfo(AppContext.BaseDirectory);
    while (current is not null)
    {
        if (File.Exists(Path.Combine(current.FullName, "package.json")) && Directory.Exists(Path.Combine(current.FullName, "scripts")))
        {
            return current.FullName;
        }

        current = current.Parent;
    }

    return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
}

static int ReadIntEnv(string name, int fallback)
    => int.TryParse(Environment.GetEnvironmentVariable(name), out var value) ? value : fallback;

static async Task<bool> IsHealthyAsync(string url)
{
    try
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        using var response = await client.GetAsync(url);
        return response.IsSuccessStatusCode;
    }
    catch
    {
        return false;
    }
}

static async Task<bool> WaitForHealthyAsync(string backendUrl, string frontendUrl, int timeoutMs, int pollMs)
{
    var deadline = DateTimeOffset.UtcNow.AddMilliseconds(timeoutMs);
    while (DateTimeOffset.UtcNow < deadline)
    {
        if (await IsHealthyAsync(backendUrl) && await IsHealthyAsync(frontendUrl))
        {
            return true;
        }

        await Task.Delay(pollMs);
    }

    return false;
}

static async Task<bool> WaitForClosedAsync(IEnumerable<int> ports, int timeoutMs, int pollMs)
{
    var deadline = DateTimeOffset.UtcNow.AddMilliseconds(timeoutMs);
    var portSet = ports.Distinct().ToArray();

    while (DateTimeOffset.UtcNow < deadline)
    {
        if (!portSet.Any(IsPortListening))
        {
            return true;
        }

        await Task.Delay(pollMs);
    }

    return !portSet.Any(IsPortListening);
}

static async Task<object> KillPortsAsync(IEnumerable<int> ports)
{
    var killed = new List<object>();
    var uniquePorts = ports.Distinct().ToArray();
    var pids = FindPidsUsingPorts(uniquePorts);

    foreach (var pid in pids)
    {
        try
        {
            var proc = Process.GetProcessById(pid);
            proc.Kill(entireProcessTree: true);
            killed.Add(new { pid, killed = true });
        }
        catch (Exception ex)
        {
            killed.Add(new { pid, killed = false, error = ex.Message });
        }
    }

    await Task.CompletedTask;
    return new { ports = uniquePorts, pids, results = killed };
}

static bool IsPortListening(int port)
    => FindPidsUsingPorts([port]).Any();

static List<int> FindPidsUsingPorts(IEnumerable<int> ports)
{
    var search = ports.Select(p => $":{p}").ToArray();
    var pids = new HashSet<int>();

    try
    {
        var psi = new ProcessStartInfo
        {
            FileName = "netstat",
            Arguments = "-ano -p tcp",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var proc = Process.Start(psi);
        if (proc is null) return [];

        var output = proc.StandardOutput.ReadToEnd();
        proc.WaitForExit();

        foreach (var line in output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var text = line.Trim();
            if (!text.Contains("LISTENING", StringComparison.OrdinalIgnoreCase) && !text.Contains("ESTABLISHED", StringComparison.OrdinalIgnoreCase)) continue;
            if (!search.Any(text.Contains)) continue;

            var parts = text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (!int.TryParse(parts.LastOrDefault(), out var pid) || pid <= 0) continue;
            pids.Add(pid);
        }
    }
    catch
    {
        return [];
    }

    return pids.ToList();
}

static async Task<CommandResult> RunCommandAsync(string command, string workingDirectory)
{
    var tokens = command.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    if (tokens.Length == 0)
    {
        throw new InvalidOperationException("Command was empty.");
    }

    var fileName = tokens[0];
    var arguments = string.Join(' ', tokens.Skip(1));

    if (fileName.Equals("npm", StringComparison.OrdinalIgnoreCase))
    {
        fileName = OperatingSystem.IsWindows() ? "npm.cmd" : "npm";
    }

    var psi = new ProcessStartInfo
    {
        FileName = fileName,
        Arguments = arguments,
        WorkingDirectory = workingDirectory,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
        CreateNoWindow = true
    };

    var output = new StringBuilder();
    var error = new StringBuilder();

    using var proc = Process.Start(psi) ?? throw new InvalidOperationException($"Failed to start command: {command}");
    proc.OutputDataReceived += (_, e) => { if (e.Data is not null) output.AppendLine(e.Data); };
    proc.ErrorDataReceived += (_, e) => { if (e.Data is not null) error.AppendLine(e.Data); };
    proc.BeginOutputReadLine();
    proc.BeginErrorReadLine();
    await proc.WaitForExitAsync();

    return new CommandResult(proc.ExitCode, output.ToString(), error.ToString());
}

record LauncherOptions(
    string RepoRoot,
    string BackendUrl,
    string FrontendUrl,
    int BackendPort,
    int FrontendPort,
    string BackendFsmCommand,
    string FrontendFsmCommand,
    string FrontendRawCommand,
    string StatusPathBackend,
    string StatusPathFrontend);

record ControlResult(bool Ok, string State, string Message, int? BackendPort, int? FrontendPort, object? Details);

record CommandResult(int ExitCode, string StdOut, string StdErr);