using System.Text.Json;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Enumeration;
using Windows.Devices.Radios;

internal static class Program
{
    private static readonly object OutputLock = new();
    private static readonly string[] Properties =
    [
        "System.Devices.Aep.DeviceAddress", "System.Devices.Aep.IsPaired",
        "System.Devices.Aep.IsConnected", "System.Devices.Aep.IsPresent"
    ];

    private static void Emit(object value)
    {
        lock (OutputLock) Console.WriteLine(JsonSerializer.Serialize(value));
    }

    private static Dictionary<string, object?> Fields(IReadOnlyDictionary<string, object> properties)
    {
        var fields = new Dictionary<string, object?>();
        foreach (var (property, field) in new[]
        {
            (Properties[0], "address"), (Properties[1], "paired"),
            (Properties[2], "connected"), (Properties[3], "present")
        })
        {
            if (properties.TryGetValue(property, out var value))
                fields[field] = value is bool flag ? (flag ? 1 : 0) : value?.ToString();
        }
        return fields;
    }

    private static DeviceWatcher Watch(string transport, string selector)
    {
        var watcher = DeviceInformation.CreateWatcher(selector, Properties, DeviceInformationKind.AssociationEndpoint);
        watcher.Added += (_, device) =>
        {
            var fields = Fields(device.Properties);
            fields["name"] = device.Name;
            fields["paired"] = device.Pairing.IsPaired ? 1 : 0;
            Emit(new { kind = "endpoint", action = "added", transport, id = device.Id, fields });
        };
        watcher.Updated += (_, device) =>
            Emit(new { kind = "endpoint", action = "updated", transport, id = device.Id, fields = Fields(device.Properties) });
        watcher.Removed += (_, device) =>
            Emit(new { kind = "endpoint", action = "removed", transport, id = device.Id });
        watcher.EnumerationCompleted += (_, _) =>
            Emit(new { kind = "enumerated", transport });
        watcher.Stopped += (_, _) =>
        {
            if (watcher.Status == DeviceWatcherStatus.Aborted)
                Emit(new { kind = "error", error = $"{transport} device discovery aborted" });
        };
        watcher.Start();
        return watcher;
    }

    public static async Task<int> Main()
    {
        var watchers = new List<DeviceWatcher>();
        BluetoothLEAdvertisementWatcher? advertisements = null;
        try
        {
            var adapter = await BluetoothAdapter.GetDefaultAsync();
            if (adapter is null) throw new InvalidOperationException("No Windows Bluetooth adapter is available");
            var radio = await adapter.GetRadioAsync();
            if (radio.State != RadioState.On) throw new InvalidOperationException($"Bluetooth radio is {radio.State}; turn Bluetooth on");
            if (!adapter.IsLowEnergySupported) throw new InvalidOperationException("The Bluetooth adapter does not support BLE scanning");
            advertisements = new BluetoothLEAdvertisementWatcher { ScanningMode = BluetoothLEScanningMode.Active };
            advertisements.Received += (_, args) => Emit(new
            {
                kind = "advertisement", transport = "ble",
                address = args.BluetoothAddress.ToString("X12"),
                addressType = args.BluetoothAddressType.ToString(),
                name = args.Advertisement.LocalName,
                rssi = (int)args.RawSignalStrengthInDBm
            });
            advertisements.Stopped += (_, args) =>
            {
                if (args.Error != BluetoothError.Success)
                    Emit(new { kind = "error", error = $"BLE advertisement watcher stopped: {args.Error}" });
            };
            advertisements.Start();
            watchers.Add(Watch("classic",
                $"({BluetoothDevice.GetDeviceSelectorFromPairingState(true)}) OR ({BluetoothDevice.GetDeviceSelectorFromPairingState(false)})"));
            watchers.Add(Watch("ble",
                $"({BluetoothLEDevice.GetDeviceSelectorFromPairingState(true)}) OR ({BluetoothLEDevice.GetDeviceSelectorFromPairingState(false)})"));
            Emit(new { kind = "ready", adapterId = adapter.DeviceId, classic = true, ble = true });
            var command = Console.In.ReadLineAsync();
            while (true)
            {
                var completed = await Task.WhenAny(command, Task.Delay(TimeSpan.FromSeconds(60)));
                if (completed == command)
                {
                    var line = await command;
                    if (line is null or "stop") break;
                    command = Console.In.ReadLineAsync();
                    continue;
                }
                foreach (var watcher in watchers)
                    if (watcher.Status is DeviceWatcherStatus.Started or DeviceWatcherStatus.EnumerationCompleted)
                        watcher.Stop();
                watchers.Clear();
                watchers.Add(Watch("classic",
                    $"({BluetoothDevice.GetDeviceSelectorFromPairingState(true)}) OR ({BluetoothDevice.GetDeviceSelectorFromPairingState(false)})"));
                watchers.Add(Watch("ble",
                    $"({BluetoothLEDevice.GetDeviceSelectorFromPairingState(true)}) OR ({BluetoothLEDevice.GetDeviceSelectorFromPairingState(false)})"));
            }
            return 0;
        }
        catch (Exception error)
        {
            Emit(new { kind = "error", error = error.Message });
            return 1;
        }
        finally
        {
            advertisements?.Stop();
            foreach (var watcher in watchers)
                if (watcher.Status is DeviceWatcherStatus.Started or DeviceWatcherStatus.EnumerationCompleted)
                    watcher.Stop();
        }
    }
}
