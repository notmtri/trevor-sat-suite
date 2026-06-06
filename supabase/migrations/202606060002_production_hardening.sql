-- Browser clients may read through RLS, but security-sensitive writes go
-- through authenticated server routes that use the service role.
revoke update on table public.profiles from authenticated;
grant update (display_name, must_change_password, updated_at)
  on table public.profiles to authenticated;

revoke insert, update, delete on table public.attempts from authenticated;
revoke insert, update, delete on table public.responses from authenticated;

revoke execute on function public.is_tutor() from public, anon;
revoke execute on function public.is_assigned_student(uuid) from public, anon;
revoke execute on function public.can_access_question(uuid) from public, anon;
grant execute on function public.is_tutor() to authenticated;
grant execute on function public.is_assigned_student(uuid) to authenticated;
grant execute on function public.can_access_question(uuid) to authenticated;

create or replace function public.can_review_question(target_question uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.responses r
    join public.attempts a on a.id = r.attempt_id
    where r.question_id = target_question
      and a.student_id = auth.uid()
      and a.released
  );
$$;
revoke execute on function public.can_review_question(uuid) from public, anon;
grant execute on function public.can_review_question(uuid) to authenticated;

drop policy if exists questions_student_assigned_read on public.questions;
create policy questions_student_assigned_read
  on public.questions for select
  using (
    public.can_access_question(id)
    or public.can_review_question(id)
  );

drop policy if exists question_versions_student_read on public.question_versions;
create policy question_versions_student_read
  on public.question_versions for select
  using (
    public.can_access_question(question_id)
    or public.can_review_question(question_id)
  );

drop policy if exists question_assets_student_prompt_read on public.question_assets;
create policy question_assets_student_prompt_read
  on public.question_assets for select
  using (
    kind = 'prompt'
    and exists (
      select 1 from public.question_versions qv
      where qv.id = question_assets.question_version_id
        and (
          public.can_access_question(qv.question_id)
          or public.can_review_question(qv.question_id)
        )
    )
  );

drop policy if exists module_questions_student_assigned_read
  on public.module_questions;
create policy module_questions_student_assigned_read
  on public.module_questions for select
  using (
    public.can_access_question(question_id)
    or public.can_review_question(question_id)
  );

drop policy if exists tutor_manage_question_assets on storage.objects;
create policy tutor_manage_question_assets
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'question-assets'
    and public.is_tutor()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'question-assets'
    and public.is_tutor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists tutor_manage_source_pdfs on storage.objects;
create policy tutor_manage_source_pdfs
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'source-pdfs'
    and public.is_tutor()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'source-pdfs'
    and public.is_tutor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
