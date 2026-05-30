// /api/shortlist
//   GET → 当前用户的全部候选池条目 + (可选) 指定 source_run 已收藏的 index 集合
//   POST { source_run_id, candidate_index, candidate } → 收藏一个候选人 → { id }
//   DELETE ?run=X&idx=Y → 按来源 + index 取消收藏 (搜索结果页 toggle 用)
//
// 所有操作需登录, 自动按 user.id 隔离。
import { addItem, listItems, listIndicesForRun, deleteByDedupKey, dedupKeyFor } from "@/lib/shortlist";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  // ?run=<source_run_id> → 只返该 run 下已收藏的 index 列表 (用于结果页 UI 高亮)
  const run = new URL(req.url).searchParams.get("run");
  if (run) {
    const indices = await listIndicesForRun(user.id, run);
    return Response.json({ indices });
  }

  const items = await listItems(user.id);
  return Response.json({ items });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let body: { source_run_id?: string; candidate_index?: number; candidate?: unknown } = {};
  try { body = await req.json(); } catch {}

  const idx = Number(body.candidate_index);
  if (!Number.isFinite(idx) || idx < 0) return Response.json({ error: "缺少有效的 candidate_index" }, { status: 400 });
  if (!body.candidate) return Response.json({ error: "缺少 candidate 快照" }, { status: 400 });

  const id = await addItem({
    userId: user.id,
    sourceRunId: body.source_run_id ?? null,
    candidateIndex: idx,
    candidate: body.candidate,
  });
  if (!id) return Response.json({ error: "保存失败" }, { status: 500 });
  return Response.json({ id });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const run = sp.get("run"); // 可为 null (无来源 run, 比如外部粘贴的)
  const idxRaw = sp.get("idx");
  const idx = Number(idxRaw);
  if (idxRaw === null || !Number.isFinite(idx) || idx < 0) {
    return Response.json({ error: "缺少有效的 idx" }, { status: 400 });
  }
  const key = dedupKeyFor(user.id, run, idx);
  const ok = await deleteByDedupKey(user.id, key);
  if (!ok) return Response.json({ error: "未收藏或已删除" }, { status: 404 });
  return Response.json({ ok: true });
}
