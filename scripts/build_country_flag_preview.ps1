param(
  [string]$InputJson = "output_next\flags\IBE.json",
  [string]$GamePath = "D:\SteamLibrary\steamapps\common\Victoria 3",
  [string]$OutFile = "output_next\flags\IBE_preview.png",
  [string]$OutDir = "",
  [ValidateSet("contact-sheet", "variants")]
  [string]$Mode = "contact-sheet",
  [int]$Columns = 4,
  [int]$FlagWidth = 240,
  [int]$FlagHeight = 144,
  [int]$MaxVariants = 0
)

Add-Type -AssemblyName System.Drawing

function Resolve-PathForWrite([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $PathValue))
}

function Get-SafeFileStem([string]$Value) {
  $stem = $Value -replace '[<>:"/\\|?*]', '_'
  $stem = $stem.TrimEnd(" ", ".")
  if ([string]::IsNullOrWhiteSpace($stem)) {
    return "_"
  }
  if ($stem -match '^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])$') {
    return "_$stem"
  }
  return $stem
}

function Clamp-Byte([double]$Value) {
  return [Math]::Min(255, [Math]::Max(0, [int][Math]::Round($Value)))
}

function Convert-HsvToRgb([double]$H, [double]$S, [double]$V) {
  $hue = (($H % 360) + 360) % 360
  $c = $V * $S
  $x = $c * (1 - [Math]::Abs((($hue / 60) % 2) - 1))
  $m = $V - $c
  if ($hue -lt 60) {
    $rgbPrime = @($c, $x, 0)
  } elseif ($hue -lt 120) {
    $rgbPrime = @($x, $c, 0)
  } elseif ($hue -lt 180) {
    $rgbPrime = @(0, $c, $x)
  } elseif ($hue -lt 240) {
    $rgbPrime = @(0, $x, $c)
  } elseif ($hue -lt 300) {
    $rgbPrime = @($x, 0, $c)
  } else {
    $rgbPrime = @($c, 0, $x)
  }
  return [System.Drawing.Color]::FromArgb(
    255,
    (Clamp-Byte (($rgbPrime[0] + $m) * 255)),
    (Clamp-Byte (($rgbPrime[1] + $m) * 255)),
    (Clamp-Byte (($rgbPrime[2] + $m) * 255))
  )
}

function Convert-ColorModel([string]$Model, [double[]]$Values) {
  if ($Values.Count -lt 3) {
    return [System.Drawing.Color]::Gray
  }
  if ($Model -eq "rgb") {
    $rgb = $Values[0..2] | ForEach-Object {
      if ($_ -le 1) { Clamp-Byte ($_ * 255) } else { Clamp-Byte $_ }
    }
    return [System.Drawing.Color]::FromArgb(255, $rgb[0], $rgb[1], $rgb[2])
  }
  if ($Model -eq "hsv" -or $Model -eq "hsv360") {
    $s = if ($Values[1] -gt 1) { $Values[1] / 100 } else { $Values[1] }
    $v = if ($Values[2] -gt 1) { $Values[2] / 100 } else { $Values[2] }
    return Convert-HsvToRgb $Values[0] $s $v
  }
  $direct = $Values[0..2]
  if (($direct | Where-Object { $_ -gt 1 }).Count -eq 0) {
    $direct = $direct | ForEach-Object { $_ * 255 }
  }
  return [System.Drawing.Color]::FromArgb(
    255,
    (Clamp-Byte $direct[0]),
    (Clamp-Byte $direct[1]),
    (Clamp-Byte $direct[2])
  )
}

