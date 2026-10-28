# Measures how fast a price check popup appears: presses the hotkey in the game and watches a
# screen region until it shows the popup's background with text on it. Same method for any app,
# so ours and Awakened PoE Trade can be compared (FINDINGS F-53).
#
#   ours: -Region <inside the stat filters> -Bg "#151311"
#   APT:  -Region <inside its window> -Bg "#2d3748" -HoldCtrl -CloseByMouse
#   Use rare items: they are not searched right away, so no trade API requests are made.
#
#   -Region x,y,w,h   screen region inside where the popup appears (physical px)
#   -Bg "#151311"     popup background colour; -Tol colour tolerance
#   -HoldCtrl         keep Ctrl down until the popup shows (APT "hold" mode), else tap Ctrl+D
#   -Runs 5           measurements; Esc (or -CloseByMouse: a real mouse move) closes the popup between them
param(
  [Parameter(Mandatory)] [string]$Region,
  [Parameter(Mandatory)] [string]$Bg,
  [int]$Tol = 16,
  [int]$Runs = 5,
  [switch]$HoldCtrl,
  [switch]$CloseByMouse,
  [string]$Title = 'Path of Exile 2',
  [int]$TimeoutMs = 3000
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Diagnostics; using System.Runtime.InteropServices;
public static class Meas {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint f, UIntPtr e);
  [DllImport("user32.dll")] static extern uint MapVirtualKey(uint c, uint t);
  public static void Down(byte vk) { keybd_event(vk, (byte)MapVirtualKey(vk, 0), 0, UIntPtr.Zero); }
  public static void Up(byte vk) { keybd_event(vk, (byte)MapVirtualKey(vk, 0), 2, UIntPtr.Zero); }
  public struct PT { public int X, Y; }
  [DllImport("user32.dll")] static extern bool GetCursorPos(out PT p);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, uint d, UIntPtr e);
  // A real (relative) mouse move, which apps watching the mouse see, then back to the exact spot.
  public static void Wiggle() {
    PT p; GetCursorPos(out p);
    for (int i = 0; i < 15; i++) { mouse_event(1, 10, 0, 0, UIntPtr.Zero); System.Threading.Thread.Sleep(5); }
    for (int i = 0; i < 15; i++) { mouse_event(1, -10, 0, 0, UIntPtr.Zero); System.Threading.Thread.Sleep(5); }
    SetCursorPos(p.X, p.Y);
  }

  // Share of pixels close to the background colour, and share clearly different (text).
  public static double[] Sample(Bitmap bmp, Graphics g, int x, int y, Color bg, int tol) {
    g.CopyFromScreen(x, y, 0, 0, bmp.Size);
    var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int n = bmp.Width * bmp.Height, near = 0, far = 0;
    var buf = new byte[n * 4];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    for (int i = 0; i < buf.Length; i += 4) {
      int d = Math.Abs(buf[i + 2] - bg.R) + Math.Abs(buf[i + 1] - bg.G) + Math.Abs(buf[i] - bg.B);
      if (d <= tol) near++; else if (d > 150) far++;
    }
    bmp.UnlockBits(data);
    return new double[] { (double)near / n, (double)far / n };
  }

  public static double Run(int x, int y, int w, int h, Color bg, int tol, bool holdCtrl, int timeoutMs) {
    using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) using (var g = Graphics.FromImage(bmp)) {
      var before = Sample(bmp, g, x, y, bg, tol);
      if (before[0] > 0.5) return -2; // the popup is already there
      var sw = Stopwatch.StartNew();
      Down(0x11); Down(0x44); Up(0x44);
      if (!holdCtrl) Up(0x11);
      double found = -1;
      while (sw.ElapsedMilliseconds < timeoutMs) {
        var s = Sample(bmp, g, x, y, bg, tol);
        if (s[0] > 0.45 && s[1] > 0.01) { found = sw.Elapsed.TotalMilliseconds; break; }
      }
      if (holdCtrl) { System.Threading.Thread.Sleep(150); Up(0x11); }
      return found;
    }
  }
}
'@

$game = [Meas]::FindWindow([NullString]::Value, $Title)
if ($game -eq [IntPtr]::Zero) { throw "'$Title' is not running" }
if ([Meas]::GetForegroundWindow() -ne $game) { [void][Meas]::SetForegroundWindow($game); Start-Sleep -Milliseconds 400 }
if ([Meas]::GetForegroundWindow() -ne $game) { throw "the game is not in front: nothing pressed" }

$r = $Region -split ',' | ForEach-Object { [int]$_ }
$color = [System.Drawing.ColorTranslator]::FromHtml($Bg)
$times = @()
for ($i = 1; $i -le $Runs; $i++) {
  if ([Meas]::GetForegroundWindow() -ne $game) { "run $i skipped: the game is not in front"; break }
  $t = [Meas]::Run($r[0], $r[1], $r[2], $r[3], $color, $Tol, [bool]$HoldCtrl, $TimeoutMs)
  "run $i : $(if ($t -lt 0) { if ($t -eq -2) { 'popup already open' } else { 'not seen' } } else { '{0:0} ms' -f $t })"
  if ($t -ge 0) { $times += $t }
  Start-Sleep -Milliseconds 600
  if ($CloseByMouse) { [Meas]::Wiggle() } elseif (-not $HoldCtrl) { [Meas]::Down(0x1B); [Meas]::Up(0x1B) }
  Start-Sleep -Milliseconds 900
}
if ($times.Count) {
  $sorted = $times | Sort-Object
  "median {0:0} ms, min {1:0} ms, max {2:0} ms ({3} runs)" -f $sorted[[int][math]::Floor($sorted.Count / 2)], $sorted[0], $sorted[-1], $sorted.Count
}
