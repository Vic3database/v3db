# Vicdata Segoe Print Icon Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 将 Vicdata 图标改为 Segoe Print 三行站名大图标与带金色边框的金色 V 小图标。

**Architecture:** scripts/build_brand_icons.ps1 继续作为唯一生成入口：512、192、180 像素生成 Vic3 / Data / Base，64、48、32、16 像素生成 V。中小尺寸导出范围为 64、48、32、16 像素。scripts/check_brand_icon_assets.ps1 独立读取成品，验证图形尺寸、透明圆角、深蓝底、金色边框、SVG 文字结构与网站引用。

**Tech Stack:** 静态 HTML、Web App Manifest、PowerShell、.NET System.Drawing、Segoe Print、Node.js 检查脚本。

---

## 文件结构

- scripts/build_brand_icons.ps1：生成 SVG 母版和七种 PNG。
- scripts/check_brand_icon_assets.ps1：检查 PNG 像素、SVG 内容和网站图标引用。
- site/assets/brand/：保存 SVG 与 PNG 成品。
- site/index.html、site/site.webmanifest、scripts/check_ui_ideology_contracts.mjs：保持已存在的 SVG 页眉与 PNG 清单引用。

### Task 1: 先更新并验证新图标契约

**Files:**

- Modify: scripts/check_brand_icon_assets.ps1
- Test: scripts/check_brand_icon_assets.ps1

- [ ] **Step 1: 添加颜色计数和边框采样函数**

将以下函数放在 $expected 定义之后：

~~~powershell
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

function Assert-GoldMark([string]$file, [int]$minimumPixels) {
  $image = [System.Drawing.Image]::FromFile($file)
  try {
    $goldPixelCount = Get-NearColorPixelCount $image $gold
    if ($goldPixelCount -lt $minimumPixels) {
      $failures.Add("$(Split-Path -Leaf $file) must contain a visible #D7AF4B mark and border")
    }
    $borderSample = $image.GetPixel([int]($image.Width * 0.5), [int]($image.Height * 0.065))
    if (-not (Test-NearColor $borderSample $gold)) {
      $failures.Add("$(Split-Path -Leaf $file) must retain a single gold border")
    }
  } finally {
    $image.Dispose()
  }
}
~~~

- [ ] **Step 2: 以 Segoe Print 和三行站名的 SVG 契约替换旧四字方阵契约**

将 SVG 验证块替换为：

~~~powershell
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
~~~

在 SVG 检查块之后添加：

~~~powershell
foreach ($item in $expected) {
  $file = Join-Path $brand $item.Name
  $minimumGoldPixels = if ($item.Size -ge 180) {
    [Math]::Round($item.Size * $item.Size * 0.035)
  } else {
    [Math]::Max(8, [Math]::Round($item.Size * $item.Size * 0.065))
  }
  Assert-GoldMark $file $minimumGoldPixels
}
~~~

- [ ] **Step 3: 运行契约并确认其因旧图标失败**

Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check_brand_icon_assets.ps1

Expected: 退出码为 1，输出 SVG 缺少 Segoe Print、Vic3、Data、Base，且仍包含旧的 3、D、B 和 Palatino Linotype。

- [ ] **Step 4: 提交失败契约**

~~~powershell
git add scripts/check_brand_icon_assets.ps1
git commit -m "test: define Segoe Print icon contract"
~~~

### Task 2: 用 Segoe Print 生成 SVG 与 PNG

**Files:**

- Modify: scripts/build_brand_icons.ps1
- Modify: site/assets/brand/vicdata-icon.svg
- Modify: site/assets/brand/vicdata-icon-512.png
- Modify: site/assets/brand/vicdata-icon-192.png
- Modify: site/assets/brand/apple-touch-icon.png
- Modify: site/assets/brand/vicdata-icon-64.png
- Modify: site/assets/brand/vicdata-icon-48.png
- Modify: site/assets/brand/favicon-32.png
- Modify: site/assets/brand/favicon-16.png

- [ ] **Step 1: 将生成器字体和边框规则改为 Segoe Print 与单层金框**

在生成器变量段替换或新增：

~~~powershell
$fontFamily = 'Segoe Print'
$navy = [System.Drawing.Color]::FromArgb(255, 16, 44, 60)
$gold = [System.Drawing.Color]::FromArgb(255, 215, 175, 75)
$paleGold = [System.Drawing.Color]::FromArgb(255, 242, 209, 122)

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
~~~

删除只在 size 大于等于 180 时绘制双层边框的分支。Write-Png 在填充深蓝圆角底之后，对所有尺寸调用 Draw-SingleGoldBorder。