function Read-NamedColors([string]$RootGamePath) {
  $colorMap = @{}
  $root = Join-Path $RootGamePath "game\common\named_colors"
  if (!(Test-Path -LiteralPath $root)) {
    throw "Named color directory not found: $root"
  }
  $pattern = '^\s*([A-Za-z0-9_]+)\s*=\s*(?:(rgb|hsv|hsv360)\s*)?\{\s*([^{}#]+?)\s*\}'
  Get-ChildItem -LiteralPath $root -Filter *.txt | Sort-Object FullName | ForEach-Object {
    foreach ($line in [System.IO.File]::ReadLines($_.FullName)) {
      $clean = ($line -replace '#.*$', '')
      $match = [regex]::Match($clean, $pattern)
      if (!$match.Success) {
        continue
      }
      $name = $match.Groups[1].Value
      $model = $match.Groups[2].Value
      if ([string]::IsNullOrWhiteSpace($model)) {
        $model = "rgb255"
      }
      $values = $match.Groups[3].Value -split '\s+' |
        Where-Object { $_ -ne "" } |
        ForEach-Object { [double]::Parse($_, [Globalization.CultureInfo]::InvariantCulture) }
      $colorMap[$name] = Convert-ColorModel $model ([double[]]$values)
    }
  }
  return $colorMap
}

function Get-PropertyValue($ObjectValue, [string]$Name) {
  if ($null -eq $ObjectValue) {
    return $null
  }
  $property = $ObjectValue.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }
  return [string]$property.Value
}

function Resolve-ColorName([string]$Name, $VariantColors) {
  $current = $Name
  $seen = @{}
  while ($current -match '^color\d+$') {
    if ($seen.ContainsKey($current)) {
      break
    }
    $seen[$current] = $true
    $next = Get-PropertyValue $VariantColors $current
    if ([string]::IsNullOrWhiteSpace($next)) {
      break
    }
    $current = $next
  }
  return $current
}

function Get-NamedColor($ColorMap, [string]$Name) {
  if ($ColorMap.ContainsKey($Name)) {
    return $ColorMap[$Name]
  }
  return [System.Drawing.Color]::Gray
}

function Get-VariantColor($VariantColors, [string]$Slot, $ColorMap) {
  $name = Resolve-ColorName $Slot $VariantColors
  return Get-NamedColor $ColorMap $name
}

function Get-LayerColor($LayerColors, $VariantColors, [string]$Slot, $ColorMap) {
  $raw = Get-PropertyValue $LayerColors $Slot
  if ([string]::IsNullOrWhiteSpace($raw)) {
    $raw = $Slot
  }
  $name = Resolve-ColorName $raw $VariantColors
  return Get-NamedColor $ColorMap $name
}

function New-RectF([double]$X, [double]$Y, [double]$Width, [double]$Height) {
  return [System.Drawing.RectangleF]::new([single]$X, [single]$Y, [single]$Width, [single]$Height)
}

function Get-InstanceRects($Instances, [System.Drawing.RectangleF]$FlagRect) {
  $rects = New-Object System.Collections.Generic.List[object]
  if ($null -eq $Instances -or $Instances.Count -eq 0) {
    $rects.Add([pscustomobject]@{ Rect = $FlagRect; Rotation = 0 })
    return $rects
  }
  foreach ($instance in $Instances) {
    $scale = @($instance.scale) | Where-Object { $null -ne $_ }
    $position = @($instance.position) | Where-Object { $null -ne $_ }
    $offset = @($instance.offset) | Where-Object { $null -ne $_ }
    $sx = if ($scale.Count -ge 1) { [double]$scale[0] } else { 1 }
    $sy = if ($scale.Count -ge 2) { [double]$scale[1] } else { $sx }
    $w = $FlagRect.Width * $sx
    $h = $FlagRect.Height * $sy
    if ($offset.Count -ge 1) {
      $ox = [double]$offset[0]
      $oy = if ($offset.Count -ge 2) { [double]$offset[1] } else { $ox }
      $x = $FlagRect.X + $FlagRect.Width * $ox
      $y = $FlagRect.Y + $FlagRect.Height * $oy
    } else {
      $px = if ($position.Count -ge 1) { [double]$position[0] } else { 0.5 }
      $py = if ($position.Count -ge 2) { [double]$position[1] } else { 0.5 }
      $x = $FlagRect.X + $FlagRect.Width * $px - $w / 2
      $y = $FlagRect.Y + $FlagRect.Height * $py - $h / 2
    }
    $rotation = 0
    if ($null -ne $instance.rotation) {
      $rotation = [double]@($instance.rotation)[0]
    }
    $rects.Add([pscustomobject]@{ Rect = (New-RectF $x $y $w $h); Rotation = $rotation })
  }
  return $rects
}

