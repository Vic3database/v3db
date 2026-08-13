# Historical Character Image Batch Review Design

## 范围与审核顺序

当前史实图片报告有 595 名待复核人物，其中艾米·卡迈克尔已经存在一条图片拒绝记录，实际尚未处理 594 人。审核固定按每批 25 人串行进行，先处理精确姓名和出生年匹配且只有一张候选图的人物，再处理多图候选、保守别名匹配和开局年龄匹配，最后处理没有候选图及人物匹配有歧义的记录。每批完成后重建完整报告和前端数据，并执行数据契约与浏览器检查。

一张图片获准收录时，需要同时满足人物身份明确、画面主体为该人物本人、图片属于照片、肖像画或版画、许可信息存在且没有生成图、雕塑、签名、徽章或群像等排除原因。候选不合格时保存图片拒绝记录。所有现有候选均不合格、当前没有候选图片或人物身份无法唯一确定时，还要保存人物级终态，使该人物退出待复核队列。

## 数据结构与失效规则

复核文件升级为结构版本 2，保留现有 `reviews` 图片决定，并增加 `person_reviews` 人物决定。图片记录继续使用 `approve` 或 `reject`，精确绑定角色键集合、单个维基数据人物编号和维基共享资源文件名。人物记录使用 `no_eligible_image` 或 `identity_ambiguous`，格式如下：

```json
{
  "character_keys": ["BIC_amy_carmichael"],
  "wikidata_ids": ["Q481824"],
  "candidate_file_titles": ["File:Amy Carmichael with children2.jpg"],
  "decision": "no_eligible_image",
  "reviewed_at": "2026-08-13",
  "reason": "The only current candidate is a group image."
}
```

`no_eligible_image` 要求维基数据人物编号集合和候选文件名集合与当前报告完全一致，空候选集合也必须明确记录。`identity_ambiguous` 要求保存当前全部候选人物编号，候选集合变化后不再应用。生成器发现人物级记录与当前来源不一致时应立即报错，使审核者重新检查该人物，避免旧决定掩盖新增候选。

报告新增 `reviewed_without_image` 集合，并写入人物级决定、复核日期、理由和当时的候选摘要。`review` 只保存尚未完成人工处理的人物。统计增加 `reviewed_without_image_people`、`reviewed_no_eligible_image_people` 和 `reviewed_identity_ambiguous_people`；已确认图片人数继续单独统计，前端图片数据只读取已确认集合。

## 校验与批次产物

结构校验需要覆盖非法决定、缺少人物编号、候选集合未排序或重复、同一人物存在多个终态、图片批准与人物无图终态冲突等情况。报告校验需要证明确认、已复核未收录、待复核、未匹配和明确排除的角色模板互不重复且总数守恒。艾米·卡迈克尔应作为首个回归样本，从待复核集合进入 `reviewed_without_image`，角色详情不得显示被拒绝的群像。

每批审核提交应包含复核文件、重建后的前端图片数据、统计更新、审核工作记录和对应测试。临时缩略图与审核图保留在忽略目录，提交前删除。网络请求保持并发数 1，相邻请求至少间隔 6 秒；已有缓存可以直接读取，不制造额外网络请求。
