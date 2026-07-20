# Vicdata Brand Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 为 Vicdata 生成可编辑的蓝金圆角方形图标，并接入网页、应用图标和浏览器图标。

**Architecture:** scripts/build_brand_icons.ps1 是唯一的图形生成入口，统一写出 SVG 母版与七个 PNG 尺寸。scripts/check_brand_icon_assets.ps1 独立读取生成结果和网页引用，检查尺寸、透明角、底色、SVG 结构及引用关系。网页继续使用 PNG 作为兼容回退，页眉与现代浏览器优先使用 SVG。

**Tech Stack:** 静态 HTML、Web App Manifest、Node.js 发布检查、PowerShell、.NET System.Drawing、Windows 已安装的 Palatino Linotype 字体。

---

## 文件结构

scripts/build_brand_icons.ps1 生成 SVG 和所有 PNG；scripts/check_brand_icon_assets.ps1 负责独立验收；site/assets/brand/vicdata-icon.svg 是 512 像素可编辑母版；site/assets/brand/ 内的 PNG 是浏览器与应用使用的导出物。site/index.html、site/site.webmanifest 和 scripts/check_ui_ideology_contracts.mjs 只处理图标引用及其静态契约。

### Task 1: 先建立图标资产验收脚本

**Files:**
- Create: scripts/check_brand_icon_assets.ps1

- [ ] **Step 1: 写入会失败的资产检查脚本**

~~~powershell
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
  if (-not (Test-Path -LiteralPath $file)) { $failures.Add("missing $($item.Name)"); continue }
  $image = [System.Drawing.Image]::FromFile($file)
  try {
    if ($image.Width -ne $item.Size -or $image.Height -ne $item.Size) { $failures.Add("$($item.Name) should be $($item.Size)x$($item.Size)") }
    if ($image.GetPixel(0, 0).A -ne 0) { $failures.Add("$($item.Name) must keep transparent rounded corners") }
    $sample = $image.GetPixel([int]($item.Size * 0.15), [int]($item.Size * 0.5))
    if ($sample.R -ne 16 -or $sample.G -ne 44 -or $sample.B -ne 60) { $failures.Add("$($item.Name) must use the #102C3C navy field") }
  } finally { $image.Dispose() }
}

$svg = Join-Path $brand 'vicdata-icon.svg'
if (-not (Test-Path -LiteralPath $svg)) { $failures.Add('missing vicdata-icon.svg') }
else {
  $svgText = Get-Content -LiteralPath $svg -Raw
  foreach ($fragment in @('#102C3C', '#D7AF4B', '>V<', '>3<', '>D<', '>B<')) {
    if (-not $svgText.Contains($fragment)) { $failures.Add("SVG lacks $fragment") }
  }
}

$index = Get-Content -LiteralPath (Join-Path $Root 'site\index.html') -Raw
foreach ($fragment in @('vicdata-icon.svg', 'favicon-32.png', 'apple-touch-icon.png')) {
  if (-not $index.Contains($fragment)) { $failures.Add("index.html lacks $fragment") }
}

$manifest = Get-Content -LiteralPath (Join-Path $Root 'site\site.webmanifest') -Raw | ConvertFrom-Json
if (($manifest.icons.src -notcontains 'assets/brand/vicdata-icon-192.png') -or ($manifest.icons.src -notcontains 'assets/brand/vicdata-icon-512.png')) {
  $failures.Add('manifest must retain the 192 and 512 PNG icons')
}

if ($failures.Count) { $failures | ForEach-Object { Write-Error "- $_" }; exit 1 }
Write-Output '{"brand_icon_assets":"ok"}'
~~~

- [ ] **Step 2: 运行检查，确认缺失 SVG、64、48 与 16 像素文件时失败**

Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check_brand_icon_assets.ps1

Expected: 以 missing vicdata-icon.svg、missing vicdata-icon-64.png、missing vicdata-icon-48.png 和 missing favicon-16.png 退出。

- [ ] **Step 3: 提交验收脚本**

~~~powershell
git add scripts/check_brand_icon_assets.ps1
git commit -m "test: add brand icon asset contract"
~~~

### Task 2: 生成蓝金 SVG 母版与全部 PNG 尺寸

