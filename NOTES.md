# NOTES —— 关键发现 & 怎么跑

> ⚠️ 项目位置: `~/headhunter` (原来在 ~/Desktop, 但 macOS 隐私保护 TCC 挡住了命令行
> 对 Desktop 的访问, 所以挪到了 home 下。如想放回 Desktop, 需给终端 App 授予
> 系统设置 → 隐私与安全性 → 完全磁盘访问权限, 然后重启终端。)

## MiroMind API (已验证可用)

- Endpoint: `https://api.miromind.ai/v1/chat/completions` (OpenAI 兼容)
- Model: `mirothinker-1-7-deepresearch-mini`
- Key: 放在 `.env.local` 里 (已 gitignore, 不要提交)。泄露就去后台重置。
- 支持 `stream: true` (流式, 用于实时进度) 和 `stream: false` (返回单个干净 JSON, 更好解析)。

### 响应结构 (stream:false)
```
choices[0].message.content        ← 最终答案 (我们要的)
choices[0].message.agent_summary  ← 摘要
choices[0].message.reasoning_steps ← 思考/搜索轨迹, type 有:
                                      thinking / web_search / fetch_url_content
choices[0].finish_reason          ← "stop"
usage.total_tokens
```

### 延迟现实 (头号风险)
- 无需搜索的简单问题: ~18 秒
- 深度研究 (找人+验证): 5 分钟+ (实测 4'45" 还没答完)
- 即使回 "PONG" 也耗 5578 prompt tokens → 模型自带一大段 agent 系统提示

### 关键架构结论
- **MiroMind 自己就是完整 deep research agent**: 一次查询自动做了 55 次 web_search + 8 次 fetch_url, 返回真实 URL。
- → **不需要 Firecrawl, 不需要 dzhng/deep-research 的搜索循环。**
- → 架构 = MiroMind 当引擎 + 我们做 提示词/解析/UI。
- `deep-research/` 仅作参考代码 (prompt 写法、api.ts/Next 结构)。

## 怎么跑引擎
```bash
cd ~/headhunter
node --env-file=.env.local engine.mjs "Senior Rust engineer who contributed to tokio"
```
(慢, 几分钟。理想输出是候选人 JSON。)

## Demo 延迟应对策略
1. **预缓存**: 提前跑好 1-2 个 hero 查询, 存 JSON, 现场回放 (也作 API 挂掉的兜底)。
2. **实时研究流**: 把 web_search/fetch_url 步骤流到前端, 让评委看着它全网找证据 —— 把等待变表演。
3. **限制范围**: prompt 里只要 3 个候选人、每人 2-3 条声称, 缩短时间。

## 环境
node v22.16.0 · npm 10.9.2 · git 2.49.0
