class Program
{
    static void Main()
    {
        int led = BoardLed.Open();
        if (led == 0)
        {
            System.Console.WriteLine("LED open failed");
            return;
        }
        bool ok = BoardLed.SetIntensity(led, 32);
        if (ok)
            System.Console.WriteLine(BoardLed.ReadIntensity(led));
        for (int cycle = 0; cycle < 3 && ok; cycle++)
        {
            if (cycle == 0)
                ok = BoardLed.SetColor(led, "#FF0000");
            else if (cycle == 1)
                ok = BoardLed.SetColor(led, "#00FF00");
            else
                ok = BoardLed.SetColor(led, "#0000FF");
            if (ok)
            {
                System.Console.WriteLine(BoardLed.ReadColor(led));
                ok = BoardLed.SetPower(led, true);
            }
            if (ok)
            {
                System.Console.WriteLine(BoardLed.ReadPower(led));
                BoardLed.Delay(3000);
                ok = BoardLed.SetPower(led, false);
            }
            if (ok)
            {
                System.Console.WriteLine(BoardLed.ReadPower(led));
                BoardLed.Delay(3000);
            }
        }
        bool off = BoardLed.SetPower(led, false);
        bool closed = BoardLed.Close(led);
        if (ok && off && closed)
            System.Console.WriteLine("LED blink complete");
        else
            System.Console.WriteLine("LED operation failed");
    }
}
