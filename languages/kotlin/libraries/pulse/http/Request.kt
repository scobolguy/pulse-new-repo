package pulse.http

external fun requestBody(): String
external fun requestMethod(): String
external fun requestPath(): String
external fun requestPeer(): String
external fun requestQuery(name: String): String
external fun requestHeader(name: String): String
