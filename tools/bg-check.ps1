# Live checks of the hotkeys and the foreground watchdog that never disturb the user: the fake game
# and a test instance of the app run on a hidden desktop (tools/hidden-desktop.ps1). The test
# instance (POE_TEST_INSTANCE=1, debug builds only) sends no input, takes no focus, installs no
# keyboard or mouse hooks, shows no tray icon and registers only F13-F24 (RegisterHotKey is shared
# by every desktop of the session). The window "in front" and the hotkey presses come from a command
# file (src-tauri/src/test_trigger.rs), since on a hidden desktop GetForegroundWindow is always 0.
# What only a real press and the user's desktop can show (RegisterHotKey delivering a key, the copy
# keys reaching the game) is a separate check with the user's permission (CLAUDE.md).
#
#   npx tauri build --debug --no-bundle --config src-tauri/tauri.dev.conf.json
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/bg-check.ps1 [-Out <folder for screenshots>] [-Theme ee2]
#
# Uses the dev settings (%APPDATA%\com.artemna.price-of-exile-2.dev\settings.json): backs them up,
# puts test hotkeys there and restores them at the end.

param(
  [string]$Out = (Join-Path $env:TEMP 'poe2-bg-check'),
  # 'ee2': the Exiled Exchange 2 theme (the item editor in its popover; screenshots only for it).
  [string]$Theme = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'hidden-desktop.ps1')

Add-Type -AssemblyName System.Drawing
Add-Type -Name Win -Namespace BgCheck -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out int pid);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
[DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr h, int id, uint mods, uint vk);
[DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr h, int id);
[DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
public delegate bool EnumProc(IntPtr h, IntPtr l);
[DllImport("user32.dll")] public static extern bool EnumDesktopWindows(IntPtr desk, EnumProc fn, IntPtr l);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr OpenDesktop(string name, int flags, bool inherit, uint access);
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
'@

$exe = Join-Path $root 'src-tauri\target\debug\price-of-exile-2.exe'
if (-not (Test-Path $exe)) { throw "No debug build: $exe" }
$settingsFile = Join-Path $env:APPDATA 'com.artemna.price-of-exile-2.dev\settings.json'
$logFile = Join-Path $env:LOCALAPPDATA 'com.artemna.price-of-exile-2.dev\logs\Price of Exile 2 Dev.log'
$work = Join-Path $env:TEMP "poe2-bg-check-$PID"
New-Item -ItemType Directory -Force $work, $Out | Out-Null
$trigger = Join-Path $work 'trigger.txt'
$itemFile = Join-Path $root 'scripts\fake-game-item.txt'
$game = 'PoE Fake Game'
# Ctrl+Alt+Shift + F20/F21/F22: keys no user presses, so the test instance may register them.
$keys = @{ price = 'Ctrl+Alt+Shift+F20'; item = 'Ctrl+Alt+Shift+F21'; settings = 'Ctrl+Alt+Shift+F22' }
$F20 = 0x83; $MODS = 0x4007 # MOD_NOREPEAT | ALT | CTRL | SHIFT

$results = New-Object System.Collections.Generic.List[object]
function Check([string]$Name, [bool]$Ok, [string]$Detail = '') {
  $results.Add([pscustomobject]@{ Check = $Name; Ok = $Ok; Detail = $Detail })
  Write-Host ("{0}  {1}  {2}" -f ($(if ($Ok) { 'PASS' } else { 'FAIL' })), $Name, $Detail)
}

$logStart = if (Test-Path $logFile) { (Get-Item $logFile).Length } else { 0 }
function NewLog {
  if (-not (Test-Path $logFile)) { return @() }
  $fs = [IO.File]::Open($logFile, 'Open', 'Read', 'ReadWrite')
  try { [void]$fs.Seek($logStart, 'Begin'); $text = (New-Object IO.StreamReader($fs)).ReadToEnd() } finally { $fs.Close() }
  $text -split "`r?`n"
}
function WaitLog([string]$Pattern, [int]$TimeoutMs = 3000, [int]$From = 0) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
    $lines = @(NewLog)
    for ($i = $From; $i -lt $lines.Count; $i++) { if ($lines[$i] -match $Pattern) { return [pscustomobject]@{ Line = $lines[$i]; Ms = $sw.ElapsedMilliseconds } } }
    Start-Sleep -Milliseconds 20
  }
  $null
}
function LogCount { @(NewLog).Count }
function Send([string[]]$Lines) {
  while (Test-Path $trigger) { Start-Sleep -Milliseconds 10 }
  [IO.File]::WriteAllLines("$trigger.tmp", $Lines)
  Move-Item -Force "$trigger.tmp" $trigger
}

