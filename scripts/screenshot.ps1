# Saves a screenshot of a screen region to a PNG, without touching any window
# (unlike screenshot tools that hide or activate windows first).
#
#   powershell -NoProfile -File scripts/screenshot.ps1 -Out shot.png [-X -2560 -Y 0 -Width 2560 -Height 1440]
#   powershell -NoProfile -File scripts/screenshot.ps1 -Out popup.png -Window popup
#     (-Window: the first visible window whose title contains this text, e.g. the overlay popup)

param(
  [Parameter(Mandatory)] [string]$Out,
  [int]$X = 0,
  [int]$Y = 0,
  [int]$Width = 0,
  [int]$Height = 0,
  [string]$Window = ''
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

if ($Window) {
  Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class ShotWin {
  public struct RECT { public int Left, Top, Right, Bottom; }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public static IntPtr Find(string part) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      var sb = new StringBuilder(256); GetWindowText(h, sb, 256);
      if (IsWindowVisible(h) && sb.ToString().Contains(part)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@
  $handle = [ShotWin]::Find($Window)
  if ($handle -eq [IntPtr]::Zero) { throw "no visible window with '$Window' in the title" }
  $rect = New-Object ShotWin+RECT
  [void][ShotWin]::GetWindowRect($handle, [ref]$rect)
  $X = $rect.Left; $Y = $rect.Top; $Width = $rect.Right - $rect.Left; $Height = $rect.Bottom - $rect.Top
}

if ($Width -eq 0 -or $Height -eq 0) {
  $bounds = [Windows.Forms.SystemInformation]::VirtualScreen
  $X = $bounds.X; $Y = $bounds.Y; $Width = $bounds.Width; $Height = $bounds.Height
}

$bitmap = New-Object Drawing.Bitmap($Width, $Height)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($X, $Y, 0, 0, $bitmap.Size)
$bitmap.Save($Out, [Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose()
"saved $Out ($Width x $Height at $X,$Y)"
