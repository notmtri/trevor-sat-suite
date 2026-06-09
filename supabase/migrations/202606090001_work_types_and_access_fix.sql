alter table public.tests
  add column if not exists work_type text not null default 'custom'
    check (work_type in (
      'custom',
      'full_length',
      'verbal_simulation',
      'math_simulation',
      'verbal_practice',
      'math_practice'
    ));

create index if not exists tests_owner_work_type
  on public.tests(owner_id, work_type, status);

alter table public.attempts
  add column if not exists score_summary jsonb;

create or replace function public.can_access_question(target_question uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.module_questions mq
    join public.test_modules tm on tm.id = mq.module_id
    join public.assignments a on a.test_id = tm.test_id
    join public.assignment_students ast on ast.assignment_id = a.id
    where mq.question_id = target_question
      and ast.student_id = auth.uid()
      and a.status = 'open'
      and ast.recipient_status <> 'excused'
      and now() between coalesce(ast.available_at, a.available_at)
                  and coalesce(ast.due_at, a.due_at)
  );
$$;
