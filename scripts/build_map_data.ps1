param(
  [string]$Database = "database/vic3_1.13.9",
  [string]$ProvinceMap = "D:\SteamLibrary\steamapps\common\Victoria 3\game\map_data\provinces.png",
  [string]$TerrainFile = "D:\SteamLibrary\steamapps\common\Victoria 3\game\map_data\province_terrains.txt",
  [string]$OutFile = "site/map-data.js",
  [int]$Width = 0,
  [int]$Height = 0
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (-not ("VicdataMapRunEncoder" -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Collections;
using System.Collections.Generic;

public sealed class VicdataMapRunData
{
    public int[] StateRuns { get; private set; }
    public int[] OwnerRuns { get; private set; }
    public int[] TerrainRuns { get; private set; }

    public VicdataMapRunData(int[] stateRuns, int[] ownerRuns, int[] terrainRuns)
    {
        StateRuns = stateRuns;
        OwnerRuns = ownerRuns;
        TerrainRuns = terrainRuns;
    }
}

public static class VicdataMapRunEncoder
{
    public static VicdataMapRunData Encode(
        byte[] pixels,
        int stride,
        int sourceWidth,
        int sourceHeight,
        int width,
        int height,
        Hashtable stateByColor,
        Hashtable ownerByColor,
        Hashtable terrainByColor)
    {
        var stateRuns = new List<int>();
        var ownerRuns = new List<int>();
        var terrainRuns = new List<int>();
        int lastState = -1, stateLength = 0;
        int lastOwner = -1, ownerLength = 0;
        int lastTerrain = -1, terrainLength = 0;

        for (int y = 0; y < height; y++)
        {
            int sourceY = Math.Min(sourceHeight - 1, (int)((long)y * sourceHeight / height));
            for (int x = 0; x < width; x++)
            {
                int sourceX = Math.Min(sourceWidth - 1, (int)((long)x * sourceWidth / width));
                int offset = sourceY * stride + sourceX * 4;
                int color = (pixels[offset + 2] << 16) | (pixels[offset + 1] << 8) | pixels[offset];
                AddValue(stateRuns, ref lastState, ref stateLength, Lookup(stateByColor, color));
                AddValue(ownerRuns, ref lastOwner, ref ownerLength, Lookup(ownerByColor, color));
                AddValue(terrainRuns, ref lastTerrain, ref terrainLength, Lookup(terrainByColor, color));
            }
        }

        Flush(stateRuns, lastState, stateLength);
        Flush(ownerRuns, lastOwner, ownerLength);
        Flush(terrainRuns, lastTerrain, terrainLength);
        return new VicdataMapRunData(stateRuns.ToArray(), ownerRuns.ToArray(), terrainRuns.ToArray());
    }

    private static int Lookup(Hashtable values, int color)
    {
        object value = values[color];
        return value == null ? 0 : (int)value;
    }

    private static void AddValue(List<int> runs, ref int last, ref int length, int value)
    {
        if (value == last)
        {
            length++;
            return;
        }
        Flush(runs, last, length);
        last = value;
        length = 1;
    }

    private static void Flush(List<int> runs, int value, int length)
    {
        if (value < 0) return;
        runs.Add(value);
        runs.Add(length);
    }
}
'@
}

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

function Convert-ProvinceColorToRgb($Value) {
  $raw = [string]$Value
  if ($raw -match '^x?([0-9a-fA-F]{6})$') {
    return [Convert]::ToInt32($matches[1], 16)
  }
  return -1
}

function Write-RunPairs($Writer, $Runs) {
  $writer.Write("[")
  for ($i = 0; $i -lt $Runs.Count; $i += 1) {
    if ($i -gt 0) { $writer.Write(",") }
    $writer.Write($Runs[$i])
  }
  $writer.Write("]")
}

$stateRegionsFile = Join-Path $Database "state_regions.json"
if (-not (Test-Path -LiteralPath (Join-Path $Database "state_regions.json") -PathType Leaf)) {
  throw "Missing state region database: $stateRegionsFile"
}
$stateRegions = Read-Utf8Json $stateRegionsFile
$stateKeys = New-Object System.Collections.Generic.List[string]
$stateKeys.Add("") | Out-Null
$stateIndexByKey = @{}
$colorToIndex = @{}
$ownerKeys = New-Object System.Collections.Generic.List[string]
$ownerKeys.Add("") | Out-Null
$ownerIndexByTag = @{}
$colorToOwnerIndex = @{}
$terrainKeys = New-Object System.Collections.Generic.List[string]
$terrainKeys.Add("") | Out-Null
$terrainIndexByKey = @{}
$colorToTerrainIndex = @{}

foreach ($line in [System.IO.File]::ReadLines((Resolve-Path $TerrainFile))) {
  $terrainMatch = [regex]::Match($line, '^x([0-9A-Fa-f]{6})\s*=\s*"([^"]+)"')
  if (-not $terrainMatch.Success) { continue }
  $provinceColor = "x$($terrainMatch.Groups[1].Value.ToUpperInvariant())"
  $terrainKey = [string]$terrainMatch.Groups[2].Value
  if (-not $terrainIndexByKey.ContainsKey($terrainKey)) {
    $terrainIndexByKey[$terrainKey] = $terrainKeys.Count
    $terrainKeys.Add($terrainKey) | Out-Null
  }
  $provinceRgb = Convert-ProvinceColorToRgb $provinceColor
  $colorToTerrainIndex[$provinceRgb] = [int]$terrainIndexByKey[$terrainKey]
}

foreach ($stateRegion in $stateRegions) {
  $index = $stateKeys.Count
  $stateKeys.Add([string]$stateRegion.key) | Out-Null
  $stateIndexByKey[[string]$stateRegion.key] = $index
  foreach ($color in @($stateRegion.province_colors)) {
    $normalized = Normalize-ProvinceColor $color
    if ($normalized) {
      $colorRgb = Convert-ProvinceColorToRgb $normalized
      if ($colorRgb -ge 0) { $colorToIndex[$colorRgb] = $index }
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
        $colorRgb = Convert-ProvinceColorToRgb $normalized
        if ($colorRgb -ge 0) { $colorToOwnerIndex[$colorRgb] = $ownerIndex }
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

  $encodedRuns = [VicdataMapRunEncoder]::Encode(
    $pixelBytes,
    $stride,
    $bitmap.Width,
    $bitmap.Height,
    $Width,
    $Height,
    $colorToIndex,
    $colorToOwnerIndex,
    $colorToTerrainIndex
  )
  $runs = $encodedRuns.StateRuns
  $ownerRuns = $encodedRuns.OwnerRuns
  $terrainRuns = $encodedRuns.TerrainRuns
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
  $writer.Write(",""terrainKeys"":")
  $writer.Write(($terrainKeys | ConvertTo-Json -Compress))
  $writer.Write(",""runs"":[")
  for ($i = 0; $i -lt $runs.Count; $i += 1) {
    if ($i -gt 0) { $writer.Write(",") }
    $writer.Write($runs[$i])
  }
  $writer.Write("],""ownerRuns"":")
  Write-RunPairs $writer $ownerRuns
  $writer.Write(",""terrainRuns"":")
  Write-RunPairs $writer $terrainRuns
  $writer.Write("};")
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
  terrainRunPairs = [int]($terrainRuns.Count / 2)
} | ConvertTo-Json -Compress)