**Files:**
- Create: scripts/build_brand_icons.ps1
- Create: site/assets/brand/vicdata-icon.svg
- Create: site/assets/brand/vicdata-icon-64.png
- Create: site/assets/brand/vicdata-icon-48.png
- Create: site/assets/brand/favicon-16.png
- Modify: site/assets/brand/vicdata-icon-512.png
- Modify: site/assets/brand/vicdata-icon-192.png
- Modify: site/assets/brand/apple-touch-icon.png
- Modify: site/assets/brand/favicon-32.png

- [ ] **Step 1: 新建生成器并固定调色板、字形与尺寸表**

~~~powershell
param([string]$Root = (Split-Path -Parent $PSScriptRoot))

Add-Type -AssemblyName System.Drawing
$brand = Join-Path $Root 'site\assets\brand'
$navy = [System.Drawing.Color]::FromArgb(255, 16, 44, 60)
$gold = [System.Drawing.Color]::FromArgb(255, 215, 175, 75)
$paleGold = [System.Drawing.Color]::FromArgb(255, 242, 209, 122)
$exports = @(
  @{ Name = 'vicdata-icon-512.png'; Size = 512 }, @{ Name = 'vicdata-icon-192.png'; Size = 192 },
  @{ Name = 'apple-touch-icon.png'; Size = 180 }, @{ Name = 'vicdata-icon-64.png'; Size = 64 },
  @{ Name = 'vicdata-icon-48.png'; Size = 48 }, @{ Name = 'favicon-32.png'; Size = 32 },
  @{ Name = 'favicon-16.png'; Size = 16 }
)

