alter table public.question_versions
  add column if not exists content jsonb not null default '{}'::jsonb;

create or replace function public.update_question_content(
  target_question_id uuid,
  content_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_version_id uuid;
begin
  if not public.is_tutor() then
    raise exception 'Only tutors can edit question content.';
  end if;

  select q.current_version_id
  into target_version_id
  from public.questions q
  where q.id = target_question_id
    and q.owner_id = auth.uid();

  if target_version_id is null then
    raise exception 'Question not found.';
  end if;

  if jsonb_typeof(content_value) <> 'object' then
    raise exception 'Question content must be a JSON object.';
  end if;

  if exists (
    select 1
    from public.module_questions mq
    join public.test_modules tm on tm.id = mq.module_id
    join public.assignments a on a.test_id = tm.test_id
    where mq.question_id = target_question_id
  ) then
    raise exception 'This question content is locked because the question has assignment history.';
  end if;

  update public.question_versions
  set content = content_value
  where id = target_version_id;
end;
$$;

revoke all on function public.update_question_content(uuid, jsonb) from public;
grant execute on function public.update_question_content(uuid, jsonb) to authenticated;
