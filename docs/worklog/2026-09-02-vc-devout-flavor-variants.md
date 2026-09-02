# 2026-09-02 VC 虔信者多风味归并修复

## 问题

Victorian Century 的虔信者页面把多个国家使用的同名风味键直接合并，导致天主教会只显示一条国家风味，后遍历的西班牙特质组合覆盖了法国、意大利和罗马帝国等组合。

## 修复

利益集团风味归并现在以显示名键和实际生效的特质、意识形态组合共同确定身份。相同组合的国家继续合并，不同组合使用稳定的特质或意识形态后缀分别展示。虔信者导航支持带后缀的风味键，并保留土耳其逊尼派已有的特殊名称。

## 检查

VC 独立站和 `site/vc` 的天主教会导航均显示罗马教廷、普通天主教会、法国、意大利、罗马帝国和西班牙六个风味入口，六个详情路由逐一打开并保留对应键。全量检查发现并验证了 15 个同类多组合风味键，包含逊尼派、东正教、印度教、知识分子、地主、乡村民众和小市民等；没有国家遗漏或不同组合混入同一风味。

验证命令：

`node scripts/check_interest_group_board_browser.mjs --victorian-century-flavors-only --catholic-only --site "Victorian Century Database"`

`node scripts/check_interest_group_board_browser.mjs --victorian-century-flavors-only --catholic-only --site "site/vc"`

`node scripts/check_religion_board.mjs`

`node scripts/check_victorian_century_interest_group_flavors.mjs`

`node scripts/check_victorian_century_standalone_site.mjs`

`node scripts/check_shared_layout_parity.mjs`