- [ ] **Step 2: 添加三行站名和单字 V 的绘制函数**

以以下函数替换原有 Draw-Label 函数：

~~~powershell
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
      try { $graphics.DrawPath($stroke, $textPath) } finally { $stroke.Dispose() }
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
~~~

在 Write-Png 中，用以下分支替换旧的 V3DB 与小尺寸 V 绘制代码：

~~~powershell
if ($size -ge 180) {
  Draw-Wordmark $graphics $size
} else {
  Draw-CompactV $graphics $size
}
~~~

- [ ] **Step 3: 替换 SVG 母版文本、字体和边框**

将 $svg 内容替换为：

~~~xml
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="92" fill="#102C3C"/>
  <rect x="31" y="31" width="450" height="450" rx="72" fill="none" stroke="#D7AF4B" stroke-width="11"/>
  <g fill="#D7AF4B" stroke="#F2D17A" stroke-width="1.5" paint-order="stroke fill" font-family="Segoe Print, Segoe UI, cursive" font-weight="700" text-anchor="middle">
    <text x="256" y="191" font-size="146">Vic3</text>
    <text x="256" y="292" font-size="114">Data</text>
    <text x="256" y="391" font-size="114">Base</text>
  </g>
</svg>
~~~

- [ ] **Step 4: 生成图标并确认契约转绿**

Run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build_brand_icons.ps1; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check_brand_icon_assets.ps1

Expected: 输出 {"brand_icon_assets":"ok"}。512、192、180 显示三行站名；64、48、32、16 显示深蓝圆角底、金色边框和金色 V。

- [ ] **Step 5: 提交生成器与图标资产**

~~~powershell
git add scripts/build_brand_icons.ps1 site/assets/brand
git commit -m "feat: refine Vicdata Segoe Print icon family"
~~~

### Task 3: 验证网页引用和发布包

**Files:**

- Verify: site/index.html
- Verify: site/site.webmanifest
- Verify: scripts/check_ui_ideology_contracts.mjs
- Verify: scripts/check_publish_bundle.mjs

- [ ] **Step 1: 运行网页与发布静态检查**

Run: node scripts/check_ui_ideology_contracts.mjs; node scripts/check_publish_bundle.mjs; git diff --check

Expected: 三项命令以退出码 0 结束；页眉仍引用 assets/brand/vicdata-icon.svg，清单仍引用 192 和 512 像素 PNG。

- [ ] **Step 2: 启动本地站点并请求 SVG**

Run: node scripts/serve_site.mjs site 8876

在第二个终端运行：

~~~powershell
$response = Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:8876/assets/brand/vicdata-icon.svg
if ($response.StatusCode -ne 200 -or $response.Content -notmatch '>Vic3<') {
  throw 'SVG brand icon did not return the Segoe Print wordmark.'
}
~~~

Expected: 首页和 SVG 均返回 HTTP 200，SVG 正文包含 Vic3。

- [ ] **Step 3: 若前两步均通过，不创建额外网页接入提交**

执行：

~~~powershell
git status --short --branch
~~~

Expected: 只有前两项任务已提交的修改；既有网页引用无需变更。

### Task 4: 目视验收和最终检查

**Files:**

- Verify: site/assets/brand/vicdata-icon-512.png
- Verify: site/assets/brand/vicdata-icon-192.png
- Verify: site/assets/brand/apple-touch-icon.png
- Verify: site/assets/brand/vicdata-icon-64.png
- Verify: site/assets/brand/vicdata-icon-48.png
- Verify: site/assets/brand/favicon-32.png
- Verify: site/assets/brand/favicon-16.png

- [ ] **Step 1: 查看三种大尺寸图标**

打开 512、192、180 像素 PNG。

Expected: 每个图标都有透明圆角外侧、深蓝底、单层金框及居中的 Vic3 / Data / Base；180 像素文字没有裁切或相互接触。

- [ ] **Step 2: 查看四种金色 V 图标**

打开 64、48、32、16 像素 PNG。

Expected: 每个图标都有深蓝圆角底、可见的单层金框及居中的金色 V；16 像素中 V 与边框保持至少一个深蓝像素间隙。

- [ ] **Step 3: 运行完整最终验证**

Run:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check_brand_icon_assets.ps1
node scripts/check_publish_bundle.mjs
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_about_page.mjs
node scripts/check_filter_order.mjs --file site/index.html
git diff --check
git status --short --branch
git log --oneline -5
~~~

Expected: 全部检查成功，工作树干净，日志包含规格、实施计划、契约和图标生成提交。
