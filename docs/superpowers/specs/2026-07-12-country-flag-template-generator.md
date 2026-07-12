# Vicdata 通用国旗模板生成器设计

日期：2026-07-12

## 背景

当前国旗解析器已经能处理有专属旗帜脚本的国家，例如大不列颠和伊比利亚联盟。解析范围主要来自 `common/coat_of_arms/coat_of_arms` 和 `common/flag_definitions` 中能归属到国家标签的条目。这个范围覆盖了 503 个标签和 1407 个变体。

安科累 `ANK` 暴露了另一个情况。它在 `common/country_definitions/01_africa.txt` 中有国家定义，颜色是 `126 162 98`，主流文化是 `baganda` 和 `lacustrine_bantu`，文化传承是 `heritage_eastern_bantu`。这个传承属于 `heritage_group_african`。但原版文件中没有单独的 `ANK = { ... }` 旗帜条目，也没有 `ANK` 的 `flag_definition` 条目。当前解析器因此没有把它导出。

这不等于游戏没有安科累国旗。维基页面 `https://vic3.paradoxwikis.com/Eastern_Bantu_kingdoms#Ankole` 使用 `Ankole.png`，浏览器检查中图片说明为 `Flag of Ankole`。本地原版文件也显示，`common/scripted_triggers/00_coa_triggers.txt` 中的 `coa_def_african_trigger` 会命中非洲文化传承，`common/coat_of_arms/template_lists/coa_templates.txt` 会向这类国家加入 `template_tricolor_fimbriated` 等通用模板。安科累应归入“运行时通用模板生成国旗”，不是“没有国旗”。

目前站点已临时为缺失标签生成国家颜色纯色 PNG。这个结果只能作为占位，不应被视为正确复现。

## 目标

新增一条“通用模板国旗生成”链路，用本地原版数据复刻游戏对无专属旗帜标签的生成逻辑。第一阶段只要求安科累可以通过这条链路生成可复现图片，并在数据中解释模板、颜色、贴图和触发依据。第二阶段扩展到当前 233 个缺失站点国家。第三阶段再逐步逼近游戏真实随机算法和更多政治状态变体。

## 非目标

本阶段不从维基批量下载成品图作为最终来源。维基图片可以作为校对样本，但不作为主数据源。

本阶段不要求一次复刻全部政治状态、革命、共产、法西斯等运行时状态下的所有随机国旗。先覆盖默认国家定义状态，再为状态变体保留接口。

本阶段不删除已有专属旗帜解析链路。已有 503 个标签和 1407 个变体仍以专属脚本为优先来源。

## 输入数据

通用模板生成器需要读取以下本地文件：

- `game/common/country_definitions/*.txt`，读取国家颜色、主流文化、国家类型、位阶和首都。
- `game/common/cultures/*.txt`，读取文化的宗教、传承、语言和传统。
- `game/common/discrimination_traits/*.txt` 与 `game/common/discrimination_trait_groups/*.txt`，判断文化传承所属分组。
- `game/common/scripted_triggers/00_coa_triggers.txt`，至少支持 `coa_def_african_trigger`、`coa_def_west_african_trigger`、`coa_def_crescent_trigger`、`coa_def_cross_trigger` 等与模板选择直接相关的触发器。
- `game/common/coat_of_arms/template_lists/coa_templates.txt`，读取模板池和特殊选择。
- `game/common/coat_of_arms/template_lists/color_lists.txt`，读取颜色池和特殊选择。
- `game/common/coat_of_arms/template_lists/pattern_lists.txt`，读取图案池和特殊选择。
- `game/common/coat_of_arms/template_lists/colored_emblem_lists.txt` 与 `textured_emblem_lists.txt`，读取纹章贴图池。
- `game/common/coat_of_arms/coat_of_arms/03_random.txt`，读取模板具体结构。
- `game/common/named_colors/*.txt`，读取命名颜色。
- `game/gfx/coat_of_arms` 转换后的 PNG 素材，供渲染器使用。

## 生成流程

生成器入口接收国家标签和一个生成上下文。第一阶段上下文只包含默认国家定义状态，例如标签、文化、宗教、国家类型和是否存在初始国家。后续可加入法律、政体、利益集团、领主、革命状态等字段。

生成步骤如下：

