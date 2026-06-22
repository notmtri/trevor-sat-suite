create or replace function public.update_question_answers(
  target_question_id uuid,
  answer_values jsonb
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
    raise exception 'Only tutors can edit answer keys.';
  end if;

  select q.current_version_id
  into target_version_id
  from public.questions q
  where q.id = target_question_id
    and q.owner_id = auth.uid();

  if target_version_id is null then
    raise exception 'Question not found.';
  end if;

  if jsonb_typeof(answer_values) <> 'array'
    or jsonb_array_length(answer_values) = 0 then
    raise exception 'At least one accepted answer is required.';
  end if;

  if exists (
    select 1
    from public.module_questions mq
    join public.test_modules tm on tm.id = mq.module_id
    join public.assignments a on a.test_id = tm.test_id
    where mq.question_id = target_question_id
  ) then
    raise exception 'This answer key is locked because the question has assignment history.';
  end if;

  delete from public.accepted_answers
  where question_version_id = target_version_id;

  insert into public.accepted_answers (
    question_version_id,
    value,
    normalized_value
  )
  select
    target_version_id,
    item.value,
    item.normalized_value
  from jsonb_to_recordset(answer_values) as item(
    value text,
    normalized_value text
  );
end;
$$;

revoke all on function public.update_question_answers(uuid, jsonb) from public;
grant execute on function public.update_question_answers(uuid, jsonb) to authenticated;
