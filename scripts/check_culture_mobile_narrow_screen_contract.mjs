import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexSource = read("site/index.html");
const runtimeSource = read("site/app/runtime.js");
const uiSource = read("site/app/ui.js");
const boardsSource = read("site/app/boards.js");
const presentationSource = read("site/app/presentation.js");
const filtersSource = read("site/app/filters.js");
const mapSource = read("site/app/map.js");
const shellSource = read("site/styles/shell.css");
const failures = [];

expect(indexSource.includes('id="mobileCultureToolbar"'), "缺少文化窄屏工具栏容器");
expect(indexSource.includes('id="mobileCultureFilterPanel"'), "缺少文化窄屏筛选面板容器");
expect(indexSource.indexOf('id="mobileCultureToolbar"') > indexSource.indexOf('id="mapPanel"'), "文化工具栏应位于地图之后，以便窄屏重新排序");
expect(runtimeSource.includes("cultureMobileFiltersOpen: false"), "缺少默认关闭的文化筛选状态");
expect(runtimeSource.includes("cultureMobileMapOpen: true"), "缺少默认展开的文化地图状态");
expect(runtimeSource.includes('cultureMobileSearchDraft: ""'), "缺少文化待提交搜索词状态");
expect(runtimeSource.includes('cultureMobileFilterCategory: "heritage"'), "缺少文化默认筛选分类状态");
expect(runtimeSource.includes("cultureMobileExpandedHeritageGroup"), "缺少传承组展开状态");
expect(runtimeSource.includes("cultureMobileExpandedLanguageGroup"), "缺少语言组展开状态");
expect(runtimeSource.includes("cultureMobileExpandedStrategicRegionContinent"), "缺少战略区域洲别展开状态");
expect(runtimeSource.includes("cultureMobileListScrollTop: 0"), "缺少文化详情返回滚动位置状态");
expect(presentationSource.includes("renderMobileCultureControls"), "缺少文化窄屏工具栏渲染函数");
expect(presentationSource.includes("renderMobileCultureFilterChips"), "缺少文化筛选标签渲染函数");
expect(presentationSource.includes("data-mobile-culture-expand-heritage-group"), "传承组必须使用仅展开的数据属性");
expect(presentationSource.includes("data-mobile-culture-expand-language-group"), "语言组必须使用仅展开的数据属性");
expect(presentationSource.includes("data-mobile-culture-expand-strategic-region-continent"), "洲别必须使用仅展开的数据属性");
expect(presentationSource.includes("data-mobile-culture-filter-option"), "具体文化筛选项缺少稳定的数据属性");
expect(presentationSource.includes("data-mobile-culture-filter-chip"), "文化筛选标签缺少稳定的数据属性");
expect(uiSource.includes("submitMobileCultureSearch"), "缺少文化显式搜索提交函数");
expect(uiSource.includes("selectCultureMobileFilter"), "缺少文化实际筛选条件处理函数");
expect(uiSource.includes("clearCultureMobileFilter"), "缺少文化筛选标签删除函数");
expect(uiSource.includes("data-culture-mobile-detail-back"), "缺少文化窄屏详情返回数据属性");
expect(filtersSource.includes("matchesCultureSelection"), "缺少文化实际条件的共享匹配函数");
expect(filtersSource.includes("state.strategicRegions"), "文化筛选未纳入本土战略区域条件");
expect(mapSource.includes("focusCultureOnMap"), "缺少文化卡片选中后的地图聚焦函数");
expect(mapSource.includes("hasCultureSelection"), "文化地图未使用实际条件判断");
expect(/\.mobile-culture-toolbar,[\s\S]*\.mobile-culture-filter-panel\s*\{[\s\S]*display:\s*none/.test(shellSource), "缺少文化窄屏容器默认隐藏规则");
expect(/@media \(max-aspect-ratio: 3 \/ 2\)[\s\S]*body\[data-view="culture"\]\s+\.mobile-culture-toolbar\s*\{[\s\S]*display:\s*flex/.test(shellSource), "紧凑视口缺少文化工具栏显示规则");
expect(/\.mobile-culture-filter-panel\[hidden\]\s*\{[\s\S]*display:\s*none/.test(shellSource), "收起文化筛选时仍可能保留边框或空白");
expect(/\.mobile-culture-search-input\s*\{[\s\S]*overflow-x:\s*auto[\s\S]*white-space:\s*nowrap[\s\S]*touch-action:\s*pan-x/.test(shellSource), "文化搜索条件容器缺少横向滑动规则");
expect(/\.mobile-culture-filter-categories\s*\{[\s\S]*border-bottom:\s*1px solid/.test(shellSource), "文化分类和选项之间缺少分隔线");
expect(/\.mobile-culture-filter-options\s*\{[\s\S]*flex-flow:\s*row wrap[\s\S]*justify-content:\s*flex-start[\s\S]*padding-top:\s*8px/.test(shellSource), "文化实际选项未按左对齐自然换行");
expect(/body\[data-view="culture"\]\s+\.map-toolbar\s*\{[\s\S]*top:\s*10px[\s\S]*right:\s*10px[\s\S]*left:\s*auto/.test(shellSource), "文化地图重置按钮未固定在右上角");
expect(/body\[data-view="culture"\]\s+\.results\s*\{[\s\S]*align-self:\s*center[\s\S]*width:\s*calc\(100% - 20px\)/.test(shellSource), "文化列表未与地图保留一致的左右间距");
expect(/body\[data-view="culture"\]\[data-culture-mobile-detail="open"\][\s\S]*\.map-panel[\s\S]*display:\s*none/.test(shellSource), "文化窄屏详情未隐藏地图和列表区域");

if (failures.length) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("文化窄屏静态契约通过");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}