1. 检查该标签是否已有专属旗帜定义。若有，继续使用现有专属解析结果。
2. 若无专属定义，构建国家上下文。安科累上下文应包含 `baganda`、`lacustrine_bantu`、`animist`、`heritage_eastern_bantu` 和 `heritage_group_african`。
3. 评估模板列表中的普通权重和 `special_selection`。安科累应命中 `coa_def_african_trigger`，因此模板池中应加入 `template_tricolor_fimbriated`。
4. 用稳定随机选择器从模板池中选定模板。
5. 读取 `03_random.txt` 中对应模板，解析 `pattern`、`color1` 至 `color5`、`colored_emblem`、`texture`、`instance` 等字段。
6. 对模板内部的 `list "..."` 再次按上下文和权重选择具体颜色、图案和纹章贴图。
7. 输出中间 JSON，包含模板名、每次选择的候选池、权重、最终结果、触发器命中情况和素材路径。
8. 调用现有渲染能力生成 PNG。渲染器需要继续支持底图着色、三色贴图、实例位置、缩放和旋转。

## 随机选择

随机选择要单独抽象为 `StableWeightedPicker`。第一阶段使用国家标签作为稳定种子，例如 `ANK`。这样每次生成结果一致，便于调试和版本管理。

真实游戏使用的随机种子规则尚未确认。后续如果从存档、游戏日志或运行时截图中确认规则，只替换这一层，不改模板解析、触发器评估和渲染器接口。

每次随机选择都必须写入中间 JSON，包括种子、候选项、权重、累计权重和最终命中项。这样安科累结果即使和维基图不同，也能解释差异来自随机选择，而不是解析缺失。

## 数据输出

通用模板生成结果进入 `site/assets/flags/<TAG>/<TAG>.png`。对应 `country-flags.js` 条目使用：

- `source: "generated:coa-template"`
- `variants[0].key: "<TAG>"`
- `variants[0].exportKey: "<TAG>"`
- `variants[0].fallback: false`
- `variants[0].templateGenerated: true`
- `variants[0].templateName`
- `variants[0].triggerSummary`
- `variants[0].generationTrace`

仍无法生成模板的国家保留纯色占位，但来源必须写成 `generated:fallback-country-color`，并标记 `fallback: true`。详情页后续应能区分“专属脚本”“通用模板”“临时占位”。

## 安科累验收标准

安科累 `ANK` 不再使用纯色 PNG 作为最终结果。生成数据中必须出现：

- `source` 为 `generated:coa-template`。
- 命中的文化链路包含 `heritage_eastern_bantu` 和 `heritage_group_african`。
- 触发器命中记录包含 `coa_def_african_trigger`。
- 候选模板池包含 `template_tricolor_fimbriated`。
- 最终 PNG 不是纯色图，至少包含图案或纹章层。
- 列表卡片、全局搜索结果、国家详情标题和国旗模块都加载同一张 `assets/flags/ANK/ANK.png`。
- 校验脚本能报告模板名、颜色槽、贴图路径和图片存在性。

维基的 `Ankole.png` 可作为视觉校对，不作为硬性像素一致标准。若生成结果不同，应先检查随机种子和权重选择记录。

## 实施边界

建议新增文件：

- `scripts/lib/coa_template_generator.mjs`，负责触发器、模板池、颜色池、贴图池和稳定随机选择。
- `scripts/build_generated_country_flags.mjs`，负责按标签生成中间 JSON 和 PNG。
- `scripts/check_generated_country_flags.mjs`，负责校验安科累与批量缺失标签。

现有文件需要对接：

- `scripts/lib/country_flag_variants.mjs`，保留专属旗帜解析优先级。
- `scripts/build_site_country_flags.mjs`，优先复制专属旗帜，再复制模板生成旗帜，最后才生成纯色占位。
- `scripts/build_country_flag_preview.ps1`，继续承担渲染职责。若模板生成 JSON 的结构和现有变体 JSON 不一致，需要增加一个 `generated-template` 渲染模式。
- `scripts/check_country_flag_detail_module.mjs`，增加对 `generated:coa-template` 的断言。

## 风险

最大风险是游戏真实随机种子未确认。解决方式是把随机选择记录完整写入中间 JSON，把“稳定可复现”和“与游戏完全一致”分阶段处理。

第二个风险是触发器评估范围过大。第一阶段只实现模板选择直接需要的触发器，并把无法评估的触发器记为 `unsupported`。若一个模板选择依赖 `unsupported` 条件，不能静默当作通过。

第三个风险是渲染器不支持某些实例参数。已有渲染器支持底图、着色、多色纹章、位置、缩放和旋转。新增字段要先在安科累范围验证，再扩展批量。

## 下一对话建议起点

下一对话可以从这个目标开始：实现安科累的通用模板生成样例。先不要批量覆盖 233 个国家。第一轮只做 `ANK`，输出中间 JSON、PNG、站点数据接入和浏览器验证。通过后再扩到其他缺失国家。
