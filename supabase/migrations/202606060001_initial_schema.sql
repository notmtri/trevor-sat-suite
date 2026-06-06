create extension if not exists pgcrypto;

create type public.app_role as enum ('tutor', 'student');
create type public.student_status as enum ('active', 'disabled');
create type public.question_status as enum ('draft', 'published', 'rejected');
create type public.response_type as enum ('multiple_choice', 'student_produced');
create type public.asset_kind as enum ('prompt', 'rationale');
create type public.test_mode as enum ('practice', 'exam');
create type public.publish_status as enum ('draft', 'published');
create type public.feedback_policy as enum ('immediate', 'after_submission', 'tutor_release');
create type public.assignment_status as enum ('scheduled', 'open', 'closed');
create type public.attempt_status as enum ('not_started', 'in_progress', 'submitted', 'expired');
create type public.connection_status as enum ('online', 'offline', 'stale');
create type public.module_route as enum ('common', 'easier', 'harder');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  username text unique,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  status public.student_status not null default 'active',
  time_multiplier numeric(3,1) not null default 1 check (time_multiplier in (1, 1.5, 2)),
  joined_at timestamptz not null default now(),
  last_active_at timestamptz
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  sha256 text not null,
  page_count integer not null check (page_count > 0),
  imported_at timestamptz not null default now(),
  unique(owner_id, sha256)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_id text not null,
  assessment text not null default 'SAT',
  section text not null check (section in ('Math', 'Reading and Writing')),
  domain text not null,
  skill text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  status public.question_status not null default 'draft',
  created_at timestamptz not null default now(),
  unique(owner_id, source_id)
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete restrict,
  version_hash text not null,
  response_type public.response_type not null,
  extracted_text text not null default '',
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  unique(question_id, version_hash)
);

alter table public.questions
  add column current_version_id uuid references public.question_versions(id) on delete set null;

create table public.question_assets (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  kind public.asset_kind not null,
  asset_order integer not null check (asset_order >= 0),
  source_page integer not null check (source_page > 0),
  storage_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  unique(question_version_id, kind, asset_order)
);

