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
    if ($sample.R -ne 16 -or $sample.G -ne 44 -or $sample.B -ne 60) {
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
  foreach ($fragment in @('#102C3C', '#D7AF4B', '>V<', '>3<', '>D<', '>B<')) {
    if (-not $svgText.Contains($fragment)) {
      $failures.Add("SVG lacks $fragment")
    }
  }
}

$index = Get-Content -LiteralPath (Join-Path $Root 'site\index.html') -Raw
foreach ($fragment in @('vicdata-icon.svg', 'favicon-32.png', 'apple-touch-icon.png')) {
  if (-not $index.Contains($fragment)) {
    $failures.Add("index.html lacks $fragment")
  }
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
