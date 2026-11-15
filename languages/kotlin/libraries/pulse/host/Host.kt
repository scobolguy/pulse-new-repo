package pulse.host

external fun eventMethod(): String
external fun eventPeer(): String
external fun eventPort(): Int
external fun eventBytes(): String
external fun bytesLength(hex: String): Int
external fun bytesGet(hex: String, index: Int): Int
external fun byteXor(left: Int, right: Int): Int
external fun bufferCreate(capacity: Int): Int
external fun bufferAppend(handle: Int, value: Int): Int
external fun bufferJsonPathText(handle: Int, path: String): String
external fun bufferJsonPathInteger(handle: Int, path: String): Int
external fun bufferRelease(handle: Int): Int
external fun jsonArrayGet(json: String, index: Int): String
external fun jsonArrayCount(json: String): Int
external fun jsonText(json: String, field: String): String
external fun jsonSetText(json: String, field: String, value: String): String
external fun jsonSetInteger(json: String, field: String, value: Int): String
external fun jsonEmbed(json: String, field: String, value: String): String
external fun jsonAppendText(json: String, field: String, value: String): String
external fun cacheCount(name: String): Int
external fun cacheNext(name: String, cursor: String): String
external fun cacheGet(name: String, key: String): String
external fun cachePut(name: String, key: String, value: String, ttlMs: Int): Int
external fun cacheSnapshot(name: String, cursor: String, revision: String): String
external fun raiseError(message: String): Int