create table public.accepted_answers (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  value text not null,
  normalized_value text not null,
  unique(question_version_id, normalized_value)
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  mode public.test_mode not null,
  status public.publish_status not null default 'draft',
  routing_threshold numeric(4,3) not null default .6 check (routing_threshold between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.test_modules (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  title text not null,
  section text not null check (section in ('Math', 'Reading and Writing')),
  duration_minutes integer not null check (duration_minutes > 0),
  route public.module_route not null default 'common',
  module_order integer not null check (module_order > 0),
  unique(test_id, route, module_order)
);

create table public.module_questions (
  module_id uuid not null references public.test_modules(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  question_order integer not null check (question_order > 0),
  unscored boolean not null default false,
  primary key (module_id, question_id),
  unique(module_id, question_order)
);

create table public.adaptive_routes (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  source_module_id uuid not null references public.test_modules(id) on delete cascade,
  easier_module_id uuid not null references public.test_modules(id) on delete cascade,
  harder_module_id uuid not null references public.test_modules(id) on delete cascade,
  threshold numeric(4,3) not null check (threshold between 0 and 1),
  unique(test_id, source_module_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete restrict,
  title text not null,
  available_at timestamptz not null,
  due_at timestamptz not null,
  attempt_limit integer not null default 1 check (attempt_limit > 0),
  feedback_policy public.feedback_policy not null default 'tutor_release',
  allow_resume boolean not null default true,
  status public.assignment_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  check (due_at > available_at)
);

create table public.assignment_students (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(user_id) on delete cascade,
  time_multiplier numeric(3,1) not null default 1 check (time_multiplier in (1, 1.5, 2)),
  primary key (assignment_id, student_id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(user_id) on delete cascade,
  status public.attempt_status not null default 'not_started',
  current_module_id uuid references public.test_modules(id) on delete set null,
  current_question_index integer not null default 0 check (current_question_index >= 0),
  answered_count integer not null default 0 check (answered_count >= 0),
  server_deadline timestamptz,
  connection_status public.connection_status not null default 'offline',
  route public.module_route,
  started_at timestamptz,
  submitted_at timestamptz,
  last_heartbeat_at timestamptz,
  raw_correct integer,
  raw_total integer,
  estimated_score integer,
  score_range int4range,
  expired_while_offline boolean not null default false,
  released boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index attempts_one_active_per_assignment
  on public.attempts(assignment_id, student_id)
  where status in ('not_started', 'in_progress');

create table public.responses (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  value text not null default '',
  flagged boolean not null default false,
  eliminated_choices text[] not null default '{}',
  seconds_spent integer not null default 0 check (seconds_spent >= 0),
  changed_count integer not null default 0 check (changed_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  kind text not null check (kind in ('highlight', 'note')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attempt_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  server_created_at timestamptz not null default now()
);

create table public.score_models (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  version text not null,
  source_url text not null,
  conversion_data jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner_id, name, version)
);

create table public.released_reports (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete cascade,
  released_by uuid not null references public.profiles(id) on delete restrict,
  summary jsonb not null,
  released_at timestamptz not null default now()
);

create index questions_owner_filters
  on public.questions(owner_id, section, domain, skill, difficulty, status);
create index attempts_live_monitor
  on public.attempts(status, last_heartbeat_at desc);
create index attempt_events_attempt_time
  on public.attempt_events(attempt_id, server_created_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    role,
    display_name,
    username,
    must_change_password
  )
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'student'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'username',
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_tutor()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'tutor';
$$;

create or replace function public.is_assigned_student(target_assignment uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.assignment_students ast
    where ast.assignment_id = target_assignment
      and ast.student_id = auth.uid()
  );
$$;

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
      and now() between a.available_at and a.due_at
  );
$$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.source_documents enable row level security;
alter table public.questions enable row level security;
alter table public.question_versions enable row level security;
alter table public.question_assets enable row level security;
alter table public.accepted_answers enable row level security;
alter table public.tests enable row level security;
alter table public.test_modules enable row level security;
alter table public.module_questions enable row level security;
alter table public.adaptive_routes enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_students enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.annotations enable row level security;
alter table public.attempt_events enable row level security;
alter table public.score_models enable row level security;
alter table public.released_reports enable row level security;

create policy profiles_read_self_or_students
  on public.profiles for select
  using (
    id = auth.uid()
    or (
      public.is_tutor()
      and exists (
        select 1 from public.students s
        where s.user_id = profiles.id and s.tutor_id = auth.uid()
      )
    )
  );

create policy profiles_update_self
  on public.profiles for update using (id = auth.uid());

create policy students_read
  on public.students for select
  using (user_id = auth.uid() or tutor_id = auth.uid());
create policy students_tutor_write
  on public.students for all
  using (tutor_id = auth.uid() and public.is_tutor())
  with check (tutor_id = auth.uid() and public.is_tutor());

create policy source_documents_tutor_only
  on public.source_documents for all
  using (owner_id = auth.uid() and public.is_tutor())
  with check (owner_id = auth.uid() and public.is_tutor());

create policy questions_tutor_write
  on public.questions for all
  using (owner_id = auth.uid() and public.is_tutor())
  with check (owner_id = auth.uid() and public.is_tutor());
create policy questions_student_assigned_read
  on public.questions for select
  using (public.can_access_question(id));

create policy question_versions_tutor_write
  on public.question_versions for all
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_versions.question_id
        and q.owner_id = auth.uid()
        and public.is_tutor()
    )
  )
  with check (
    exists (
      select 1 from public.questions q
      where q.id = question_versions.question_id
        and q.owner_id = auth.uid()
        and public.is_tutor()
    )
  );
create policy question_versions_student_read
  on public.question_versions for select
  using (public.can_access_question(question_id));

create policy question_assets_tutor_write
  on public.question_assets for all
  using (
    exists (
      select 1 from public.question_versions qv
      join public.questions q on q.id = qv.question_id
      where qv.id = question_assets.question_version_id
        and q.owner_id = auth.uid()
        and public.is_tutor()
    )
  )
  with check (
    exists (
      select 1 from public.question_versions qv
      join public.questions q on q.id = qv.question_id
      where qv.id = question_assets.question_version_id
        and q.owner_id = auth.uid()
        and public.is_tutor()
    )
  );
create policy question_assets_student_prompt_read
  on public.question_assets for select
  using (
    kind = 'prompt'
    and exists (
      select 1 from public.question_versions qv
      where qv.id = question_assets.question_version_id
        and public.can_access_question(qv.question_id)
    )
  );
create policy question_assets_student_released_rationale
  on public.question_assets for select
  using (
    kind = 'rationale'
    and exists (
      select 1
      from public.question_versions qv
      join public.responses r on r.question_id = qv.question_id
      join public.attempts a on a.id = r.attempt_id
      where qv.id = question_assets.question_version_id
        and a.student_id = auth.uid()
        and a.released
    )
  );

create policy accepted_answers_tutor_only
  on public.accepted_answers for all
  using (
    exists (
      select 1 from public.question_versions qv
      join public.questions q on q.id = qv.question_id
      where qv.id = accepted_answers.question_version_id
        and q.owner_id = auth.uid()
        and public.is_tutor()
    )
  )
  with check (
    exists (
      select 1 from public.question_versions qv
      join public.questions q on q.id = qv.question_id
      where qv.id = accepted_answers.question_version_id
        and q.owner_id = auth.uid()
        and public.is_tutor()
    )
  );

create policy tests_tutor_write
  on public.tests for all
  using (owner_id = auth.uid() and public.is_tutor())
  with check (owner_id = auth.uid() and public.is_tutor());
create policy tests_student_assigned_read
  on public.tests for select
  using (
    exists (
      select 1 from public.assignments a
      where a.test_id = tests.id and public.is_assigned_student(a.id)
    )
  );

create policy modules_tutor_write
  on public.test_modules for all
  using (
    exists (
      select 1 from public.tests t
      where t.id = test_modules.test_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tests t
      where t.id = test_modules.test_id and t.owner_id = auth.uid()
    )
  );
create policy modules_student_assigned_read
  on public.test_modules for select
  using (
    exists (
      select 1 from public.assignments a
      where a.test_id = test_modules.test_id and public.is_assigned_student(a.id)
    )
  );

create policy module_questions_tutor_write
  on public.module_questions for all
  using (
    exists (
      select 1 from public.test_modules tm
      join public.tests t on t.id = tm.test_id
      where tm.id = module_questions.module_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.test_modules tm
      join public.tests t on t.id = tm.test_id
      where tm.id = module_questions.module_id and t.owner_id = auth.uid()
    )
  );
create policy module_questions_student_assigned_read
  on public.module_questions for select
  using (public.can_access_question(question_id));

create policy adaptive_routes_tutor_only
  on public.adaptive_routes for all
  using (
    exists (
      select 1 from public.tests t
      where t.id = adaptive_routes.test_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tests t
      where t.id = adaptive_routes.test_id and t.owner_id = auth.uid()
    )
  );

create policy assignments_read
  on public.assignments for select
  using (tutor_id = auth.uid() or public.is_assigned_student(id));
create policy assignments_tutor_write
  on public.assignments for all
  using (tutor_id = auth.uid() and public.is_tutor())
  with check (tutor_id = auth.uid() and public.is_tutor());

create policy assignment_students_read
  on public.assignment_students for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_students.assignment_id
        and a.tutor_id = auth.uid()
    )
  );
create policy assignment_students_tutor_write
  on public.assignment_students for all
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_students.assignment_id
        and a.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_students.assignment_id
        and a.tutor_id = auth.uid()
    )
  );