$script:TintedBitmapCache = @{}

function Get-TintedBitmap([string]$PathValue, [System.Drawing.Color]$Color) {
  $key = "$PathValue|$($Color.ToArgb())"
  if ($script:TintedBitmapCache.ContainsKey($key)) {
    return $script:TintedBitmapCache[$key]
  }
  $source = [System.Drawing.Bitmap]::new($PathValue)
  $bitmap = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      $pixel = $source.GetPixel($x, $y)
      if ($pixel.A -gt 0) {
        $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, $Color.R, $Color.G, $Color.B))
      }
    }
  }
  $source.Dispose()
  $script:TintedBitmapCache[$key] = $bitmap
  return $bitmap
}

function Get-MultiTintedBitmap([string]$PathValue, [System.Drawing.Color]$Color1, [System.Drawing.Color]$Color2, [System.Drawing.Color]$Color3) {
  $key = "$PathValue|$($Color1.ToArgb())|$($Color2.ToArgb())|$($Color3.ToArgb())"
  if ($script:TintedBitmapCache.ContainsKey($key)) {
    return $script:TintedBitmapCache[$key]
  }
  $source = [System.Drawing.Bitmap]::new($PathValue)
  $bitmap = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      $pixel = $source.GetPixel($x, $y)
      if ($pixel.A -le 0) {
        continue
      }
      $slotColor = $Color1
      if ($pixel.G -gt 180) {
        $slotColor = $Color2
      } elseif ($pixel.R -gt 180 -and $pixel.G -lt 80) {
        $slotColor = $Color3
      }
      $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, $slotColor.R, $slotColor.G, $slotColor.B))
    }
  }
  $source.Dispose()
  $script:TintedBitmapCache[$key] = $bitmap
  return $bitmap
}

function Invoke-RotatedDraw($Graphics, [System.Drawing.RectangleF]$Rect, [double]$Rotation, [scriptblock]$DrawBlock) {
  if ([Math]::Abs($Rotation) -lt 0.001) {
    & $DrawBlock
    return
  }
  $state = $Graphics.Save()
  $Graphics.TranslateTransform($Rect.X + $Rect.Width / 2, $Rect.Y + $Rect.Height / 2)
  $Graphics.RotateTransform([single]$Rotation)
  $Graphics.TranslateTransform(-($Rect.X + $Rect.Width / 2), -($Rect.Y + $Rect.Height / 2))
  & $DrawBlock
  $Graphics.Restore($state)
}

function Fill-Rect($Graphics, [System.Drawing.RectangleF]$Rect, [System.Drawing.Color]$Color) {
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.FillRectangle($brush, $Rect)
  $brush.Dispose()
}

function Draw-Polygon($Graphics, [System.Drawing.PointF[]]$Points, [System.Drawing.Color]$Color) {
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.FillPolygon($brush, $Points)
  $brush.Dispose()
}