function New-RoundedPath([int]$size) {
  $radius = [Math]::Round($size * 0.18)
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc(0, 0, $radius * 2, $radius * 2, 180, 90)
  $path.AddArc($size - $radius * 2, 0, $radius * 2, $radius * 2, 270, 90)
  $path.AddArc($size - $radius * 2, $size - $radius * 2, $radius * 2, $radius * 2, 0, 90)
  $path.AddArc(0, $size - $radius * 2, $radius * 2, $radius * 2, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Label($graphics, [int]$size, [string]$text, [single]$x, [single]$y, [single]$fontSize) {
  $font = [System.Drawing.Font]::new('Palatino Linotype', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  try { $graphics.DrawString($text, $font, [System.Drawing.SolidBrush]::new($gold), $x, $y, $format) }
  finally { $format.Dispose(); $font.Dispose() }
}

function Write-Png([string]$path, [int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  try {
    $shape = New-RoundedPath $size
    try { $graphics.FillPath([System.Drawing.SolidBrush]::new($navy), $shape) } finally { $shape.Dispose() }
    if ($size -ge 180) {
      foreach ($inset in @(0.052, 0.082)) {
        $margin = [Math]::Round($size * $inset)
        $pen = [System.Drawing.Pen]::new($(if ($inset -lt 0.07) { $paleGold } else { $gold }), [Math]::Max(1, [Math]::Round($size * 0.007)))
        try { $graphics.DrawRectangle($pen, $margin, $margin, $size - $margin * 2 - 1, $size - $margin * 2 - 1) } finally { $pen.Dispose() }
      }
    }
    if ($size -le 32) { Draw-Label $graphics $size 'V' ($size / 2) ($size * 0.48) ($size * 0.70) }
    else {
      $fontSize = $size * 0.31
      Draw-Label $graphics $size 'V' ($size * 0.35) ($size * 0.34) $fontSize
      Draw-Label $graphics $size '3' ($size * 0.65) ($size * 0.34) $fontSize
      Draw-Label $graphics $size 'D' ($size * 0.35) ($size * 0.66) $fontSize
      Draw-Label $graphics $size 'B' ($size * 0.65) ($size * 0.66) $fontSize
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

foreach ($export in $exports) { Write-Png (Join-Path $brand $export.Name) $export.Size }

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
~~~

- [ ] **Step 2: 由同一组固定颜色和方阵结构写出 SVG 母版**

~~~xml
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="92" fill="#102C3C"/>
  <rect x="27" y="27" width="458" height="458" rx="70" fill="none" stroke="#F2D17A" stroke-width="4"/>
  <rect x="42" y="42" width="428" height="428" rx="57" fill="none" stroke="#D7AF4B" stroke-width="4"/>
  <g fill="#D7AF4B" font-family="Palatino Linotype, Garamond, serif" font-size="160" font-weight="700" text-anchor="middle" dominant-baseline="middle">
    <text x="179" y="174">V</text><text x="333" y="174">3</text><text x="179" y="338">D</text><text x="333" y="338">B</text>
  </g>
</svg>
~~~

生成器使用同一坐标、颜色和文字布局写入 SVG，再逐项写入 PNG，避免 SVG 与位图出现不同的标记规则。

- [ ] **Step 3: 运行生成器并重新运行验收脚本**

Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build_brand_icons.ps1; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check_brand_icon_assets.ps1

Expected: 输出 {"brand_icon_assets":"ok"}；全部七个 PNG 的左上角透明，且每个尺寸的图形位于深海军蓝圆角方形中。

- [ ] **Step 4: 提交生成器与图标资产**

~~~powershell
git add scripts/build_brand_icons.ps1 site/assets/brand
git commit -m "feat: add blue gold Vicdata icon family"
~~~

### Task 3: 接入网页图标与静态契约

**Files:**
- Modify: site/index.html:8-15
- Modify: site/site.webmanifest:3-17
- Modify: scripts/check_ui_ideology_contracts.mjs:176

- [ ] **Step 1: 更新网页图标和页眉引用**

~~~html
<link rel="icon" type="image/svg+xml" href="assets/brand/vicdata-icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="assets/brand/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/brand/apple-touch-icon.png">
~~~

将页眉中的图像地址改为 assets/brand/vicdata-icon.svg，保留 class="brand-logo"、空 alt 和 aria-hidden="true"。

- [ ] **Step 2: 将应用清单的颜色和图标列表同步为蓝金方案**

~~~json
{
  "theme_color": "#102C3C",
  "background_color": "#102C3C",
  "icons": [
    { "src": "assets/brand/vicdata-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/brand/vicdata-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
~~~

- [ ] **Step 3: 调整已有界面检查的图标断言并运行相关检查**

~~~javascript
assert(/class="[^"]*\bbrand-logo\b"[^>]*assets\/brand\/vicdata-icon\.svg/.test(indexSource), "topbar brand should use the Vicdata SVG brand icon");
~~~

Run: node scripts/check_ui_ideology_contracts.mjs; node scripts/check_publish_bundle.mjs; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check_brand_icon_assets.ps1; git diff --check

Expected: 四个命令全部成功；发布检查将 SVG、PNG 和清单图标均纳入已发布文件。

- [ ] **Step 4: 提交网页接入改动**

~~~powershell
git add site/index.html site/site.webmanifest scripts/check_ui_ideology_contracts.mjs
git commit -m "feat: wire Vicdata brand icon assets"
~~~

### Task 4: 目视检查多尺寸图形并完成验收

**Files:**
- Verify: site/assets/brand/vicdata-icon-512.png
- Verify: site/assets/brand/vicdata-icon-48.png
- Verify: site/assets/brand/favicon-32.png
- Verify: site/assets/brand/favicon-16.png
- Verify: site/index.html

- [ ] **Step 1: 分别查看 512、48、32 与 16 像素文件**

Run: 使用图像查看器依次打开 site/assets/brand/vicdata-icon-512.png、site/assets/brand/vicdata-icon-48.png、site/assets/brand/favicon-32.png、site/assets/brand/favicon-16.png。

Expected: 512 与 48 像素显示紧凑的 V 3 / D B；32 与 16 像素只显示居中的金色 V；所有图像均保留透明圆角外侧。

- [ ] **Step 2: 启动静态站点并检查页眉图标请求**

Run: node scripts/serve_site.mjs site 8876

Expected: 首页页眉显示新的蓝金 SVG 图标，浏览器请求 assets/brand/vicdata-icon.svg，没有 404。

- [ ] **Step 3: 记录最终验证并提交工作树状态**

~~~powershell
git status --short --branch
git log --oneline -3
~~~

Expected: 工作树干净，最近三次提交依次包含图标接入、图标资产和资产契约。