create policy attempts_read
  on public.attempts for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.assignments a
      where a.id = attempts.assignment_id and a.tutor_id = auth.uid()
    )
  );
create policy attempts_student_insert
  on public.attempts for insert
  with check (student_id = auth.uid() and public.is_assigned_student(assignment_id));
create policy attempts_student_update
  on public.attempts for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
create policy attempts_tutor_update
  on public.attempts for update
  using (
    exists (
      select 1 from public.assignments a
      where a.id = attempts.assignment_id and a.tutor_id = auth.uid()
    )
  );

create policy responses_read
  on public.responses for select
  using (
    exists (
      select 1 from public.attempts a
      join public.assignments assignment on assignment.id = a.assignment_id
      where a.id = responses.attempt_id
        and (a.student_id = auth.uid() or assignment.tutor_id = auth.uid())
    )
  );
create policy responses_student_write
  on public.responses for all
  using (
    exists (
      select 1 from public.attempts a
      where a.id = responses.attempt_id
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
    )
  )
  with check (
    exists (
      select 1 from public.attempts a
      where a.id = responses.attempt_id
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
    )
  );

create policy annotations_read_write
  on public.annotations for all
  using (
    exists (
      select 1 from public.attempts a
      join public.assignments assignment on assignment.id = a.assignment_id
      where a.id = annotations.attempt_id
        and (a.student_id = auth.uid() or assignment.tutor_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.attempts a
      where a.id = annotations.attempt_id and a.student_id = auth.uid()
    )
  );

create policy attempt_events_read
  on public.attempt_events for select
  using (
    exists (
      select 1 from public.attempts a
      join public.assignments assignment on assignment.id = a.assignment_id
      where a.id = attempt_events.attempt_id
        and (a.student_id = auth.uid() or assignment.tutor_id = auth.uid())
    )
  );
create policy attempt_events_student_insert
  on public.attempt_events for insert
  with check (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_events.attempt_id and a.student_id = auth.uid()
    )
  );

create policy score_models_tutor_only
  on public.score_models for all
  using (owner_id = auth.uid() and public.is_tutor())
  with check (owner_id = auth.uid() and public.is_tutor());

create policy released_reports_read
  on public.released_reports for select
  using (
    exists (
      select 1 from public.attempts a
      join public.assignments assignment on assignment.id = a.assignment_id
      where a.id = released_reports.attempt_id
        and (a.student_id = auth.uid() or assignment.tutor_id = auth.uid())
    )
  );
create policy released_reports_tutor_write
  on public.released_reports for all
  using (released_by = auth.uid() and public.is_tutor())
  with check (released_by = auth.uid() and public.is_tutor());

insert into storage.buckets (id, name, public)
values
  ('question-assets', 'question-assets', false),
  ('source-pdfs', 'source-pdfs', false)
on conflict (id) do update set public = false;

create policy tutor_upload_question_assets
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'question-assets'
    and public.is_tutor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy tutor_manage_question_assets
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'question-assets'
    and public.is_tutor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy tutor_upload_source_pdfs
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'source-pdfs'
    and public.is_tutor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy tutor_manage_source_pdfs
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'source-pdfs'
    and public.is_tutor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Students receive short-lived signed asset URLs from authorization-checked routes;
-- they never receive direct storage read policies or access to source PDFs.

do $$
begin
  alter publication supabase_realtime add table public.attempts;
exception
  when duplicate_object then null;
end $$;
