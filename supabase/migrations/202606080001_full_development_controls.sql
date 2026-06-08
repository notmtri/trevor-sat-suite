alter type public.question_status add value if not exists 'archived';

alter table public.questions
  add column if not exists tags text[] not null default '{}';

create index if not exists questions_tags_gin
  on public.questions using gin(tags);

create table if not exists public.tutor_settings (
  tutor_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null default 'Trevor',
  landing_headline text not null default 'Serious SAT practice, with realistic testing experience.',
  landing_subheadline text not null default 'Practice tutor-approved SAT questions from College Board''s official question bank. Experience a carefully designed testing interface.',
  hero_eyebrow text not null default 'Your SAT tutor',
  hero_title text not null default 'Hi, I''m Trevor.',
  hero_subtitle text not null default 'CompSci Undergraduate | 1550 SAT | 8.5 IELTS',
  timezone text not null default 'Asia/Saigon',
  default_due_days integer not null default 7 check (default_due_days between 1 and 120),
  default_attempt_limit integer not null default 1 check (default_attempt_limit between 1 and 20),
  default_feedback_policy public.feedback_policy not null default 'after_submission',
  default_allow_resume boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.tutor_settings enable row level security;

drop policy if exists tutor_settings_tutor_only on public.tutor_settings;
create policy tutor_settings_tutor_only
  on public.tutor_settings for all
  using (tutor_id = auth.uid() and public.is_tutor())
  with check (tutor_id = auth.uid() and public.is_tutor());

alter table public.assignment_students
  add column if not exists available_at timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists attempt_limit integer check (attempt_limit between 1 and 20),
  add column if not exists recipient_status text not null default 'assigned'
    check (recipient_status in ('assigned', 'extended', 'excused'));

create index if not exists assignment_students_recipient_status
  on public.assignment_students(assignment_id, recipient_status);

alter table public.released_reports
  add column if not exists updated_at timestamptz not null default now();
