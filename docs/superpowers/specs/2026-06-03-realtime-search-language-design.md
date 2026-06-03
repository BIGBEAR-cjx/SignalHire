# 实时搜索感知与平台语言设计

## 目标

搜索进行中时，用户需要强感知系统正在真实检索、抓取和交叉验证，而不是只看到“正在搜索”。搜索和核验结果中的用户可读内容需要按平台语言输出；当前默认中文，后续可接英文切换。

## 设计

1. 实时搜索感知
   - 继续使用 MiroMind `reasoning_steps` 中的 `web_search` 和 `fetch_url_content` 事件。
   - 前端加载态改成“实时研究轨迹”面板。
   - 顶部展示当前动作：正在生成搜索计划、正在搜索关键词、正在读取来源。
   - 中间展示搜索次数和抓取页数。
   - 下方用时间线显示最近搜索词和抓取 URL，内容完整换行展示，不再单行截断。
   - 保留“停止搜索”。

2. 平台语言输出
   - `searchPrompt` 和 `verifyPrompt` 增加 `platformLanguage` 参数，默认 `Chinese (Simplified)`。
   - Prompt 明确要求所有用户可读字段使用平台语言：summary、rationale、reason、next_action、strongest_signals、uncertainties、claim、evidence.note、audit、red_flags 等。
   - JSON key、枚举值、URL、姓名、公司名、论文名、技术名词保留原文。
   - 禁止把英文来源段落直接粘贴成结果说明；必须用平台语言转述。

## 不做

- 不做全站语言切换 UI。
- 不翻译已有历史结果。
- 不改变证据 URL 和实体名。
