# Victorian Century：游戏中后续变动的文化痴迷与禁忌审计

审计范围为本体 `D:\SteamLibrary\steamapps\common\Victoria 3\game` 与 Victorian Century 模组 `D:\SteamLibrary\steamapps\workshop\content\529340\3219394272` 的全部 `.txt` 脚本。检索了 `add_cultural_obsession`、`remove_cultural_obsession`、`add_cultural_taboo`、`remove_cultural_taboo` 四个直接效果，并沿事件编号追到日志条目、年度动作或修正案的入口。本文只记录 1836 年开局以后可执行的效果；开局日志链的 93 条追加痴迷已记录在 `2026-08-06-victorian-century-starting-culture-obsessions.md`。

## 计数与口径

四个效果名在两套脚本文本中共匹配 149 次，其中 `events/test_events.txt` 的 1 次位于注释中。余下 148 次中，`common/effect_localization/00_culture_effects.txt` 的 4 次仅用于定义效果说明，不会改变文化数据；另有 93 次属于已经纳入开局数据的日志和 `set_british_empire_furniture_obsession_effect`。因此，游戏过程中的脚本位置共有 51 个：增加痴迷 43 个，移除痴迷 7 个，移除禁忌 1 个；没有 `add_cultural_taboo` 的可执行语句。

计数按脚本位置计算，同一事件的互斥选项会分别计入位置，单次游戏只会执行其中一个选项。普通修正、日志的 `modifiers_while_active` 与脚本按钮中没有直接改变痴迷或禁忌的语句。唯一涉及修正案的是“美国第二修正案”的启用与停用钩子。

## 逐项清单

