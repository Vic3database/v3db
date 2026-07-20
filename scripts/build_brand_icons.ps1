param([string]$Root = (Split-Path -Parent $PSScriptRoot))

Add-Type -AssemblyName System.Drawing

$brand = Join-Path $Root 'site\assets\brand'
$navy = [System.Drawing.Color]::FromArgb(255, 16, 44, 60)
$gold = [System.Drawing.Color]::FromArgb(255, 215, 175, 75)
$paleGold = [System.Drawing.Color]::FromArgb(255, 242, 209, 122)
$exports = @(
  @{ Name = 'vicdata-icon-512.png'; Size = 512 },
  @{ Name = 'vicdata-icon-192.png'; Size = 192 },
  @{ Name = 'apple-touch-icon.png'; Size = 180 },
  @{ Name = 'vicdata-icon-64.png'; Size = 64 },
  @{ Name = 'vicdata-icon-48.png'; Size = 48 },
  @{ Name = 'favicon-32.png'; Size = 32 },
  @{ Name = 'favicon-16.png'; Size = 16 }
)

function New-RoundedPath([int]$size, [int]$inset = 0) {
  $radius = [Math]::Max(1, [Math]::Round($size * 0.18) - $inset)
  $diameter = $radius * 2
  $edge = $size - $inset - $diameter
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($inset, $inset, $diameter, $diameter, 180, 90)
  $path.AddArc($edge, $inset, $diameter, $diameter, 270, 90)
  $path.AddArc($edge, $edge, $diameter, $diameter, 0, 90)
  $path.AddArc($inset, $edge, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Label($graphics, [string]$text, [single]$x, [single]$y, [single]$fontSize) {
  $font = [System.Drawing.Font]::new('Palatino Linotype', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  $brush = [System.Drawing.SolidBrush]::new($gold)
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  try {
    $graphics.DrawString($text, $font, $brush, $x, $y, $format)
  } finally {
    $brush.Dispose()
    $format.Dispose()
    $font.Dispose()
  }
}

function Write-Png([string]$file, [int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)
  try {
    $outerPath = New-RoundedPath $size
    $navyBrush = [System.Drawing.SolidBrush]::new($navy)
    try {
      $graphics.FillPath($navyBrush, $outerPath)
    } finally {
      $navyBrush.Dispose()
      $outerPath.Dispose()
    }

    if ($size -ge 180) {
      foreach ($border in @(
        @{ Inset = [Math]::Round($size * 0.052); Color = $paleGold },
        @{ Inset = [Math]::Round($size * 0.082); Color = $gold }
      )) {
        $borderPath = New-RoundedPath $size $border.Inset
        $pen = [System.Drawing.Pen]::new($border.Color, [Math]::Max(1, [Math]::Round($size * 0.007)))
        try {
          $graphics.DrawPath($pen, $borderPath)
        } finally {
          $pen.Dispose()
          $borderPath.Dispose()
        }
      }
    }

    if ($size -le 32) {
      Draw-Label $graphics 'V' ($size / 2) ($size * 0.48) ($size * 0.70)
    } else {
      $fontSize = $size * 0.31
      Draw-Label $graphics 'V' ($size * 0.35) ($size * 0.34) $fontSize
      Draw-Label $graphics '3' ($size * 0.65) ($size * 0.34) $fontSize
      Draw-Label $graphics 'D' ($size * 0.35) ($size * 0.66) $fontSize
      Draw-Label $graphics 'B' ($size * 0.65) ($size * 0.66) $fontSize
    }

    $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$svg = @'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="92" fill="#102C3C"/>
  <rect x="27" y="27" width="458" height="458" rx="70" fill="none" stroke="#F2D17A" stroke-width="4"/>
  <rect x="42" y="42" width="428" height="428" rx="57" fill="none" stroke="#D7AF4B" stroke-width="4"/>
  <g fill="#D7AF4B" font-family="Palatino Linotype, Garamond, serif" font-size="160" font-weight="700" text-anchor="middle" dominant-baseline="middle">
    <text x="179" y="174">V</text><text x="333" y="174">3</text><text x="179" y="338">D</text><text x="333" y="338">B</text>
  </g>
</svg>
'@

Set-Content -LiteralPath (Join-Path $brand 'vicdata-icon.svg') -Value $svg -Encoding utf8
foreach ($export in $exports) {
  Write-Png (Join-Path $brand $export.Name) $export.Size
}