function Draw-BasePattern($Graphics, $Variant, [System.Drawing.RectangleF]$Rect, $ColorMap) {
  $color1 = Get-VariantColor $Variant.colors "color1" $ColorMap
  $color2 = Get-VariantColor $Variant.colors "color2" $ColorMap
  $color3 = Get-VariantColor $Variant.colors "color3" $ColorMap
  if ($Variant.pattern -eq "pattern_vertical_split_01.tga") {
    Fill-Rect $Graphics (New-RectF $Rect.X $Rect.Y ($Rect.Width / 2) $Rect.Height) $color1
    Fill-Rect $Graphics (New-RectF ($Rect.X + $Rect.Width / 2) $Rect.Y ($Rect.Width / 2) $Rect.Height) $color2
    return
  }
  if ($Variant.pattern -eq "pattern_horizontal_split_01.tga") {
    Fill-Rect $Graphics (New-RectF $Rect.X $Rect.Y $Rect.Width ($Rect.Height / 2)) $color1
    Fill-Rect $Graphics (New-RectF $Rect.X ($Rect.Y + $Rect.Height / 2) $Rect.Width ($Rect.Height / 2)) $color2
    return
  }
  if ($Variant.pattern -eq "pattern_checkers_01.tga") {
    Fill-Rect $Graphics (New-RectF $Rect.X $Rect.Y ($Rect.Width / 2) ($Rect.Height / 2)) $color1
    Fill-Rect $Graphics (New-RectF ($Rect.X + $Rect.Width / 2) $Rect.Y ($Rect.Width / 2) ($Rect.Height / 2)) $color2
    Fill-Rect $Graphics (New-RectF $Rect.X ($Rect.Y + $Rect.Height / 2) ($Rect.Width / 2) ($Rect.Height / 2)) $color2
    Fill-Rect $Graphics (New-RectF ($Rect.X + $Rect.Width / 2) ($Rect.Y + $Rect.Height / 2) ($Rect.Width / 2) ($Rect.Height / 2)) $color1
    return
  }
  if ($Variant.pattern -eq "pattern_gironny_8.dds") {
    Fill-Rect $Graphics $Rect $color1
    Draw-Polygon $Graphics @(
      [System.Drawing.PointF]::new($Rect.Left, $Rect.Top),
      [System.Drawing.PointF]::new($Rect.Right, $Rect.Top),
      [System.Drawing.PointF]::new($Rect.X + $Rect.Width / 2, $Rect.Y + $Rect.Height / 2)
    ) $color2
    Draw-Polygon $Graphics @(
      [System.Drawing.PointF]::new($Rect.Right, $Rect.Bottom),
      [System.Drawing.PointF]::new($Rect.Left, $Rect.Bottom),
      [System.Drawing.PointF]::new($Rect.X + $Rect.Width / 2, $Rect.Y + $Rect.Height / 2)
    ) $color2
    return
  }
  if ($Variant.pattern -eq "pattern_per_bend.dds") {
    Draw-Polygon $Graphics @(
      [System.Drawing.PointF]::new($Rect.Left, $Rect.Top),
      [System.Drawing.PointF]::new($Rect.Right, $Rect.Top),
      [System.Drawing.PointF]::new($Rect.Left, $Rect.Bottom)
    ) $color1
    Draw-Polygon $Graphics @(
      [System.Drawing.PointF]::new($Rect.Right, $Rect.Bottom),
      [System.Drawing.PointF]::new($Rect.Right, $Rect.Top),
      [System.Drawing.PointF]::new($Rect.Left, $Rect.Bottom)
    ) $color2
    return
  }
  Fill-Rect $Graphics $Rect $color1
  if ($Variant.pattern -eq "pattern_border_double.dds") {
    $outerWidth = [single]($Rect.Height * 0.12)
    $innerWidth = [single]($Rect.Height * 0.045)
    $outerPen = [System.Drawing.Pen]::new($color2, $outerWidth)
    $innerPen = [System.Drawing.Pen]::new($color3, $innerWidth)
    $Graphics.DrawRectangle($outerPen, $Rect.X + $outerWidth / 2, $Rect.Y + $outerWidth / 2, $Rect.Width - $outerWidth, $Rect.Height - $outerWidth)
    $inset = $outerWidth * 1.5
    $Graphics.DrawRectangle($innerPen, $Rect.X + $inset, $Rect.Y + $inset, $Rect.Width - $inset * 2, $Rect.Height - $inset * 2)
    $outerPen.Dispose()
    $innerPen.Dispose()
  }
}

