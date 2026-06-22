-- A null module duration represents an untimed module.
alter table public.test_modules
  alter column duration_minutes drop not null;

alter table public.test_modules
  drop constraint if exists test_modules_duration_minutes_check;

alter table public.test_modules
  add constraint test_modules_duration_minutes_check
  check (duration_minutes is null or duration_minutes > 0);
