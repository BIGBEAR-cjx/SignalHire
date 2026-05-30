-- Phase 1.2 多租户改造 —— research_runs 表加 user_id 列。
-- 已于 2026-05-30 在生产上执行完毕。
--
-- 目标:
--   1. 加 user_id (uuid) 列
--   2. 把现有所有老数据归到管理员账号 (rwdaoclub@gmail.com, 5b66d460-...)
--   3. 加索引 + NOT NULL 约束
--
-- 执行方式: 通过 Insforge 的 raw SQL admin 端点直接跑(已用过):
--   POST {INSFORGE_API_BASE_URL}/api/database/advance/rawsql
--     -H "x-api-key: $INSFORGE_API_KEY"
--     -d '{"query":"<sql>","params":[<params>]}'
--   (代理: web/scripts/insforge-sql.sh 包了一层方便复用)
--
-- 运行顺序: 必须按 ① → ② → ③ → ④ 的顺序逐步跑, 中间用 SELECT 自查。
--
-- ⚠️ 安全:
--   - 这是不可逆操作 (虽然加列+回填本身是安全的, 但 NOT NULL 后回退要先删约束)
--   - ④ 的 NOT NULL 务必确认 ③ 的回填全部成功 (没 NULL 才跑)

-- ────────────────────────────────────────────────────────────
-- ① 加 user_id 列 (允许 NULL, 这一步不会动现有数据)
-- ────────────────────────────────────────────────────────────
ALTER TABLE research_runs
  ADD COLUMN IF NOT EXISTS user_id uuid;


-- ────────────────────────────────────────────────────────────
-- ② 加索引 (按 user_id 过滤的查询很多)
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS research_runs_user_id_idx
  ON research_runs (user_id);


-- ────────────────────────────────────────────────────────────
-- ③ 回填老数据 → 归到你的账号
--
-- 操作前:
--   a) 先到 https://signal-hire-eight.vercel.app/app/settings 登录后复制 User ID
--   b) 把下面 '<YOUR_USER_ID>' 替换成你的真实 UUID
--   c) 跑下面这条 UPDATE
-- ────────────────────────────────────────────────────────────
-- UPDATE research_runs SET user_id = '<YOUR_USER_ID>' WHERE user_id IS NULL;

-- 自查 (应返回 0):
-- SELECT COUNT(*) FROM research_runs WHERE user_id IS NULL;


-- ────────────────────────────────────────────────────────────
-- ④ 设 NOT NULL (确保以后写入都必须带 user_id, 防止意外漏写)
--
-- 跑前确认 ③ 自查返回 0 !!!
-- ────────────────────────────────────────────────────────────
-- ALTER TABLE research_runs ALTER COLUMN user_id SET NOT NULL;


-- ────────────────────────────────────────────────────────────
-- (可选) 跑完后健康自检
-- ────────────────────────────────────────────────────────────
-- SELECT user_id, status, COUNT(*) FROM research_runs GROUP BY 1,2 ORDER BY 1,2;
