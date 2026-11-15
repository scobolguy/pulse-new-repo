package pulse.http

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class HttpPost(val path: String)

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class HttpPut(val path: String)

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class HttpPatch(val path: String)

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class HttpDelete(val path: String)

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class HttpHead(val path: String)

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class HttpOptions(val path: String)

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class Daemon(val id: String, val refreshMs: Int)

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.SOURCE)
annotation class Cache(
    val name: String, val capacity: Int, val ttlMs: Int, val fields: String,
    val storage: String = "RAM", val mode: String = "PERSISTENT",
    val uniqueBy: String = "", val latestBy: String = "",
    val query: String = "", val viewFields: String = ""
)

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.SOURCE)
annotation class VirtualCache(
    val name: String, val sources: String, val query: String = "", val fields: String = "",
    val storage: String = "RAM", val mode: String = "PERSISTENT"
)