function Windows {
  [void][BgHiddenDesktop]::Ensure($script:BgDesktopName)
  $desk = [BgCheck.Win]::OpenDesktop($script:BgDesktopName, 0, $false, 0x10000000)
  $found = New-Object System.Collections.Generic.List[object]
  [void][BgCheck.Win]::EnumDesktopWindows($desk, { param($h, $l)
      $sb = New-Object System.Text.StringBuilder 256; [void][BgCheck.Win]::GetWindowText($h, $sb, 256)
      $found.Add([pscustomobject]@{ Hwnd = $h; Title = $sb.ToString(); Visible = [BgCheck.Win]::IsWindowVisible($h) }); $true }, [IntPtr]::Zero)
  $found
}
function WindowNamed([string]$Title) { Windows | Where-Object { $_.Title -eq $Title } | Select-Object -First 1 }
function Shot([IntPtr]$Hwnd, [string]$Name) {
  $r = New-Object BgCheck.Win+RECT; [void][BgCheck.Win]::GetWindowRect($Hwnd, [ref]$r)
  $w = $r.R - $r.L; $h = $r.B - $r.T
  if ($w -le 0 -or $h -le 0) { return }
  $bmp = New-Object Drawing.Bitmap $w, $h; $g = [Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc(); [void][BgCheck.Win]::PrintWindow($Hwnd, $hdc, 2); $g.ReleaseHdc($hdc); $g.Dispose()
  $path = Join-Path $Out "$Name.png"; $bmp.Save($path); $bmp.Dispose(); $path
}

$backup = if (Test-Path $settingsFile) { [IO.File]::ReadAllText($settingsFile) } else { $null }
$procs = @()
try {
  # Test hotkeys in the dev settings; chat commands and stash presets keep theirs and are not
  # registered (not F13-F24).
  $json = if ($backup) { $backup | ConvertFrom-Json } else { [pscustomobject]@{ settings = [pscustomobject]@{} } }
  $hk = [ordered]@{ 'price-check' = $keys.price; 'item-check' = $keys.item; wiki = $null; poedb = $null; 'craft-of-exile' = $null
    'stash-search' = $null; 'stash-panel' = $null; browser = $null; settings = $keys.settings }
  $json.settings | Add-Member -Force -NotePropertyName hotkeys -NotePropertyValue ([pscustomobject]$hk)
  if ($Theme) { $json.settings | Add-Member -Force -NotePropertyName theme -NotePropertyValue $Theme }
  New-Item -ItemType Directory -Force (Split-Path $settingsFile) | Out-Null
  [IO.File]::WriteAllText($settingsFile, ($json | ConvertTo-Json -Depth 32))

  $ps = (Get-Command powershell).Source
  $procs += Start-BgHidden -Exe $ps -Arguments "-NoProfile -STA -ExecutionPolicy Bypass -File `"$root\scripts\fake-game.ps1`" -X 0 -Y 0" -WorkingDirectory $root
  $env:POE_TEST_INSTANCE = '1'; $env:POE_TEST_TRIGGER = $trigger; $env:POE_GAME_TITLE = $game; $env:POE_KEEP_POPUP = '1'
  $procs += Start-BgHidden -Exe $exe -Arguments '' -WorkingDirectory $root
  Remove-Item Env:POE_TEST_INSTANCE, Env:POE_TEST_TRIGGER, Env:POE_GAME_TITLE, Env:POE_KEEP_POPUP

  $ready = WaitLog 'not registered, only F13' 30000
  Check 'test instance started, hotkeys outside F13-F24 skipped' ($null -ne $ready) "$($ready.Line)"
  Start-Sleep -Seconds 3 # the pages load and send the settings
  $main = WindowNamed 'Price of Exile 2'
  Check 'settings window renders on the hidden desktop' ($null -ne $main -and $main.Visible)
  if ($main) { $p = Shot $main.Hwnd 'settings-start'; Write-Host "  $p" }
  $gameWin = WindowNamed $game
  Check 'fake game on the hidden desktop' ($null -ne $gameWin)

  # 1. A lost foreground event: the watchdog notices within FOREGROUND_WATCHDOG_PERIOD (250 ms).
  $n = LogCount
  Send @("front-missed $game")
  $fixed = WaitLog 'game state was out of date' 2000 $n
  Check 'watchdog fixes a missed switch into the game' ($null -ne $fixed) "$($fixed.Ms) ms: $($fixed.Line)"
  $n = LogCount
  Send @("item $itemFile", "hotkey $($keys.price)")
  $read = WaitLog 'Item text read' 3000 $n
  Start-Sleep -Milliseconds 1500
  $popup = Windows | Where-Object { $_.Title -like 'Price of Exile 2*popup' } | Select-Object -First 1
  Check 'price check after the fix' ($null -ne $read -and $popup.Visible) "$($read.Line)"
  if ($popup) { $p = Shot $popup.Hwnd 'popup-after-watchdog'; Write-Host "  $p" }

  # 2. Many quick switches (with and without the event), then the price check.
  $n = LogCount
  $flips = foreach ($i in 1..40) { if ($i % 3) { 'front none'; "front $game" } else { 'front-missed none'; "front-missed $game" } }
  foreach ($f in $flips) { Send @($f); Start-Sleep -Milliseconds 50 }
  Send @("front $game")
  Start-Sleep -Milliseconds 600
  Send @("item $itemFile", "hotkey $($keys.price)")
  $read = WaitLog 'Item text read' 3000 $n
  Check 'price check after 80 quick switches' ($null -ne $read)

  # 3. Another process holds the price check key while the game comes to the front.
  Send @('front none'); Start-Sleep -Milliseconds 400
  $holderScript = Join-Path $work 'hold-key.ps1'
  Set-Content $holderScript @"
Add-Type -Name H -Namespace X -MemberDefinition '[DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr h, int id, uint m, uint v);'
if ([X.H]::RegisterHotKey([IntPtr]::Zero, 1, $MODS, $F20)) { Start-Sleep -Seconds 5 } else { exit 3 }
"@
  $holder = Start-BgHidden -Exe $ps -Arguments "-NoProfile -ExecutionPolicy Bypass -File `"$holderScript`"" -WorkingDirectory $work
  $procs += $holder
  Start-Sleep -Milliseconds 1500
  $n = LogCount
  Send @("front $game")
  $failed = WaitLog 'Failed to register hotkey .*F20' 2000 $n
  Check 'held key: one "Failed to register" line' ($null -ne $failed) "$($failed.Line)"
  $again = WaitLog 'registered now' 8000 $n
  $failedLines = @(NewLog | Select-Object -Skip $n | Where-Object { $_ -match 'Failed to register hotkey' }).Count
  Check 'watchdog registers it once released' ($null -ne $again -and $failedLines -eq 1) "Failed lines: $failedLines; $($again.Line)"
  $holder.WaitForExit(3000) | Out-Null
  Check 'the holder really held the key' ($holder.ExitCode -eq 0) "exit $($holder.ExitCode)"

  # 4. Settings closed as a user closes them (hidden), then the settings hotkey shows them.
  if ($main) {
    [void][BgCheck.Win]::PostMessage($main.Hwnd, 0x10, [IntPtr]::Zero, [IntPtr]::Zero) # WM_CLOSE
    Start-Sleep -Milliseconds 800
    $hidden = -not [BgCheck.Win]::IsWindowVisible($main.Hwnd)
    Send @("hotkey $($keys.settings)")
    Start-Sleep -Milliseconds 800
    Check 'settings hotkey shows the closed settings window' ($hidden -and [BgCheck.Win]::IsWindowVisible($main.Hwnd)) "hidden after close: $hidden"
  }
  # 5. Item editor: another rune in a socket, Reset, a catalyst on a ring (the page clicks for the test;
  # a click that opens something waits for the page to draw it before the next one).
  $bow = Join-Path $root 'tests\fixtures\items\bow-runes-crafted.txt'
  function Filters([int]$From) {
    Send @('text popup [data-test=filters]')
    # Only the stat filters: the editor below them lists runes with their mods too.
    $line = (WaitLog '\[test\] text \[data-test=filters\]: ' 3000 $From).Line
    if ($line) { ($line -split 'SOCKETS|QUALITY')[0] }
  }
  function Popup([string]$Item) {
    $n = LogCount
    Send @("front $game", "item $Item", "hotkey $($keys.price)")
    [void](WaitLog 'Item text read' 3000 $n)
    Start-Sleep -Milliseconds 1500
  }
  function PopupShot([string]$Name) {
    $w = Windows | Where-Object { $_.Title -like 'Price of Exile 2*popup' } | Select-Object -First 1
    if ($w) { $p = Shot $w.Hwnd $Name; Write-Host "  $p" }
  }
  Popup $bow
  if ($Theme -eq 'ee2') {
    Send @('click popup [data-test=editor-button]'); Start-Sleep -Milliseconds 800
    PopupShot 'ee2-editor-bow'
    Send @('click popup [data-test=socket-0]'); Start-Sleep -Milliseconds 400; Send @('click popup [data-test="augment-Greater Adept Rune"]'); Start-Sleep -Milliseconds 1200
    Send @('click popup [data-test=editor-button]'); Start-Sleep -Milliseconds 800
    PopupShot 'ee2-editor-bow-edited'
    Popup $itemFile
    Send @('click popup [data-test=editor-button]'); Start-Sleep -Milliseconds 300
    Send @('click popup [data-test="catalyst-Adaptive Catalyst"]'); Start-Sleep -Milliseconds 1200
    PopupShot 'ee2-editor-ring-catalyst'
  } else {
    $n = LogCount
    $before = Filters $n
    Check 'bow: no Dexterity before the edit' ($before -match 'Physical Damage' -and $before -notmatch 'Dexterity') "$before"
    PopupShot 'editor-bow'
    $n = LogCount
    Send @('click popup [data-test=socket-0]'); Start-Sleep -Milliseconds 400; Send @('click popup [data-test="augment-Greater Adept Rune"]'); Start-Sleep -Milliseconds 1200
    $after = Filters $n
    Check 'bow: Greater Adept Rune in socket 1 gives a Dexterity filter' ($after -match 'Dexterity') "$after"
    PopupShot 'editor-bow-edited'
    $n = LogCount
    Send @('click popup [data-test=editor-reset]'); Start-Sleep -Milliseconds 1000
    $reset = Filters $n
    Check 'bow: Reset brings the copied item back' ($reset -match 'Physical Damage' -and $reset -notmatch 'Dexterity') "$reset"
    Popup $itemFile
    $n = LogCount
    $ring = Filters $n
    Send @('click popup [data-test=editor-toggle]'); Start-Sleep -Milliseconds 400; Send @('click popup [data-test="catalyst-Adaptive Catalyst"]'); Start-Sleep -Milliseconds 1200
    $n = LogCount
    $quality = Filters $n
    Check 'ring: 20% Adaptive Catalyst raises Strength from 12 to 14' ($ring -match '12 total to Strength' -and $quality -match '14 total to Strength') "$quality"
    PopupShot 'editor-ring-catalyst'
  }

  # The user may switch windows meanwhile: what matters is that none of ours came to the front.
  $front = [BgCheck.Win]::GetForegroundWindow(); $frontPid = 0; [void][BgCheck.Win]::GetWindowThreadProcessId($front, [ref]$frontPid)
  Check 'no window of the test came to the front of the user' (-not ($procs | Where-Object { $_.Id -eq $frontPid })) "front pid $frontPid"
}
finally {
  foreach ($p in $procs) { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
  Start-Sleep -Milliseconds 500
  if ($null -ne $backup) { [IO.File]::WriteAllText($settingsFile, $backup) } else { Remove-Item $settingsFile -ErrorAction SilentlyContinue }
  $left = @($procs | Where-Object { -not $_.HasExited })
  $free = [BgCheck.Win]::RegisterHotKey([IntPtr]::Zero, 9, $MODS, $F20); if ($free) { [void][BgCheck.Win]::UnregisterHotKey([IntPtr]::Zero, 9) }
  Check 'cleanup: no processes left, test hotkey free, settings restored' ($left.Count -eq 0 -and $free) "left: $($left.Count)"
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
$failedChecks = @($results | Where-Object { -not $_.Ok }).Count
Write-Host "`n$($results.Count - $failedChecks)/$($results.Count) passed; screenshots in $Out"
exit [int]($failedChecks -gt 0)
