alter table if exists public.candidate_live_signals
  drop constraint if exists candidate_live_signals_evidence_key_unique;

drop index if exists public.candidate_live_signals_evidence_key_unique;

do $$
begin
  if to_regclass('public.candidate_live_signals') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.candidate_live_signals'::regclass
        and conname = 'candidate_live_signals_evidence_key_unique'
    ) then
    alter table public.candidate_live_signals
      add constraint candidate_live_signals_evidence_key_unique
      unique (user_id, project_id, provider, candidate_merge_key, source_url, content_hash);
  end if;
end $$;
