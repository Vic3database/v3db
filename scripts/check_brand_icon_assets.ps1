param([string]$Root = (Split-Path -Parent $PSScriptRoot))

Add-Type -AssemblyName System.Drawing

$failures = [System.Collections.Generic.List[string]]::new()
$brand = Join-Path $Root 'site\assets\brand'
$expected = @(
  @{ Name = 'vicdata-icon-512.png'; Size = 512 },
  @{ Name = 'vicdata-icon-192.png'; Size = 192 },
  @{ Name = 'apple-touch-icon.png'; Size = 180 },
  @{ Name = 'vicdata-icon-64.png'; Size = 64 },
  @{ Name = 'vicdata-icon-48.png'; Size = 48 },
  @{ Name = 'favicon-32.png'; Size = 32 },
  @{ Name = 'favicon-16.png'; Size = 16 }
)
$navy = [System.Drawing.Color]::FromArgb(255, 16, 44, 60)
$gold = [System.Drawing.Color]::FromArgb(255, 215, 175, 75)

function Test-NearColor([System.Drawing.Color]$actual, [System.Drawing.Color]$target, [int]$tolerance = 14) {
  return (
    [Math]::Abs($actual.R - $target.R) -le $tolerance -and
    [Math]::Abs($actual.G - $target.G) -le $tolerance -and
    [Math]::Abs($actual.B - $target.B) -le $tolerance
  )
}

function Get-NearColorPixelCount([System.Drawing.Image]$image, [System.Drawing.Color]$target) {
  $count = 0
  for ($y = 0; $y -lt $image.Height; $y++) {
    for ($x = 0; $x -lt $image.Width; $x++) {
      $pixel = $image.GetPixel($x, $y)
      if ($pixel.A -gt 220 -and (Test-NearColor $pixel $target)) {
        $count++
      }
    }
  }
  return $count
}

function Test-AntialiasedGold([System.Drawing.Color]$pixel) {
  return (
    $pixel.A -gt 220 -and
    $pixel.R -ge 105 -and $pixel.R -le 225 -and
    $pixel.G -ge 90 -and $pixel.G -le 195 -and
    $pixel.B -ge 55 -and $pixel.B -le 105
  )
}

function Test-VGold([System.Drawing.Color]$pixel) {
  return (
    $pixel.A -gt 120 -and
    [Math]::Abs($pixel.R - $gold.R) -le 65 -and
    [Math]::Abs($pixel.G - $gold.G) -le 65 -and
    [Math]::Abs($pixel.B - $gold.B) -le 40
  )
}

function Get-CompactVVisualCenter([System.Drawing.Image]$image) {
  $weight = 0.0
  $weightedY = 0.0
  $xStart = [Math]::Floor($image.Width * 0.20)
  $xEnd = [Math]::Ceiling($image.Width * 0.80)
  $yStart = [Math]::Floor($image.Height * 0.18)
  $yEnd = [Math]::Ceiling($image.Height * 0.82)
  for ($y = $yStart; $y -lt $yEnd; $y++) {
    for ($x = $xStart; $x -lt $xEnd; $x++) {
      $pixel = $image.GetPixel($x, $y)
      if (Test-VGold $pixel) {
        $pixelWeight = [Math]::Max(1, ($pixel.R - 70) + ($pixel.G - 50) - $pixel.B)
        $weight += $pixelWeight
        $weightedY += $y * $pixelWeight
      }
    }
  }
  if ($weight -eq 0) {
    return $null
  }
  return $weightedY / $weight
}

function Assert-GoldMark([string]$file, [int]$minimumPixels) {
  $image = [System.Drawing.Image]::FromFile($file)
  try {
    $goldPixelCount = Get-NearColorPixelCount $image $gold
    if ($goldPixelCount -lt $minimumPixels) {
      $failures.Add("$(Split-Path -Leaf $file) must contain a visible #D7AF4B mark and border")
    }
    $centerX = [int]($image.Width * 0.5)
    $expectedY = [Math]::Max(1, [Math]::Round($image.Height * 0.06))
    $borderFound = $false
    foreach ($y in (($expectedY - 2)..($expectedY + 2))) {
      if ($y -ge 0 -and $y -lt $image.Height -and (Test-AntialiasedGold $image.GetPixel($centerX, $y))) {
        $borderFound = $true
        break
      }
    }
    if (-not $borderFound) {
      $failures.Add("$(Split-Path -Leaf $file) must retain a single gold border")
    }
  } finally {
    $image.Dispose()
  }
}

