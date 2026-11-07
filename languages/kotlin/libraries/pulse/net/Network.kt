package pulse.net

external fun tcpExchange(ip: String, port: Int, hex: String, prefixBytes: Int, timeoutMs: Int, maxBytes: Int): String
external fun udpExchange(ip: String, port: Int, hex: String, timeoutMs: Int, maxBytes: Int): String
