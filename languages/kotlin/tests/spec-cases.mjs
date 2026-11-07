export const kotlinCoreSpecCases = [
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
  }
];
