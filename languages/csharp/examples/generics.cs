using System;

class Program
{
    static T Identity<T>(T value)
    {
        return value;
    }

    static T Choose<T>(bool first, T left, T right)
    {
        if (first)
            return left;
        return right;
    }

    static void Main()
    {
        int sum = 0;
        for (int i = 1; i <= 10; i++)
            sum += Identity(i);

        Console.WriteLine("SUM = " + sum);
        Console.WriteLine(Identity<string>("Hello from C#"));
        Console.WriteLine(Choose(true, "Generic", "Other"));
        Console.WriteLine(Identity<bool>(true));
    }
}