function Draw-Layer($Graphics, $Layer, $Variant, [System.Drawing.RectangleF]$FlagRect, $ColorMap) {
  $texture = [string]$Layer.texture
  $rects = Get-InstanceRects $Layer.instances $FlagRect
  if ($Layer.kind -eq "sub") {
    foreach ($item in $rects) {
      $subRect = $item.Rect
      $rotation = $item.Rotation
      Invoke-RotatedDraw $Graphics $subRect $rotation {
        Draw-SubFlag $Graphics $Layer $Variant $subRect $ColorMap
      }
    }
    return
  }
  if ($texture -eq "ce_tricolor_horizontal.dds") {
    $topColor = Get-VariantColor $Variant.colors "color1" $ColorMap
    $middleColor = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
    $bottomColor = Get-LayerColor $Layer.colors $Variant.colors "color2" $ColorMap
    $stripeHeight = $FlagRect.Height / 3
    Fill-Rect $Graphics (New-RectF $FlagRect.X $FlagRect.Y $FlagRect.Width $stripeHeight) $topColor
    Fill-Rect $Graphics (New-RectF $FlagRect.X ($FlagRect.Y + $stripeHeight) $FlagRect.Width $stripeHeight) $middleColor
    Fill-Rect $Graphics (New-RectF $FlagRect.X ($FlagRect.Y + $stripeHeight * 2) $FlagRect.Width ($FlagRect.Height - $stripeHeight * 2)) $bottomColor
    return
  }
  if ($texture -eq "ce_tricolor_vertical.dds") {
    $leftColor = Get-VariantColor $Variant.colors "color1" $ColorMap
    $middleColor = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
    $rightColor = Get-LayerColor $Layer.colors $Variant.colors "color2" $ColorMap
    $stripeWidth = $FlagRect.Width / 3
    Fill-Rect $Graphics (New-RectF $FlagRect.X $FlagRect.Y $stripeWidth $FlagRect.Height) $leftColor
    Fill-Rect $Graphics (New-RectF ($FlagRect.X + $stripeWidth) $FlagRect.Y $stripeWidth $FlagRect.Height) $middleColor
    Fill-Rect $Graphics (New-RectF ($FlagRect.X + $stripeWidth * 2) $FlagRect.Y ($FlagRect.Width - $stripeWidth * 2) $FlagRect.Height) $rightColor
    return
  }
  if ($texture -eq "ce_bicolor_bottom.dds") {
    $bottomColor = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
    Fill-Rect $Graphics (New-RectF $FlagRect.X ($FlagRect.Y + $FlagRect.Height / 2) $FlagRect.Width ($FlagRect.Height / 2)) $bottomColor
    return
  }
  if ($texture -eq "ce_bicolor_left.dds") {
    $leftColor = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
    Fill-Rect $Graphics (New-RectF $FlagRect.X $FlagRect.Y ($FlagRect.Width / 2) $FlagRect.Height) $leftColor
    return
  }
  if ($texture -eq "ce_bicolor_right.dds") {
    $rightColor = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
    Fill-Rect $Graphics (New-RectF ($FlagRect.X + $FlagRect.Width / 2) $FlagRect.Y ($FlagRect.Width / 2) $FlagRect.Height) $rightColor
    return
  }
  if ($texture -eq "ce_stripes_9.dds") {
    $stripeColor = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
    $stripeHeight = $FlagRect.Height / 9
    for ($stripe = 1; $stripe -lt 9; $stripe += 2) {
      Fill-Rect $Graphics (New-RectF $FlagRect.X ($FlagRect.Y + $stripeHeight * $stripe) $FlagRect.Width $stripeHeight) $stripeColor
    }
    return
  }
  foreach ($item in $rects) {
    $rect = $item.Rect
    $rotation = $item.Rotation
    if ($texture -eq "ce_solid.dds") {
      $fill = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
      Invoke-RotatedDraw $Graphics $rect $rotation { Fill-Rect $Graphics $rect $fill }
      continue
    }
    $assetPath = [string]$Layer.asset.path
    if ([string]::IsNullOrWhiteSpace($assetPath) -or !(Test-Path -LiteralPath $assetPath)) {
      continue
    }
    if ($Layer.kind -eq "colored_emblem") {
      if ($texture -eq "ce_circle.dds" -and $Layer.mask -and @($Layer.mask)[0] -eq 2) {
        $fill = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
        $halfRect = New-RectF $rect.X ($rect.Y + $rect.Height / 2) $rect.Width ($rect.Height / 2)
        $state = $Graphics.Save()
        $Graphics.SetClip($halfRect)
        $image = Get-TintedBitmap $assetPath $fill
        Invoke-RotatedDraw $Graphics $rect $rotation { $Graphics.DrawImage($image, $rect) }
        $Graphics.Restore($state)
      } else {
        $fill1 = Get-LayerColor $Layer.colors $Variant.colors "color1" $ColorMap
        $fill2 = Get-LayerColor $Layer.colors $Variant.colors "color2" $ColorMap
        $fill3 = Get-LayerColor $Layer.colors $Variant.colors "color3" $ColorMap
        $image = Get-MultiTintedBitmap $assetPath $fill1 $fill2 $fill3
        Invoke-RotatedDraw $Graphics $rect $rotation { $Graphics.DrawImage($image, $rect) }
      }
    } else {
      $image = [System.Drawing.Image]::FromFile($assetPath)
      Invoke-RotatedDraw $Graphics $rect $rotation { $Graphics.DrawImage($image, $rect) }
      $image.Dispose()
    }
  }
}

