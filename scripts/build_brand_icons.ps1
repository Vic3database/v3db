param([string]$Root = (Split-Path -Parent $PSScriptRoot))

Add-Type -AssemblyName System.Drawing

$brand = Join-Path $Root 'site\assets\brand'
$fontFamily = 'Segoe Print'
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

function Draw-SingleGoldBorder($graphics, [int]$size) {
  $inset = [Math]::Max(1, [Math]::Round($size * 0.06))
  $borderPath = New-RoundedPath $size $inset
  $pen = [System.Drawing.Pen]::new($gold, [Math]::Max(1, [Math]::Round($size * 0.022)))
  try {
    $graphics.DrawPath($pen, $borderPath)
  } finally {
    $pen.Dispose()
    $borderPath.Dispose()
  }
}

function Draw-CenteredLabel($graphics, [string]$text, [single]$centerX, [single]$centerY, [single]$fontSize, [int]$strokeWidth = 0) {
  $font = [System.Drawing.Font]::new($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $brush = [System.Drawing.SolidBrush]::new($gold)
  $textPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $layout = [System.Drawing.RectangleF]::new(0, $centerY - $fontSize, $graphics.VisibleClipBounds.Width, $fontSize * 2)
  try {
    $textPath.AddString($text, $font.FontFamily, [int]$font.Style, $font.Size, $layout, $format)
    if ($strokeWidth -gt 0) {
      $stroke = [System.Drawing.Pen]::new($paleGold, $strokeWidth)
      try {
        $graphics.DrawPath($stroke, $textPath)
      } finally {
        $stroke.Dispose()
      }
    }
    $graphics.FillPath($brush, $textPath)
  } finally {
    $textPath.Dispose()
    $brush.Dispose()
    $format.Dispose()
    $font.Dispose()
  }
}

function Draw-Wordmark($graphics, [int]$size) {
  $fontSize = switch ($size) {
    512 { 146 }
    192 { 55 }
    180 { 51 }
    default { throw "Unsupported wordmark size: $size" }
  }
  $centerX = $size / 2
  $strokeWidth = [Math]::Max(1, [Math]::Round($size * 0.003))
  Draw-CenteredLabel $graphics 'Vic3' $centerX ($size * 0.31) $fontSize $strokeWidth
  Draw-CenteredLabel $graphics 'Data' $centerX ($size * 0.50) ($fontSize * 0.78) $strokeWidth
  Draw-CenteredLabel $graphics 'Base' $centerX ($size * 0.68) ($fontSize * 0.78) $strokeWidth
}

function Draw-CompactV($graphics, [int]$size) {
  Draw-CenteredLabel $graphics 'V' ($size / 2) ($size * 0.47) ($size * 0.82)
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

    Draw-SingleGoldBorder $graphics $size
    if ($size -ge 180) {
      Draw-Wordmark $graphics $size
    } else {
      Draw-CompactV $graphics $size
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
  <rect x="31" y="31" width="450" height="450" rx="72" fill="none" stroke="#D7AF4B" stroke-width="11"/>
  <g fill="#D7AF4B" stroke="#F2D17A" stroke-width="1.5" paint-order="stroke fill" font-family="Segoe Print, Segoe UI, cursive" font-weight="700" text-anchor="middle">
    <text x="256" y="191" font-size="146">Vic3</text>
    <text x="256" y="292" font-size="114">Data</text>
    <text x="256" y="391" font-size="114">Base</text>
  </g>
</svg>
'@

Set-Content -LiteralPath (Join-Path $brand 'vicdata-icon.svg') -Value $svg -Encoding utf8
foreach ($export in $exports) {
  Write-Png (Join-Path $brand $export.Name) $export.Size
}
