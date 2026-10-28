# Test driver: focuses the fake game, puts the cursor at a point and presses the price check
# hotkey (Ctrl+D), the item check hotkey (Alt+D), Esc, or clicks there (the popup never takes
# the foreground, so clicks on it keep the game active). Refuses to do anything unless the fake
# game really is the active window.
#
#   powershell -NoProfile -File scripts/press-hotkey.ps1 [-CursorX 1500 -CursorY 400] [-Key ItemCheck|Escape|Click]
#   powershell -NoProfile -File scripts/press-hotkey.ps1 -Key Custom -Vk 0x51 -Modifier 0x12   (any key: Alt+Q)

param(
  [string]$Title = 'PoE Fake Game',
  [int]$CursorX = 1500,
  [int]$CursorY = 400,
  [ValidateSet('PriceCheck', 'ItemCheck', 'Escape', 'Click', 'Custom')] [string]$Key = 'PriceCheck',
  [int]$Vk = 0,
  [int]$Modifier = 0
)

Add-Type @'
using System; using System.Runtime.InteropServices;
public static class Drive {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
  public static void Click() { mouse_event(2, 0, 0, 0, UIntPtr.Zero); mouse_event(4, 0, 0, 0, UIntPtr.Zero); }
  public static void Tap(byte vk, byte modifier) {
    if (modifier != 0) keybd_event(modifier, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
    if (modifier != 0) keybd_event(modifier, 0, 2, UIntPtr.Zero);
  }
}
'@

$game = [Drive]::FindWindow([NullString]::Value, $Title)
if ($game -eq [IntPtr]::Zero) { throw "'$Title' is not running" }
if ([Drive]::GetForegroundWindow() -ne $game) {
  [void][Drive]::SetForegroundWindow($game)
  Start-Sleep -Milliseconds 300
}
if ([Drive]::GetForegroundWindow() -ne $game) { throw "'$Title' is not the active window: nothing pressed" }
[void][Drive]::SetCursorPos($CursorX, $CursorY)
Start-Sleep -Milliseconds 100
switch ($Key) {
  'Escape' { [Drive]::Tap(0x1B, 0) }
  'Click' { [Drive]::Click() }
  'ItemCheck' { [Drive]::Tap(0x44, 0x12) }
  'Custom' { [Drive]::Tap([byte]$Vk, [byte]$Modifier) }
  default { [Drive]::Tap(0x44, 0x11) }
}
"pressed $Key in '$Title'"
