fun <T> identity(value: T): T {
    return value
}

fun label(value: Int) = when (value) {
    0 -> "zero"
    1, 2 -> "small"
    else -> "other"
}

fun size(value: Int) = when (value) {
    in 1..10 -> "small"
    !in 0..<20 -> "outside"
    else -> "medium"
}

fun main() {
    println(identity("Hello from Kotlin"))
    println(identity(42))
    println(identity(true))
    println(label(0))
    println(label(2))
    println(label(9))
    println(size(3))
    println(size(15))
    println(size(20))
}
