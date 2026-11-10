export const kotlinCoreSpecCases = [
  {
    id: 'bounded-int-array-indexing',
    section: 'Bounded array allocation and indexing',
    reference: 'https://kotlinlang.org/docs/arrays.html',
    source: `fun main() {
  val values = IntArray(2)
  values[0] = 9
  values[1] = values[0] + 1
  println(values[1])
}`,
    stdout: ['10']
  },
  {
    id: 'bounded-int-array-size',
    section: 'Bounded array size',
    reference: 'https://kotlinlang.org/docs/arrays.html',
    source: `fun main() {
  println(IntArray(3).size)
}`,
    stdout: ['3']
  },
  {
    id: 'bounded-primitive-array-types',
    section: 'Bounded primitive array types',
    reference: 'https://kotlinlang.org/docs/arrays.html',
    source: `fun main() {
  val flags = BooleanArray(1)
  flags[0] = true
  val bytes = ByteArray(1)
  bytes[0] = -2
  val shorts = ShortArray(1)
  shorts[0] = 300
  println(flags[0])
  println(bytes[0])
  println(shorts[0])
}`,
    stdout: ['true', '-2', '300']
  },
  {
    id: 'stateful-scalar-constructor-properties',
    section: 'Stateful classes and heap-backed references',
    reference: 'https://kotlinlang.org/docs/classes.html#constructors',
    source: `class Box(val value: Int)
fun main() {
  println(Box(7).getValue())
}`,
    stdout: ['7']
  },
  {
    id: 'nullable-null-elvis-and-equality',
    section: 'Nullable values and null equality',
    reference: 'https://kotlinlang.org/spec/expressions.html#null-safety',
    source: `fun main() {
  val text: String? = null
  println(text ?: "fallback")
  println(text == null)
}`,
    stdout: ['fallback', 'true']
  },
  {
    id: 'standard-scalar-conversion-members',
    section: 'Kotlin scalar library APIs',
    reference: 'https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-int/',
    source: `fun <T> text(value: T): String = value.toString()
fun narrow(value: Int) = value.toByte()
fun main() {
  println(narrow(128))
  println(65535.toShort())
  val byte: Byte = -128
  val short: Short = -32768
  println(byte.toInt())
  println(short.toByte())
  println(byte.toByte())
  println(text(42))
  println(text(false))
  println(text("same"))
  println(true.toString())
}`,
    stdout: ['-128', '-1', '-128', '0', '-128', '42', 'false', 'same', 'true']
  },
  {
    id: 'int-constants-and-inclusive-overflow-boundary',
    section: 'Integer constants and bounded iteration',
    reference: 'https://kotlinlang.org/spec/built-in-types-and-their-semantics.html#integer-types',
    source: `fun main() {
  println(Int.MIN_VALUE)
  println(Int.MAX_VALUE)
  var count = 0
  for (n in Int.MAX_VALUE - 1..Int.MAX_VALUE) { count++; continue }
  println(count)
  count = 0
  for (n in Int.MAX_VALUE..Int.MAX_VALUE) { count++ }
  println(count)
  for (n in 3..2) { println("wrong") }
  var value = Int.MAX_VALUE
  value++
  println(value)
  println(Int.MAX_VALUE + 1)
  println(value / -1)
  println(value % -1)
}`,
    stdout: ['-2147483648', '2147483647', '2', '1', '-2147483648', '-2147483648', '-2147483648', '0']
  },
  {
    id: 'range-membership-evaluation-order',
    section: 'Range membership',
    reference: 'https://kotlinlang.org/spec/expressions.html#containment-checking-expressions',
    source: `fun mark(value: Int): Int { println(value); return value }
fun contains(value: Int): Boolean = value in 1..3
fun main() {
  println(mark(2) in mark(1)..mark(3))
  println(contains(3))
  println(3 !in 3..2)
  println(Int.MAX_VALUE in Int.MAX_VALUE..<Int.MAX_VALUE)
  println(2 in 1..<3)
}`,
    stdout: ['1', '3', '2', 'true', 'true', 'true', 'false', 'true']
  },
  {
    id: 'trailing-defaults-and-generic-forwarding',
    section: 'Default parameters',
    reference: 'https://kotlinlang.org/spec/declarations.html#function-declaration',
    source: `fun mark(value: Int): Int { println(value); return value }
fun total(first: Int, second: Int = mark(first + 1), third: Int = mark(second + 1)): Int = first + second + third
fun <T> repeat(value: T, other: T = value): T = other
fun notice(value: Int = 7) { println(value) }
fun main() {
  println(total(mark(1)))
  println(total(2, mark(8)))
  println(total(1, 2, 3))
  println(repeat("same"))
  println(repeat(42))
  println(repeat<Boolean>(false))
  notice()
}`,
    stdout: ['1', '2', '3', '6', '8', '9', '19', '6', 'same', '42', 'false', '7']
  },
  {
    id: 'grammar-string-templates',
    section: 'String templates',
    reference: 'https://kotlinlang.org/spec/expressions.html#string-literals',
    source: 'fun mark(value: Int): Int { println(value); return value }\n' +
      'fun main() {\n' +
      '  val answer = 42\n' +
      '  println("answer: $answer, ${answer + 1}, ${false}")\n' +
      '  println("nested ${"value ${answer}"}")\n' +
      '  println("order ${mark(1)} then ${mark(2)}")\n' +
      '  println("\\\\$answer and \\$answer and $")\n' +
      '  println("braces ${"}" + "{"}")\n' +
      '}',
    stdout: ['answer: 42, 43, false', 'nested value 42', '1', '2', 'order 1 then 2',
      '\\42 and $answer and $', 'braces }{']
  },
  {
    id: 'string-length-unicode',
    section: 'UTF-16 string length',
    reference: 'https://kotlinlang.org/spec/built-in-types-and-their-semantics.html#kotlin.string',
    source: `fun size(value: String) = value.length
fun mark(value: String): String { println("once"); return value }
fun main() {
  println(size(""))
  println(size("ascii"))
  println(size("é"))
  println(size("é"))
  println(size("漢"))
  println(size("😀"))
  println(mark("a😀é").length)
}`,
    stdout: ['0', '5', '1', '2', '1', '2', 'once', '4']
  },
  {
    id: 'generic-functions',
    section: 'Function type parameters and calls',
    reference: 'https://kotlinlang.org/spec/declarations.html#type-parameters',
    source: `fun <T> identity(value: T): T = value
fun <T> forward(value: T): T = identity<T>(value)
fun <T> same(a: T, b: T): Boolean = a == b
fun <T> show(value: T) { println(value) }
fun <T> repeatValue(value: T, count: Int): T {
  if (count == 0) return value
  return repeatValue(value, count - 1)
}
fun main() {
  println(forward(42))
  println(forward("Kotlin"))
  println(identity<Boolean>(false))
  println(repeatValue("done", 3))
  println(same("same", "same"))
  show(false)
}`,
    stdout: ['42', 'Kotlin', 'false', 'done', 'true', 'false']
  },
  {
    id: 'generic-narrow-integers',
    section: 'Integer types and generic functions',
    reference: 'https://kotlinlang.org/spec/built-in-types-and-their-semantics.html#integer-types',
    source: `fun <T> identity(value: T): T = value
fun <T> same(a: T, b: T): Boolean = a == b
fun main() {
  var byte: Byte = -128
  var short: Short = 32767
  println(identity(byte))
  println(identity(short))
  println(same(byte, identity<Byte>(-128)))
  byte--
  short++
  println(byte)
  println(short)
}`,
    stdout: ['-128', '32767', 'true', '127', '-32768']
  },
  {
    id: 'integer-and-boolean-expressions',
    section: 'Expressions: arithmetic, comparison, and logical operators',
    reference: 'https://kotlinlang.org/spec/expressions.html',
    source: `fun main() {
  val result = 2 + 3 * 4
  println(result)
  println((result - 2) / 2)
  println(true && !false)
}`,
    stdout: ['14', '6', 'true']
  },
  {
    id: 'functions-and-local-properties',
    section: 'Declarations: function declaration; Statements: local variable declarations',
    reference: 'https://kotlinlang.org/spec/declarations.html#function-declaration',
    source: `fun add(left: Int, right: Int): Int {
  return left + right
}
fun main() {
  val start = 3
  var total = add(start, 4)
  total += 2
  println(total)
}`,
    stdout: ['9']
  },
  {
    id: 'statement-when-short-circuit-and-control-flow',
    section: 'Statements: when and loop control flow',
    reference: 'https://kotlinlang.org/spec/expressions.html#when-expressions',
    source: `fun check(label: String, result: Boolean): Boolean { println(label); return result }
fun label(value: Int): String {
  when (value) {
    1 -> return "one"
    else -> return "other"
  }
}
fun main() {
  when {
    check("a", false) -> println("wrong")
    check("b", false), check("c", true), check("d", true) -> println("matched")
    else -> println("wrong")
  }
  println(label(1))
  println(label(2))
  var total = 0
  for (outer in 1..3) {
    for (inner in 1..4) {
      when (inner) {
        1 -> continue
        2 -> break
        else -> total += 100
      }
    }
    total += outer
  }
  println(total)
}`,
    stdout: ['a', 'b', 'c', 'matched', 'one', 'other', '6']
  },
  {
    id: 'if-and-loop-control-flow',
    section: 'Statements: control structures',
    reference: 'https://kotlinlang.org/spec/statements.html#control-structures',
    source: `fun main() {
  var index = 0
  var total = 0
  while (index < 5) {
    total += index
    index++
  }
  for (item in 1..3) {
    total += item
  }
  if (total == 16) {
    println("matched")
  } else {
    println("unexpected")
  }
  println(total)
}`,
    stdout: ['matched', '16']
  },
  {
    id: 'integer-literals-and-precedence',
    section: 'Integer literals and operator precedence',
    reference: 'https://kotlinlang.org/spec/expressions.html',
    source: `fun main() {
  val a: Int = 0x2a
  val b = 0b1010
  val c = 1_000
  println(a + b * 2)
  println((a + b) * 2)
  println(c - 7)
  println(-a)
}`,
    stdout: ['62', '104', '993', '-42']
  },
  {
    id: 'integer-division-and-remainder',
    section: 'Multiplicative expressions',
    reference: 'https://kotlinlang.org/spec/expressions.html#multiplicative-expressions',
    source: `fun main() {
  val dividend = -17
  val divisor = 5
  println(dividend / divisor)
  println(dividend % divisor)
  println(17 / divisor)
  println(17 % divisor)
}`,
    stdout: ['-3', '-2', '3', '2']
  },
  {
    id: 'comparison-and-equality',
    section: 'Comparison and equality expressions',
    reference: 'https://kotlinlang.org/spec/expressions.html',
    source: `fun main() {
  val a = 4
  val b = 5
  println(a < b)
  println(a <= a)
  println(a > b)
  println(b >= a)
  println(a == b)
  println(a != b)
}`,
    stdout: ['true', 'true', 'false', 'true', 'false', 'true']
  },
  {
    id: 'short-circuit-function-calls',
    section: 'Logical conjunction and disjunction expressions',
    reference: 'https://kotlinlang.org/spec/expressions.html',
    source: `fun marker(): Boolean {
  println("called")
  return true
}
fun main() {
  val no = false
  val yes = true
  println(no && marker())
  println(yes || marker())
  println(yes && marker())
  println(no || marker())
}`,
    stdout: ['false', 'true', 'called', 'true', 'called', 'true']
  },
  {
    id: 'string-equality-and-concatenation',
    section: 'Equality and additive expressions',
    reference: 'https://kotlinlang.org/spec/expressions.html',
    source: `fun main() {
  val first = "hello"
  val second = "hello"
  val count = 42
  println(first == second)
  println(first != "world")
  println(first + " " + count)
  println("flag=" + false)
}`,
    stdout: ['true', 'true', 'hello 42', 'flag=false']
  },
  {
    id: 'string-escapes-and-print',
    section: 'String literals',
    reference: 'https://kotlinlang.org/spec/expressions.html#string-literals',
    source: `fun main() {
  print("a")
  print("b")
  println("c")
  println("quote: \\" and slash: \\\\")
}`,
    stdout: ['abc', 'quote: " and slash: \\']
  },
  {
    id: 'variables-and-compound-assignment',
    section: 'Variable declarations and assignments',
    reference: 'https://kotlinlang.org/spec/statements.html',
    source: `fun main() {
  var x: Int = 20
  x += 3
  x -= 5
  x *= 2
  x /= 3
  x %= 7
  println(x)
  x = 9
  println(x)
}`,
    stdout: ['5', '9']
  },
  {
    id: 'prefix-and-postfix-increment',
    section: 'Prefix and postfix increment and decrement expressions',
    reference: 'https://kotlinlang.org/spec/expressions.html',
    source: `fun main() {
  var x = 4
  println(x++)
  println(++x)
  println(x--)
  println(--x)
  println(x)
}`,
    stdout: ['4', '6', '6', '4', '4']
  },
  {
    id: 'expression-bodied-functions',
    section: 'Function declarations',
    reference: 'https://kotlinlang.org/spec/declarations.html#function-declaration',
    source: `fun twice(value: Int): Int = value * 2
fun positive(value: Int): Boolean = value > 0
fun greeting(name: String): String = "hello " + name
fun main() {
  println(twice(6))
  println(positive(-1))
  println(greeting("Kotlin"))
}`,
    stdout: ['12', 'false', 'hello Kotlin']
  },
  {
    id: 'recursive-function',
    section: 'Function calls and return expressions',
    reference: 'https://kotlinlang.org/spec/expressions.html',
    source: `fun factorial(n: Int): Int {
  if (n <= 1) {
    return 1
  } else {
    return n * factorial(n - 1)
  }
}
fun main() {
  println(factorial(0))
  println(factorial(5))
}`,
    stdout: ['1', '120']
  },
  {
    id: 'branch-and-loop-boundaries',
    section: 'Control structures',
    reference: 'https://kotlinlang.org/spec/statements.html#control-structures',
    source: `fun main() {
  var sum = 0
  for (n in 3..1) {
    sum += n
  }
  for (n in 2..2) {
    sum += n
  }
  var i = 0
  while (i < 0) {
    sum += 100
  }
  if (sum == 2) {
    println("yes")
  } else {
    println("no")
  }
  println(sum)
}`,
    stdout: ['yes', '2']
  },
  {
    id: 'range-end-evaluated-once',
    section: 'For loop statements and range expressions',
    reference: 'https://kotlinlang.org/spec/statements.html#for-loop-statements',
    source: `fun main() {
  var limit = 3
  var total = 0
  for (n in 1..limit) {
    total += n
    limit = 1
  }
  println(total)
  println(limit)
}`,
    stdout: ['6', '1']
  },
  {
    id: 'exclusive-for-loop-ranges',
    section: 'For loop statements and range expressions',
    reference: 'https://kotlinlang.org/spec/statements.html#for-loop-statements',
    source: `fun mark(value: Int): Int { println(value); return value }
fun main() {
  var count = 0
  for (n in mark(1)..<mark(3)) { count++; continue }
  println(count)
  count = 0
  for (n in 3..<2) { count++ }
  println(count)
  count = 0
  for (n in Int.MAX_VALUE - 1..<Int.MAX_VALUE) { count++ }
  println(count)
  for (n in Int.MAX_VALUE..<Int.MAX_VALUE) { count++ }
  println(count)
}`,
    stdout: ['1', '3', '2', '0', '1', '1']
  },
  {
id: 'statement-when-evaluates-subject-once',
section: 'When statements',
reference: 'https://kotlinlang.org/spec/expressions.html#when-expressions',
source: `fun subject(): Int { println("subject"); return 2 }
fun main() {
  var answer = 0
  val selected: Int
  when (subject()) {
1 -> { answer = 10; selected = 1 }
2, 3 -> { answer = 20; selected = 2 }
in 4..<8 -> { answer = 30; selected = 3 }
else -> { answer = 40; selected = 4 }
  }
  println(answer)
  println(selected)
}`,
stdout: ['subject', '20', '2']
  }
];