foreach ($item in $expected) {
  $file = Join-Path $brand $item.Name
  if (-not (Test-Path -LiteralPath $file)) {
    $failures.Add("missing $($item.Name)")
    continue
  }

  $image = [System.Drawing.Image]::FromFile($file)
  try {
    if ($image.Width -ne $item.Size -or $image.Height -ne $item.Size) {
      $failures.Add("$($item.Name) should be $($item.Size)x$($item.Size)")
    }
    if ($image.GetPixel(0, 0).A -ne 0) {
      $failures.Add("$($item.Name) must keep transparent rounded corners")
    }

    $sample = $image.GetPixel([int]($item.Size * 0.15), [int]($item.Size * 0.5))
    if (-not (Test-NearColor $sample $navy 0)) {
      $failures.Add("$($item.Name) must use the #102C3C navy field")
    }
  } finally {
    $image.Dispose()
  }
}

$svg = Join-Path $brand 'vicdata-icon.svg'
if (-not (Test-Path -LiteralPath $svg)) {
  $failures.Add('missing vicdata-icon.svg')
} else {
  $svgText = Get-Content -LiteralPath $svg -Raw
  foreach ($fragment in @('#102C3C', '#D7AF4B', 'Segoe Print', '>Vic3<', '>Data<', '>Base<')) {
    if (-not $svgText.Contains($fragment)) {
      $failures.Add("SVG lacks $fragment")
    }
  }
  foreach ($obsolete in @('>3<', '>D<', '>B<', 'Palatino Linotype')) {
    if ($svgText.Contains($obsolete)) {
      $failures.Add("SVG must not retain obsolete $obsolete content")
    }
  }
}

foreach ($item in $expected) {
  $file = Join-Path $brand $item.Name
  $minimumGoldPixels = if ($item.Size -ge 180) {
    [Math]::Round($item.Size * $item.Size * 0.035)
  } else {
    [Math]::Max(8, [Math]::Floor($item.Size * $item.Size * 0.035))
  }
  Assert-GoldMark $file $minimumGoldPixels
}

foreach ($item in $expected | Where-Object { $_.Size -lt 180 }) {
  $file = Join-Path $brand $item.Name
  $image = [System.Drawing.Image]::FromFile($file)
  try {
    $visualCenter = Get-CompactVVisualCenter $image
    $canvasCenter = $image.Height / 2
    $tolerance = [Math]::Max(1, $image.Height * 0.025)
    if ($null -eq $visualCenter -or [Math]::Abs($visualCenter - $canvasCenter) -gt $tolerance) {
      $failures.Add("$($item.Name) must center the V visual weight vertically")
    }
  } finally {
    $image.Dispose()
  }
}

$index = Get-Content -LiteralPath (Join-Path $Root 'site\index.html') -Raw
foreach ($fragment in @('vicdata-icon.svg', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png')) {
  if (-not $index.Contains($fragment)) {
    $failures.Add("index.html lacks $fragment")
  }
}

if ($index -match '<link rel="icon" type="image/svg\+xml"') {
  $failures.Add('index.html should not use the full wordmark SVG as the browser tab icon')
}

$manifest = Get-Content -LiteralPath (Join-Path $Root 'site\site.webmanifest') -Raw | ConvertFrom-Json
if (($manifest.icons.src -notcontains 'assets/brand/vicdata-icon-192.png') -or ($manifest.icons.src -notcontains 'assets/brand/vicdata-icon-512.png')) {
  $failures.Add('manifest must retain the 192 and 512 PNG icons')
}

if ($failures.Count) {
  $failures | ForEach-Object { Write-Error "- $_" }
  exit 1
}

Write-Output '{"brand_icon_assets":"ok"}'