function Merge-Colors($ParentColors, $LocalColors) {
  $merged = [pscustomobject]@{}
  if ($null -ne $ParentColors) {
    foreach ($property in $ParentColors.PSObject.Properties) {
      $merged | Add-Member -NotePropertyName $property.Name -NotePropertyValue $property.Value -Force
    }
  }
  if ($null -ne $LocalColors) {
    foreach ($property in $LocalColors.PSObject.Properties) {
      $merged | Add-Member -NotePropertyName $property.Name -NotePropertyValue $property.Value -Force
    }
  }
  return $merged
}

function Draw-SubFlag($Graphics, $Layer, $ParentVariant, [System.Drawing.RectangleF]$Rect, $ColorMap) {
  $subVariant = [pscustomobject]@{
    key = $Layer.parent
    pattern = $Layer.pattern
    colors = Merge-Colors $ParentVariant.colors $Layer.colors
    layers = @($Layer.layers)
  }
  if (![string]::IsNullOrWhiteSpace([string]$subVariant.pattern)) {
    Draw-BasePattern $Graphics $subVariant $Rect $ColorMap
  }
  foreach ($subLayer in @($Layer.layers)) {
    Draw-Layer $Graphics $subLayer $subVariant $Rect $ColorMap
  }
}

function Draw-Flag($Graphics, $Variant, [System.Drawing.RectangleF]$Rect, $ColorMap) {
  Draw-BasePattern $Graphics $Variant $Rect $ColorMap
  foreach ($layer in $Variant.layers) {
    Draw-Layer $Graphics $layer $Variant $Rect $ColorMap
  }
  $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 40, 40, 40), 1)
  $Graphics.DrawRectangle($borderPen, $Rect.X, $Rect.Y, $Rect.Width, $Rect.Height)
  $borderPen.Dispose()
}

