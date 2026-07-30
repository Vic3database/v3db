import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexSource = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "site", "app", "runtime.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "site", "app", "ui.js"), "utf8");
const boardsSource = fs.readFileSync(path.join(root, "site", "app", "boards.js"), "utf8");
const presentationSource = fs.readFileSync(path.join(root, "site", "app", "presentation.js"), "utf8");
const shellSource = fs.readFileSync(path.join(root, "site", "styles", "shell.css"), "utf8");
const failures = [];

expect(indexSource.includes('id="mobileCountryToolbar"'), "缺少国家窄屏工具栏容器");
expect(/class="[^"]*mobile-country-filter-panel[^"]*"/.test(indexSource), "缺少 mobile-country-filter-panel 容器");
expect(runtimeSource.includes("countryMobileFiltersOpen: false"), "缺少默认关闭的 countryMobileFiltersOpen 状态");
expect(runtimeSource.includes("countryMobileMapOpen: true"), "缺少默认展开的 countryMobileMapOpen 状态");
expect(runtimeSource.includes("countryMobileListScrollTop: 0"), "缺少 countryMobileListScrollTop 状态");
expect(runtimeSource.includes('countryMobileSearchDraft: ""'), "缺少国家窄屏待提交搜索词状态");
expect(/\.mobile-country-toolbar,[\s\S]*\.mobile-country-filter-panel\s*\{[\s\S]*display:\s*none/.test(shellSource), "缺少默认隐藏的移动国家占位规则");
expect(/@media \(max-aspect-ratio: 3 \/ 2\)[\s\S]*body\[data-view="country"\]\s+\.mobile-country-toolbar\s*\{[\s\S]*display:\s*flex/.test(shellSource), "紧凑视口缺少国家工具栏显示规则");
expect(/body\[data-view="country"\]\[data-country-mobile-detail="open"\]\s+\.map-panel,[\s\S]*body\[data-view="country"\]\[data-country-mobile-detail="open"\]\s+\.filters,[\s\S]*body\[data-view="country"\]\[data-country-mobile-detail="open"\]\s+\.results\s*\{[\s\S]*display:\s*none/.test(shellSource), "缺少国家移动详情隐藏地图、筛选和列表的规则");
expect(runtimeSource.includes('countryMobileFilterCategory: "type"'), "缺少国家窄屏筛选分类状态");
expect(presentationSource.includes("countryMobileFilterCategories"), "缺少国家窄屏筛选分类定义");
expect(presentationSource.includes("renderMobileCountryControls"), "缺少国家窄屏工具栏渲染函数");
expect(presentationSource.includes("renderMobileCountryFilterChips"), "缺少可删除国家筛选标签渲染函数");
expect(uiSource.includes("selectCountryMobileFilter"), "缺少国家窄屏分类单选处理函数");
expect(uiSource.includes("clearCountryMobileFilter"), "缺少国家窄屏筛选标签删除处理函数");
expect(uiSource.includes("submitMobileCountrySearch"), "缺少国家窄屏显式搜索提交函数");
expect(/mobileCountryToolbar\?\.addEventListener\("input",[\s\S]*?state\.countryMobileSearchDraft\s*=\s*input\.value[\s\S]*?\}\);/.test(uiSource), "国家窄屏输入事件必须只保存待提交关键词");
expect(/\.mobile-country-search-input,[\s\S]*\.mobile-culture-search-input\s*\{[\s\S]*overflow-x:\s*auto[\s\S]*white-space:\s*nowrap[\s\S]*touch-action:\s*pan-x/.test(shellSource), "条件搜索框缺少横向滑动规则");
expect(indexSource.includes('id="mobileCountryToolbar"'), "缺少供浏览器回归定位的国家工具栏标识");
expect(indexSource.includes('id="mobileCountryFilterPanel"'), "缺少供浏览器回归定位的国家筛选面板标识");
expect(indexSource.indexOf('id="mobileCountryToolbar"') > indexSource.indexOf('id="mapPanel"'), "国家工具栏应位于地图之后，以便窄屏样式调整显示顺序");
expect(/\.mobile-country-filter-options,[\s\S]*\.mobile-culture-filter-options\s*\{[\s\S]*flex-flow:\s*row wrap/.test(shellSource), "筛选选项缺少按可用宽度自然换行的规则");
expect(/\.mobile-country-toolbar-row,[\s\S]*\.mobile-culture-toolbar-row\s*\{[\s\S]*width:\s*100%/.test(shellSource), "国家工具栏行未占满容器，三个工具按钮无法右对齐");
expect(/\.mobile-country-filter-panel\[hidden\]\s*\{[\s\S]*display:\s*none/.test(shellSource), "收起筛选时仍会保留筛选面板边框");
expect(/\.mobile-country-search-input input,[\s\S]*\.mobile-culture-search-input input\s*\{[\s\S]*flex:\s*1 0 148px[\s\S]*min-width:\s*148px/.test(shellSource), "初始搜索提示文字的可用宽度不足");
expect(/body\[data-view="country"\]\s+#leftPanelToggle,[\s\S]*body\[data-view="country"\]\s+#bottomPanelToggle,[\s\S]*body\[data-view="culture"\]\s+#leftPanelToggle,[\s\S]*body\[data-view="culture"\]\s+#bottomPanelToggle\s*\{[\s\S]*display:\s*none/.test(shellSource), "窄屏国家地图仍显示筛选和列表工具按钮");
expect(/\.mobile-country-filter-categories,[\s\S]*\.mobile-culture-filter-categories\s*\{[\s\S]*border-bottom:\s*1px solid/.test(shellSource), "筛选分类与选项之间缺少分隔线");
expect(/\.mobile-country-filter-options,[\s\S]*\.mobile-culture-filter-options\s*\{[\s\S]*justify-content:\s*flex-start/.test(shellSource), "筛选选项未左对齐");
expect(/\.mobile-country-filter-options,[\s\S]*\.mobile-culture-filter-options\s*\{[\s\S]*padding-top:\s*8px/.test(shellSource), "筛选选项未与分类分隔线保持间距");
expect(/\.mobile-country-filter-option,[\s\S]*\.mobile-culture-filter-option\s*\{[\s\S]*border-radius:\s*5px/.test(shellSource), "筛选选项未使用圆角矩形边框");
expect(/body\[data-view="country"\]\s+\.map-toolbar,[\s\S]*body\[data-view="culture"\]\s+\.map-toolbar\s*\{[\s\S]*top:\s*10px[\s\S]*right:\s*10px[\s\S]*left:\s*auto/.test(shellSource), "国家竖屏地图重置按钮未固定在右上角");
expect(/body\[data-view="country"\]\s+\.results,[\s\S]*body\[data-view="culture"\]\s+\.results\s*\{[\s\S]*align-self:\s*center[\s\S]*width:\s*calc\(100% - 20px\)[\s\S]*margin:\s*10px/.test(shellSource), "国家竖屏结果列表未与地图保留一致的左右间距");
expect(presentationSource.includes("data-mobile-country-filter-chip"), "缺少稳定的国家筛选标签数据属性");
expect(presentationSource.includes("data-mobile-country-filter-option"), "缺少稳定的国家筛选选项数据属性");
expect(presentationSource.includes("data-country-mobile-detail-back"), "缺少稳定的国家详情返回数据属性");
expect(/@media \(max-aspect-ratio: 3 \/ 2\)\s*\{[\s\S]*\.layout::before\s*\{[\s\S]*display:\s*none/.test(shellSource), "紧凑视口仍在显示左侧筛选栏底色");
expect(uiSource.includes('window.matchMedia("(max-aspect-ratio: 3 / 2)").matches'), "国家详情返回未按紧凑视口判断");
expect(presentationSource.includes('window.matchMedia("(max-aspect-ratio: 3 / 2)").matches'), "国家详情进入未按紧凑视口判断");
expect(boardsSource.includes('window.matchMedia("(max-aspect-ratio: 3 / 2)").matches'), "国家详情滚动恢复未按紧凑视口判断");

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("国家窄屏静态契约通过");

function expect(condition, message) {
  if (!condition) failures.push(message);
}
