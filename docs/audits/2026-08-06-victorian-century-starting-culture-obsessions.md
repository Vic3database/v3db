# Victorian Century：1836 年开局日志中的文化痴迷

本清单仅收录 1836 年国家历史文件直接加入的日志，以及日志的 `immediate` 效果和其调用的脚本效果。后续事件、日志完成奖励、决议和条件触发内容均不计入开局数据。共识别出 8 个日志，包含 93 条 `add_cultural_obsession` 命令，涉及 55 个文化。

当前 `database/victorian_century/cultures.json` 只保存 `common/cultures` 中的静态文化定义，因此下列开局追加项均未进入网站数据。模组没有 `add_cultural_taboo` 或 `remove_cultural_taboo` 命令，本轮未发现开局禁忌的同类漏项。

## 直接由日志追加的痴迷

| 开局国家与日志 | 开局追加的文化痴迷 | 效果位置 |
| --- | --- | --- |
| JAP；`edo_period` | 大和：鱼类 | [日本历史](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/history/countries/jap - japan.txt:76>)；[日志](D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/journal_entries/japan_empire.txt:25) |
| FRA；`french_birthrate` | 法兰西：高档衣物；西班牙：烟草、家具；土耳其：家具；俄罗斯：高档衣物 | [法国历史](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/history/countries/fra - france.txt:156>)；[日志](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/journal_entries/french republic.txt:299>) |
| CHI；`grand_council` | 汉：茶叶、瓷器 | [清朝历史](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/history/countries/chi - china.txt:94>)；[日志](D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/journal_entries/china_dynasty.txt:559) |
| AUS；`house_of_habsburg` | 南德意志：咖啡 | [奥地利历史](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/history/countries/aus - austria.txt:110>)；[日志](D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/journal_entries/austrian_empire.txt:1) |
| TUR；`peter_the_great_of_turkey` | 土耳其：高档家具 | [奥斯曼历史](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/history/countries/tur - ottoman empire.txt:53>)；[日志](D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/journal_entries/ottoman_empire.txt:1) |
| PRU；`peussia_education` | 北德意志：瓷器 | [普鲁士历史](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/history/countries/pru - prussia.txt:112>)；[日志](D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/journal_entries/prussia_kingdom.txt:423) |
| RUS；`russia_company_vodka_monopoly_character` | 俄罗斯：烈酒；乌克兰：轻武器、烈酒 | [俄罗斯历史](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/history/countries/rus - russia.txt:92>)；[日志](D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/journal_entries/russia_mother.txt:2457) |

## 大英帝国日志调用的脚本

GBR 在 1836 年加入 `stabilize_british_empire`。该日志的 `immediate` 块调用 `set_british_empire_furniture_obsession_effect`，而文化痴迷命令存放在脚本文件中。[大不列颠历史](<D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/history/countries/gbr - great britain.txt:178>)、[日志调用](D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/journal_entries/british_empire.txt:37)、[脚本定义](D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/scripted_effects/joi_british_scripted_effects.txt:2353)。

| 商品 | 获得该商品痴迷的文化 |
| --- | --- |
| 家具 | 英格兰、苏格兰、爱尔兰、英裔加拿大、澳大利亚、阿萨姆、阿瓦蒂、俾路支、孟加拉、比哈尔、古吉拉特、卡纳达、马拉雅拉姆、马拉地、奥里萨、旁遮普、帕坦、拉杰普特、信德、泰米尔、泰卢固、印度斯坦、本德尔、帕哈里、贡德、巴哥里、切蒂斯格尔、德干、缅甸、扬基、密思儿、波斯。
| 高档衣物 | 英格兰、阿萨姆、阿瓦蒂、俾路支、孟加拉、比哈尔、古吉拉特、卡纳达、马拉雅拉姆、马拉地、奥里萨、旁遮普、帕坦、拉杰普特、信德、泰米尔、泰卢固、印度斯坦、本德尔、帕哈里、贡德、巴哥里、切蒂斯格尔、德干、缅甸、爪哇、北意大利、葡萄牙。
| 烈酒 | 北德意志、南德意志、瑞典、挪威、芬兰、蒙古、满、丹麦。
| 瓷器 | 满、朝鲜。
| 烟草 | 土耳其、密思儿、也门、贝都因、马什里克。
| 高档家具 | 贝都因、马什里克。
| 加工食品 | 爱尔兰。
| 轻武器 | 布尔。

## 北德意志与英格兰的实际开局值

北德意志的静态痴迷是肉类。大英帝国日志的脚本增加烈酒，普鲁士教育日志增加瓷器，1836 年实际为肉类、烈酒、瓷器。英格兰的静态痴迷是茶叶；大英帝国日志脚本增加家具和高档衣物，1836 年实际为茶叶、家具、高档衣物。

## 提取器需要补足的范围

提取流程需要在读取 `common/cultures` 后处理 `common/history/countries` 的 `add_journal_entry`，定位日志的 `immediate` 块，递归展开其中调用的脚本效果，并把 `add_cultural_obsession` 合并入文化数据。静态定义和开局追加项应分别保留来源，以便网站区分显示并在模组更新后重新核对。
