#!/usr/bin/env bash
# insforge-sql.sh —— 通过 Insforge raw SQL admin 端点跑任意 SQL。
#
# 用途:
#   - DDL (ALTER TABLE / CREATE INDEX / ...)
#   - 数据修复 / 一次性脚本
#   - 查 information_schema / pg_indexes 等
#
# 注意:
#   - 用 INSFORGE_API_KEY (admin), 绕过 RLS, 千万别在产品代码里调
#   - 这是个调试/迁移工具, 仅手工 / Claude 用
#
# 用法:
#   ./scripts/insforge-sql.sh "SELECT COUNT(*) FROM research_runs"
#   ./scripts/insforge-sql.sh "UPDATE x SET y = \$1 WHERE z = \$2" '["a","b"]'
#
# 输出: 原始 JSON, 用 | jq 自己解析。

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# 读 .env.local (gitignore 内, 含 admin key)
if [ -f "$ROOT/.env.local" ]; then
  # shellcheck disable=SC1091
  set -a; source "$ROOT/.env.local"; set +a
fi

: "${INSFORGE_API_BASE_URL:?missing INSFORGE_API_BASE_URL}"
: "${INSFORGE_API_KEY:?missing INSFORGE_API_KEY}"

QUERY="${1:?usage: insforge-sql.sh <SQL> [PARAMS_JSON]}"
PARAMS="${2:-[]}"

curl -s -X POST "$INSFORGE_API_BASE_URL/api/database/advance/rawsql" \
  -H "x-api-key: $INSFORGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg q "$QUERY" --argjson p "$PARAMS" '{query:$q, params:$p}')"
echo
