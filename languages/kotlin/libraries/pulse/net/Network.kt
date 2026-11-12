package pulse.net

external fun tcpExchange(ip: String, port: Int, hex: String, prefixBytes: Int, timeoutMs: Int, maxBytes: Int): String
external fun udpExchange(ip: String, port: Int, hex: String, timeoutMs: Int, maxBytes: Int): String
external fun localIpv4Subnets(): String
external fun kasaDiscover(): String
external fun cameraDiscover(): String
external fun networkDiscoveryStep(): String
