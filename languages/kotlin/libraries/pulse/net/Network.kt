package pulse.net

external fun tcpExchange(ip: String, port: Int, hex: String, prefixBytes: Int, timeoutMs: Int, maxBytes: Int): String
external fun udpExchange(ip: String, port: Int, hex: String, timeoutMs: Int, maxBytes: Int): String
external fun udpSend(ip: String, port: Int, hex: String): Int
external fun networkPeerAllowed(ip: String, port: Int): Int
external fun localIpv4Subnets(): String
external fun localIpv4Batch(offset: Int, count: Int): String
external fun localIpv4Batch(offset: Int, count: Int): String
external fun kasaDiscover(): String
external fun cameraDiscover(): String
external fun bluetoothScan(seconds: Int): String
external fun networkDiscoveryStep(): String
