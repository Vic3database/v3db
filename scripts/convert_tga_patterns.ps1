param(
  [string]$SourceDir = "D:\SteamLibrary\steamapps\common\Victoria 3\game\gfx\coat_of_arms\patterns",
  [string]$OutDir = "game\gfx\coat_of_arms\patterns"
)

Add-Type -AssemblyName System.Drawing

$files = @(
  "pattern_vertical_split_01.tga",
  "pattern_horizontal_split_01.tga",
  "pattern_checkers_01.tga",
  "pattern_border_fringe.tga"
)

function Resolve-WritePath([string]$PathValue) {
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $PathValue))
}

function Read-U16LE([byte[]]$Bytes, [int]$Offset) {
  return [int]$Bytes[$Offset] -bor ([int]$Bytes[$Offset + 1] -shl 8)
}

function Read-Tga([string]$PathValue) {
  $bytes = [System.IO.File]::ReadAllBytes($PathValue)
  if ($bytes.Length -lt 18) {
    throw "TGA file is too small: $PathValue"
  }

  $idLength = [int]$bytes[0]
  $colorMapType = [int]$bytes[1]
  $imageType = [int]$bytes[2]
  $colorMapLength = Read-U16LE $bytes 5
  $colorMapDepth = [int]$bytes[7]
  $width = Read-U16LE $bytes 12
  $height = Read-U16LE $bytes 14
  $bitsPerPixel = [int]$bytes[16]
  $descriptor = [int]$bytes[17]

  if ($colorMapType -ne 0) {
    throw "Color mapped TGA is not supported: $PathValue"
  }
  if ($imageType -ne 2 -and $imageType -ne 3 -and $imageType -ne 10 -and $imageType -ne 11) {
    throw "Unsupported TGA image type $imageType in $PathValue"
  }
  if ($bitsPerPixel -ne 8 -and $bitsPerPixel -ne 24 -and $bitsPerPixel -ne 32) {
    throw "Unsupported TGA bit depth $bitsPerPixel in $PathValue"
  }

  $bytesPerPixel = [int]($bitsPerPixel / 8)
  $colorMapBytes = if ($colorMapType -eq 0) { 0 } else { [int][Math]::Ceiling($colorMapLength * $colorMapDepth / 8) }
  $offset = 18 + $idLength + $colorMapBytes
  $topOrigin = (($descriptor -band 0x20) -ne 0)
  $rightOrigin = (($descriptor -band 0x10) -ne 0)
  $rle = ($imageType -eq 10 -or $imageType -eq 11)

  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $pixelIndex = 0

  while ($pixelIndex -lt ($width * $height)) {
    $repeat = 1
    $rawPacket = $true
    if ($rle) {
      if ($offset -ge $bytes.Length) {
        throw "Unexpected end of RLE data in $PathValue"
      }
      $packet = [int]$bytes[$offset]
      $offset += 1
      $repeat = ($packet -band 0x7f) + 1
      $rawPacket = (($packet -band 0x80) -eq 0)
    }

    if ($rawPacket) {
      for ($i = 0; $i -lt $repeat; $i++) {
        $color = Read-TgaPixel $bytes ([ref]$offset) $bytesPerPixel
        Set-TgaPixel $bitmap $pixelIndex $width $height $topOrigin $rightOrigin $color
        $pixelIndex += 1
      }
    } else {
      $color = Read-TgaPixel $bytes ([ref]$offset) $bytesPerPixel
      for ($i = 0; $i -lt $repeat; $i++) {
        Set-TgaPixel $bitmap $pixelIndex $width $height $topOrigin $rightOrigin $color
        $pixelIndex += 1
      }
    }
  }

  return $bitmap
}

function Read-TgaPixel([byte[]]$Bytes, [ref]$Offset, [int]$BytesPerPixel) {
  if (($Offset.Value + $BytesPerPixel) -gt $Bytes.Length) {
    throw "Unexpected end of pixel data"
  }
  if ($BytesPerPixel -eq 1) {
    $value = [int]$Bytes[$Offset.Value]
    $Offset.Value += 1
    return [System.Drawing.Color]::FromArgb(255, $value, $value, $value)
  }
  $b = [int]$Bytes[$Offset.Value]
  $g = [int]$Bytes[$Offset.Value + 1]
  $r = [int]$Bytes[$Offset.Value + 2]
  $a = if ($BytesPerPixel -eq 4) { [int]$Bytes[$Offset.Value + 3] } else { 255 }
  $Offset.Value += $BytesPerPixel
  return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

function Set-TgaPixel([System.Drawing.Bitmap]$Bitmap, [int]$PixelIndex, [int]$Width, [int]$Height, [bool]$TopOrigin, [bool]$RightOrigin, [System.Drawing.Color]$Color) {
  $x = $PixelIndex % $Width
  $y = [Math]::Floor($PixelIndex / $Width)
  if ($RightOrigin) {
    $x = $Width - 1 - $x
  }
  if (!$TopOrigin) {
    $y = $Height - 1 - $y
  }
  $Bitmap.SetPixel($x, $y, $Color)
}

$sourceRoot = Resolve-WritePath $SourceDir
$outRoot = Resolve-WritePath $OutDir
if (!(Test-Path -LiteralPath $outRoot)) {
  New-Item -ItemType Directory -Path $outRoot | Out-Null
}

foreach ($file in $files) {
  $sourcePath = Join-Path $sourceRoot $file
  if (!(Test-Path -LiteralPath $sourcePath)) {
    throw "Missing source TGA: $sourcePath"
  }
  $outPath = Join-Path $outRoot ([System.IO.Path]::ChangeExtension($file, ".png"))
  $bitmap = Read-Tga $sourcePath
  try {
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "wrote $outPath"
  } finally {
    $bitmap.Dispose()
  }
}
