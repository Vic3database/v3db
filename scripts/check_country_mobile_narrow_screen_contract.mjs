import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexSource = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "site", "app", "runtime.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "site", "app", "ui.js"), "utf8");
const presentationSource = fs.readFileSync(path.join(root, "site", "app", "presentation.js"), "utf8");
const shellSource = fs.readFileSync(path.join(root, "site", "styles", "shell.css"), "utf8");
const homeSource = fs.readFileSync(path.join(root, "site", "styles", "home.css"), "utf8");
const failures = [];

expect(indexSource.includes('id="mobileCountryToolbar"'), "缺少国家窄屏工具栏容器");
expect(/class="[^"]*mobile-country-filter-panel[^"]*"/.test(indexSource), "缺少 mobile-country-filter-panel 容器");
expect(runtimeSource.includes("countryMobileFiltersOpen: false"), "缺少默认关闭的 countryMobileFiltersOpen 状态");
expect(runtimeSource.includes("countryMobileMapOpen: true"), "缺少默认展开的 countryMobileMapOpen 状态");
expect(runtimeSource.includes("countryMobileListScrollTop: 0"), "缺少 countryMobileListScrollTop 状态");
expect(/\.mobile-country-toolbar,[\s\S]*\.mobile-country-filter-panel\s*\{[\s\S]*display:\s*none/.test(shellSource), "缺少默认隐藏的移动国家占位规则");
expect(/@media \(max-width: 820px\)[\s\S]*body\[data-view="country"\]\s+\.mobile-country-toolbar\s*\{[\s\S]*display:\s*flex/.test(shellSource), "820 像素断点内缺少国家工具栏显示规则");
expect(/body\[data-view="country"\]\[data-country-mobile-detail="open"\]\s+\.map-panel,[\s\S]*body\[data-view="country"\]\[data-country-mobile-detail="open"\]\s+\.filters,[\s\S]*body\[data-view="country"\]\[data-country-mobile-detail="open"\]\s+\.results\s*\{[\s\S]*display:\s*none/.test(shellSource), "缺少国家移动详情隐藏地图、筛选和列表的规则");
expect(runtimeSource.includes('countryMobileFilterCategory: "type"'), "缺少国家窄屏筛选分类状态");
expect(presentationSource.includes("countryMobileFilterCategories"), "缺少国家窄屏筛选分类定义");
expect(presentationSource.includes("renderMobileCountryControls"), "缺少国家窄屏工具栏渲染函数");
expect(presentationSource.includes("renderMobileCountryFilterChips"), "缺少可删除国家筛选标签渲染函数");
expect(uiSource.includes("selectCountryMobileFilter"), "缺少国家窄屏分类单选处理函数");
expect(uiSource.includes("clearCountryMobileFilter"), "缺少国家窄屏筛选标签删除处理函数");
expect(/\.mobile-country-search-input\s*\{[\s\S]*overflow-x:\s*auto[\s\S]*white-space:\s*nowrap[\s\S]*touch-action:\s*pan-x/.test(shellSource), "条件搜索框缺少横向滑动规则");
expect(indexSource.includes('id="mobileCountryToolbar"'), "缺少供浏览器回归定位的国家工具栏标识");
expect(indexSource.includes('id="mobileCountryFilterPanel"'), "缺少供浏览器回归定位的国家筛选面板标识");
expect(indexSource.indexOf('id="mobileCountryToolbar"') > indexSource.indexOf('id="mapPanel"'), "国家工具栏应位于地图之后，以便窄屏样式调整显示顺序");
expect(/\.mobile-country-filter-options\s*\{[\s\S]*flex-flow:\s*row wrap/.test(shellSource), "筛选选项缺少按可用宽度自然换行的规则");
expect(presentationSource.includes("data-mobile-country-filter-chip"), "缺少稳定的国家筛选标签数据属性");
expect(presentationSource.includes("data-mobile-country-filter-option"), "缺少稳定的国家筛选选项数据属性");
expect(presentationSource.includes("data-country-mobile-detail-back"), "缺少稳定的国家详情返回数据属性");
expect(/body\[data-view="home"\]\s+\.layout::before\s*\{[\s\S]*display:\s*none/.test(homeSource), "首页仍在显示左侧筛选栏底色");

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("国家窄屏静态契约通过");

function expect(condition, message) {
  if (!condition) failures.push(message);
}