$inputPath = Resolve-PathForWrite $InputJson
$outputPath = Resolve-PathForWrite $OutFile
$outputDir = if ([string]::IsNullOrWhiteSpace($OutDir)) { "" } else { Resolve-PathForWrite $OutDir }
$data = [System.IO.File]::ReadAllText($inputPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$colorMap = Read-NamedColors $GamePath

$variants = @($data.variants)
if ($MaxVariants -gt 0 -and $variants.Count -gt $MaxVariants) {
  $variants = @($variants | Select-Object -First $MaxVariants)
}

if ($Mode -eq "variants") {
  if ([string]::IsNullOrWhiteSpace($outputDir)) {
    throw "OutDir is required for variants mode"
  }
  if (!(Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
  } else {
    Get-ChildItem -LiteralPath $outputDir -Filter *.png | Remove-Item -Force
  }
  foreach ($variant in $variants) {
    $exportKey = if (![string]::IsNullOrWhiteSpace([string]$variant.exportKey)) { [string]$variant.exportKey } else { [string]$variant.key }
    $fileName = Get-SafeFileStem $exportKey
    $variantPath = Join-Path $outputDir "$fileName.png"
    $variantBitmap = [System.Drawing.Bitmap]::new($FlagWidth, $FlagHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $variantGraphics = [System.Drawing.Graphics]::FromImage($variantBitmap)
    $variantGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $variantGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $variantGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $variantGraphics.Clear([System.Drawing.Color]::Transparent)
    Draw-Flag $variantGraphics $variant (New-RectF 0 0 $FlagWidth $FlagHeight) $colorMap
    $variantBitmap.Save($variantPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $variantGraphics.Dispose()
    $variantBitmap.Dispose()
  }
  foreach ($cached in $script:TintedBitmapCache.Values) {
    $cached.Dispose()
  }
  Write-Host "wrote $($variants.Count) variant PNGs to $outputDir"
  exit 0
}

$columns = [Math]::Max(1, $Columns)
$rows = [Math]::Ceiling($variants.Count / $columns)
$labelHeight = 28
$padding = 22
$gap = 22
$tileWidth = $FlagWidth + $padding * 2
$tileHeight = $FlagHeight + $labelHeight + $padding * 2
$canvasWidth = $columns * $tileWidth + ($columns - 1) * $gap
$canvasHeight = $rows * $tileHeight + ($rows - 1) * $gap

$bitmap = [System.Drawing.Bitmap]::new($canvasWidth, $canvasHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::FromArgb(246, 246, 246))

$font = [System.Drawing.Font]::new("Segoe UI", 9, [System.Drawing.FontStyle]::Regular)
$labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(38, 38, 38))
$tileBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 255))
$tilePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220, 220, 220), 1)
$format = [System.Drawing.StringFormat]::new()
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

for ($index = 0; $index -lt $variants.Count; $index++) {
  $variant = $variants[$index]
  $column = $index % $columns
  $row = [Math]::Floor($index / $columns)
  $tileX = $column * ($tileWidth + $gap)
  $tileY = $row * ($tileHeight + $gap)
  $tileRect = New-RectF $tileX $tileY $tileWidth $tileHeight
  $flagRect = New-RectF ($tileX + $padding) ($tileY + $padding) $FlagWidth $FlagHeight
  $labelRect = New-RectF ($tileX + $padding) ($flagRect.Bottom + 6) $FlagWidth ($labelHeight - 6)
  $graphics.FillRectangle($tileBrush, $tileRect)
  $graphics.DrawRectangle($tilePen, $tileRect.X, $tileRect.Y, $tileRect.Width, $tileRect.Height)
  Draw-Flag $graphics $variant $flagRect $colorMap
  $graphics.DrawString([string]$variant.key, $font, $labelBrush, $labelRect, $format)
}

$outDir = Split-Path -Parent $outputPath
if (!(Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$format.Dispose()
$tilePen.Dispose()
$tileBrush.Dispose()
$labelBrush.Dispose()
$font.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
foreach ($cached in $script:TintedBitmapCache.Values) {
  $cached.Dispose()
}

Write-Host "wrote $outputPath"
