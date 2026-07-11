param(
  [string]$Database = "database/vic3_1.13.9",
  [string]$ProvinceMap = "D:\SteamLibrary\steamapps\common\Victoria 3\game\map_data\provinces.png",
  [string]$OutFile = "site/map-data.js",
  [int]$Width = 0,
  [int]$Height = 0
)

Add-Type -AssemblyName System.Drawing

function Read-Utf8Json($Path) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path $Path), [System.Text.Encoding]::UTF8)
  $text = $text.TrimStart([char]0xFEFF)
  return $text | ConvertFrom-Json
}

function Normalize-ProvinceColor($Value) {
  $raw = [string]$Value
  if ($raw -match '^x?([0-9a-fA-F]{6})$') {
    return "x$($matches[1].ToUpperInvariant())"
  }
  return ""
}

$stateRegions = Read-Utf8Json (Join-Path $Database "state_regions.json")
$stateKeys = New-Object System.Collections.Generic.List[string]
$stateKeys.Add("") | Out-Null
$stateIndexByKey = @{}
$colorToIndex = @{}
$ownerKeys = New-Object System.Collections.Generic.List[string]
$ownerKeys.Add("") | Out-Null
$ownerIndexByTag = @{}
$colorToOwnerIndex = @{}

foreach ($stateRegion in $stateRegions) {
  $index = $stateKeys.Count
  $stateKeys.Add([string]$stateRegion.key) | Out-Null
  $stateIndexByKey[[string]$stateRegion.key] = $index
  foreach ($color in @($stateRegion.province_colors)) {
    $normalized = Normalize-ProvinceColor $color
    if ($normalized) {
      $colorToIndex[$normalized] = $index
    }
  }
  foreach ($owner in @($stateRegion.starting_province_owners)) {
    $tag = [string]$owner.tag
    if (-not $tag) { continue }
    if (-not $ownerIndexByTag.ContainsKey($tag)) {
      $ownerIndexByTag[$tag] = $ownerKeys.Count
      $ownerKeys.Add($tag) | Out-Null
    }
    $ownerIndex = [int]$ownerIndexByTag[$tag]
    foreach ($color in @($owner.province_colors)) {
      $normalized = Normalize-ProvinceColor $color
      if ($normalized) {
        $colorToOwnerIndex[$normalized] = $ownerIndex
      }
    }
  }
}

$sourceBitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $ProvinceMap))
$bitmap = $null
$bitmapData = $null
try {
  if ($Width -le 0) { $Width = $sourceBitmap.Width }
  if ($Height -le 0) { $Height = $sourceBitmap.Height }
  $bitmap = New-Object System.Drawing.Bitmap -ArgumentList $sourceBitmap.Width, $sourceBitmap.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.DrawImage($sourceBitmap, 0, 0, $sourceBitmap.Width, $sourceBitmap.Height)
  } finally {
    $graphics.Dispose()
  }
  $rect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $bitmap.Width, $bitmap.Height
  $bitmapData = $bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = [Math]::Abs($bitmapData.Stride)
  $pixelBytes = New-Object byte[] ($stride * $bitmap.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($bitmapData.Scan0, $pixelBytes, 0, $pixelBytes.Length)

  $runs = New-Object System.Collections.Generic.List[int]
  $ownerRuns = New-Object System.Collections.Generic.List[int]
  $lastIndex = -1
  $runLength = 0
  $lastOwnerIndex = -1
  $ownerRunLength = 0
  for ($y = 0; $y -lt $Height; $y += 1) {
    $sourceY = [Math]::Min($bitmap.Height - 1, [Math]::Floor($y * $bitmap.Height / $Height))
    for ($x = 0; $x -lt $Width; $x += 1) {
      $sourceX = [Math]::Min($bitmap.Width - 1, [Math]::Floor($x * $bitmap.Width / $Width))
      $offset = [int]($sourceY * $stride + $sourceX * 4)
      $key = "x{0:X2}{1:X2}{2:X2}" -f $pixelBytes[$offset + 2], $pixelBytes[$offset + 1], $pixelBytes[$offset]
      $index = 0
      if ($colorToIndex.ContainsKey($key)) {
        $index = [int]$colorToIndex[$key]
      }
      $ownerIndex = 0
      if ($colorToOwnerIndex.ContainsKey($key)) {
        $ownerIndex = [int]$colorToOwnerIndex[$key]
      }
      if ($index -eq $lastIndex) {
        $runLength += 1
      } else {
        if ($lastIndex -ge 0) {
          $runs.Add($lastIndex) | Out-Null
          $runs.Add($runLength) | Out-Null
        }
        $lastIndex = $index
        $runLength = 1
      }
      if ($ownerIndex -eq $lastOwnerIndex) {
        $ownerRunLength += 1
      } else {
        if ($lastOwnerIndex -ge 0) {
          $ownerRuns.Add($lastOwnerIndex) | Out-Null
          $ownerRuns.Add($ownerRunLength) | Out-Null
        }
        $lastOwnerIndex = $ownerIndex
        $ownerRunLength = 1
      }
    }
  }
  if ($lastIndex -ge 0) {
    $runs.Add($lastIndex) | Out-Null
    $runs.Add($runLength) | Out-Null
  }
  if ($lastOwnerIndex -ge 0) {
    $ownerRuns.Add($lastOwnerIndex) | Out-Null
    $ownerRuns.Add($ownerRunLength) | Out-Null
  }
} finally {
  if ($bitmapData -ne $null -and $bitmap -ne $null) {
    $bitmap.UnlockBits($bitmapData)
  }
  if ($bitmap -ne $null) {
    $bitmap.Dispose()
  }
  $sourceBitmap.Dispose()
}

$outPath = Resolve-Path -LiteralPath (Split-Path $OutFile -Parent)
$fullOut = Join-Path $outPath (Split-Path $OutFile -Leaf)
$writer = New-Object System.IO.StreamWriter($fullOut, $false, (New-Object System.Text.UTF8Encoding($false)))
try {
  $writer.Write("window.VIC3_MAP_DATA={")
  $writer.Write("""width"":$Width,""height"":$Height,")
  $writer.Write("""stateKeys"":")
  $writer.Write(($stateKeys | ConvertTo-Json -Compress))
  $writer.Write(",""ownerKeys"":")
  $writer.Write(($ownerKeys | ConvertTo-Json -Compress))
  $writer.Write(",""runs"":[")
  for ($i = 0; $i -lt $runs.Count; $i += 1) {
    if ($i -gt 0) { $writer.Write(",") }
    $writer.Write($runs[$i])
  }
  $writer.Write("],""ownerRuns"":[")
  for ($i = 0; $i -lt $ownerRuns.Count; $i += 1) {
    if ($i -gt 0) { $writer.Write(",") }
    $writer.Write($ownerRuns[$i])
  }
  $writer.Write("]};")
  $writer.WriteLine()
} finally {
  $writer.Dispose()
}

Write-Output (@{
  outFile = $fullOut
  width = $Width
  height = $Height
  stateCount = $stateKeys.Count - 1
  ownerCount = $ownerKeys.Count - 1
  runPairs = [int]($runs.Count / 2)
  ownerRunPairs = [int]($ownerRuns.Count / 2)
} | ConvertTo-Json -Compress)
