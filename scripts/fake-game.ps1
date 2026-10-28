# Stand-in "game" window for testing the overlay without Path of Exile 2.
# Ctrl+Alt+C puts the item text on the clipboard, like the game's advanced copy of a hovered item
# (Ctrl + "show advanced item descriptions" + C); plain Ctrl+C copies it without the mod headers
# `{ ... }`, as PoE2 does. Ctrl+F opens a
# stash search box like the game's (Enter shows what was searched). Enter opens a chat box,
# Ctrl+Enter the same box with the last whisper partner ("@LastWhisper "); Enter in it shows what
# was sent, Esc closes it. Nothing else reacts to keys, so stray test input cannot change anything. The item file is read on every Ctrl+C: overwrite
# it to check another item without restarting. Each copy is logged in the window, so a test can see
# which combination reached the "game".
#
#   powershell -STA -File scripts/fake-game.ps1 [-ItemFile <path>] [-X <left>] [-Y <top>]
#   then run the app with POE_GAME_TITLE="PoE Fake Game" and `npm run dev` (see src-tauri/src/constants.rs).

param(
  [string]$ItemFile = (Join-Path $PSScriptRoot 'fake-game-item.txt'),
  [int]$X = 100,
  [int]$Y = 100,
  [int]$Width = 1600,
  [int]$Height = 900
)

# Hide our own console instead of starting hidden: -WindowStyle Hidden would hide the form too.
Add-Type -Name Console -Namespace FakeGame -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
'@
[void][FakeGame.Console]::ShowWindow([FakeGame.Console]::GetConsoleWindow(), 0)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$item = [IO.File]::ReadAllText($ItemFile)

$form = New-Object Windows.Forms.Form
$form.Text = 'PoE Fake Game'
$form.StartPosition = 'Manual'
$form.Location = New-Object Drawing.Point($X, $Y)
$form.Size = New-Object Drawing.Size($Width, $Height)
$form.BackColor = [Drawing.Color]::FromArgb(26, 19, 13)
$form.KeyPreview = $true

$label = New-Object Windows.Forms.Label
$label.Dock = 'Fill'
$label.ForeColor = [Drawing.Color]::FromArgb(180, 154, 114)
$label.Font = New-Object Drawing.Font('Consolas', 11)
$label.Text = "PoE Fake Game - hover anywhere and press the price check hotkey.`r`nCtrl+Alt+C copies:`r`n`r`n$item"
$search = New-Object Windows.Forms.TextBox
$search.Dock = 'Top'
$search.Font = New-Object Drawing.Font('Consolas', 14)
$search.Visible = $false
$chat = New-Object Windows.Forms.TextBox
$chat.Dock = 'Bottom'
$chat.Font = New-Object Drawing.Font('Consolas', 14)
$chat.Visible = $false
$form.Controls.Add($label)
$form.Controls.Add($search)
$form.Controls.Add($chat)
$searched = ''
$sent = @()
$copied = ''

function Update-Label {
  $text = "PoE Fake Game - hover anywhere and press the price check hotkey.`r`nCtrl+Alt+C copies:`r`n`r`n$item"
  if ($copied) { $text = "Last copy: $copied`r`n`r`n$text" }
  if ($searched) { $text = "Stash search: $searched`r`n`r`n$text" }
  if ($sent.Count) { $text = (($sent | ForEach-Object { "Chat sent: $_" }) -join "`r`n") + "`r`n`r`n$text" }
  $label.Text = $text
}

$search.Add_KeyDown({
  param($sender, $e)
  if ($e.KeyCode -eq 'Return') {
    $script:searched = $search.Text
    $search.Visible = $false
    $form.Focus()
    Update-Label
    $e.Handled = $true
    $e.SuppressKeyPress = $true
  }
})

function Open-Chat([string]$text) {
  $chat.Text = $text
  $chat.Visible = $true
  $chat.Focus()
  $chat.SelectionStart = $chat.Text.Length
}

$chat.Add_KeyDown({
  param($sender, $e)
  if ($e.KeyCode -eq 'Return') {
    if ($chat.Text) { $script:sent = @($sent + $chat.Text | Select-Object -Last 3) }
    $chat.Visible = $false
    $form.Focus()
    Update-Label
    $e.Handled = $true
    $e.SuppressKeyPress = $true
  } elseif ($e.KeyCode -eq 'Escape') {
    $chat.Visible = $false
    $form.Focus()
    $e.Handled = $true
    $e.SuppressKeyPress = $true
  } elseif ($e.Control -and $e.KeyCode -eq 'A') {
    $chat.SelectAll()
    $e.Handled = $true
    $e.SuppressKeyPress = $true
  }
})

$form.Add_KeyDown({
  param($sender, $e)
  if ($e.Control -and $e.KeyCode -eq 'C') {
    $script:item = [IO.File]::ReadAllText($ItemFile)
    if ($e.Alt) {
      [Windows.Forms.Clipboard]::SetText($item)
      $script:copied = "Ctrl+Alt+C (advanced) at $(Get-Date -Format 'HH:mm:ss.fff')"
    } else {
      $plain = ($item -split "`n" | Where-Object { $_ -notmatch '^\{ .* \}\r?$' }) -join "`n"
      [Windows.Forms.Clipboard]::SetText($plain)
      $script:copied = "Ctrl+C (plain) at $(Get-Date -Format 'HH:mm:ss.fff')"
    }
    Update-Label
    $e.Handled = $true
    $e.SuppressKeyPress = $true
  } elseif ($e.KeyCode -eq 'Return' -and -not $chat.Visible -and -not $search.Visible) {
    Open-Chat ($(if ($e.Control) { '@LastWhisper ' } else { '' }))
    $e.Handled = $true
    $e.SuppressKeyPress = $true
  } elseif ($e.Control -and $e.KeyCode -eq 'F') {
    $search.Visible = $true
    $search.SelectAll()
    $search.Focus()
    $e.Handled = $true
  }
})

[Windows.Forms.Application]::Run($form)