| 范围 | 触发入口 | 变化 | 目标文化 | 源位置 |
| --- | --- | --- | --- | --- |
| 本体 | 日志条目 `je_belle_epoque` 的月度随机事件“新艺术”（权重 40）；事件 `belle_epoque_events.2` 的选项 A。日志要求经济转型、相机、电力等科技，以及足够高的生活水平和艺术学院。 | 增加 `fine_art` 痴迷。 | 随机一个尚未痴迷美术的主流文化。 | `common/journal_entries/00_belle_epoque.txt:1,219-238`；`events/belle_epoque_events.txt:109-168` |
| 本体 | 日志条目 `je_opium` 完成后触发 `opium_events.1`；选项 B 才执行。日志要求本国大型高盈利鸦片种植园，且向其他市场出口 200 以上鸦片。 | 增加 `opium` 痴迷。 | 进口方随机一个尚未痴迷鸦片的主流文化。 | `common/journal_entries/00_opium.txt:1-55`；`events/opium_events.txt:3-98` |
| 本体 | 国家正在制定“国家无神论”法律时，制定法律的随机事件池可抽到 `state_atheism.1`；选择 C，且市场鸦片消费超过 100。 | 增加 `opium` 痴迷。 | 随机一个尚未痴迷鸦片的主流文化。 | `common/on_actions/00_code_on_actions.txt:4662-4691`；`events/law_events/state_atheism.txt:107-160` |
| 本体 | 日本年度事件池可抽到“行政语言”事件 `japan_events.5`。条件包括完成明治维新、开放边境或自由贸易，以及不存在纸张痴迷的主流文化。 | 增加 `paper` 痴迷。 | 日本随机一个尚未痴迷纸张的主流文化。 | `common/on_actions/00_on_actions_yearly.txt:595-608`；`events/japan_events/ep2_japan_events.txt:708-764` |
| 本体 | 日本通过法律后的动作：1836 年 1 月 1 日以后，日本不实行锁国或闭关锁国时，延后十年触发“解除肉类禁令”事件 `japan_religion.10`。默认选项执行。 | 移除 `meat` 禁忌。 | 日语文化。 | `common/on_actions/00_code_on_actions.txt:5109-5124`；`events/japan_events/japan_religion_events.txt:757-821` |
| 本体 | 中国的“鸦片痴迷”日志条目 `je_opium_obsession` 完成，触发 `opium_wars.3`；两个选项都会执行。 | 移除 `opium` 痴迷。 | 事件所属国家的全部主流文化。 | `common/journal_entries/00_opium_wars.txt:1-48`；`events/opium_wars_events.txt:316-419` |
| 本体与 VC 覆盖日志 | Victorian Century 以 `REPLACE_OR_CREATE:je_prohibition` 覆盖禁酒日志。完成禁酒目标后触发 `prohibition.8`，默认选项执行。 | 移除 `liquor` 痴迷。 | 事件所属国家中已痴迷烈酒的全部主流文化。 | `common/journal_entries/01_prohibition_laws.txt:1-69`；本体 `events/prohibition_events.txt:778-810` |
| 本体修正案 | `amendment_american_second_amendment` 启用时调用 `second_amendment_add_obsessions_effect`，停用时调用 `second_amendment_remove_obsessions_effect`。修正案只允许主流文化含扬基或迪克西的国家采用。 | 启用时增加 `small_arms` 痴迷；停用时移除 `small_arms` 痴迷。 | 扬基文化与迪克西文化。 | `common/amendments/00_amendments_historical_04.txt:1-42`；`common/scripted_effects/00_victoria_ip4_scripted_effects.txt:1671-1720` |
| VC | 通用鸦片战争日志 `common_opium_war` 完成，触发“成功禁毒”事件 `joi_flavor_chi.36`；两个选项都会执行。 | 移除 `opium` 痴迷。 | 事件所属国家的全部主流文化。 | `common/journal_entries/china_dynasty.txt:2900-2942`；`events/joi_flavor_chi.txt:3318-3426` |
| VC | 法兰西第二帝国或第三共和国日志的月度随机事件“草地上的午餐” `joi_flavor_fra.46`；事件要求先发生 `joi_flavor_fra.45`，默认选项执行。 | 增加 `fine_art` 痴迷。 | 奥克、西法兰西、布列塔尼、法兰克-普罗旺斯、瓦隆、马格里布、北意大利、南德意志文化。 | `common/journal_entries/french_empire.txt:196-215,1283-1306`；`events/joi_flavor_fra.txt:3169-3228` |
| VC | 英国“联合王国赛艇”日志完成，触发皇家赛艇大赛 `joi_flavor_gbr.32`。日志要求完成有组织体育科技，且为快帆船或汽船的领先生产者并满足本国市场消费量。 | 增加 `steamers` 痴迷。 | 先为英国当前所有尚未痴迷汽船的主流文化增加；随后脚本固定增加爱尔兰、英裔加拿大、法裔加拿大、澳大利亚、布尔、汉、俄罗斯、闽、粤文化，并遍历调用作用域及东印度公司作用域中尚未痴迷汽船的南亚传承文化。 | `common/journal_entries/british_empire.txt:2049-2074`；`events/joi_flavor_gbr.txt:3843-3880`；`common/scripted_effects/joi_british_scripted_effects.txt:2307-2351` |
| VC | 德国“宣称新几内亚”日志完成，触发“新几内亚的港口城市”事件 `joi_flavor_ger.8`；默认选项执行。 | 增加 `fruit` 痴迷。 | 德国随机一个尚未痴迷水果的主流文化。 | `common/journal_entries/deutsch_vaterland.txt:876-893`；`events/joi_flavor_ger.txt:395-455` |
| VC | 日本“大正浪漫”日志的月度随机事件“银座文化” `joi_flavor_jap.36`；选择 B，且该选项为默认项。 | 增加 `coffee` 痴迷。 | 日语文化。 | `common/journal_entries/japan_empire.txt:2136-2148`；`events/joi_flavor_jap.txt:2674-2743` |
| VC | “联合果品公司”日志开始时，对每个参与国触发“黄金加勒比” `joi_flavor_usa.41`。美国的选项 A 增加，选项 B 不增加；其他参与国的选项 C 增加。 | 增加 `fruit` 痴迷。 | 每个执行增加选项的参与国，随机一个尚未痴迷水果的主流文化。 | `common/journal_entries/united_states.txt:1647-1656`；`events/joi_flavor_usa.txt:2579-2667` |
| VC | “联合果品公司”日志存续期间，美国月度随机池以权重 1 触发“虚假宣传” `joi_flavor_usa.46`。选项 A 与 C 都增加水果痴迷；C 额外按 10%、30%、60% 的权重选取一个列强、主要列强或次要列强。 | 增加 `fruit` 痴迷。 | 先为美国全部尚未痴迷水果的主流文化增加；选择 C 时，再为随机外国的一个符合条件主流文化增加。 | `common/journal_entries/united_states.txt:1669-1680`；`events/joi_flavor_usa.txt:3693-3820` |
| VC | “联合果品公司”日志完成时，对每个参与国触发“大香蕉，大章鱼” `joi_flavor_usa.48`。美国 A、B 与其他参与国 C 都会执行。 | 增加 `fruit` 痴迷。 | 每个参与国所有尚未痴迷水果的主流文化。 | `common/journal_entries/united_states.txt:1682-1718`；`events/joi_flavor_usa.txt:3906-4020` |
| VC | 普鲁士军队改革日志完成，触发“伟大的军事改革” `joi_flavor_pru.4`；默认选项调用脚本效果。 | 增加 `small_arms` 痴迷。 | 北德意志、南德意志、捷克、塞尔维亚、斯洛伐克文化。 | `common/journal_entries/prussia_kingdom.txt:514-537`；`events/joi_flavor_pru.txt:267-309`；`common/scripted_effects/joi_germany_scripted_effects.txt:155-171` |

文化板块与商品板块若要展示这类历史变动，不能将其并入 1836 年的静态痴迷字段。它们取决于事件选择、日志参与国、主流文化构成和条件是否满足；适合以“可能由事件或日志改变”的来源信息展示，而不适合作为固定当前状态。
