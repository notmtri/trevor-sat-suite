alter table public.assignments
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archived_previous_status public.assignment_status;

create index if not exists assignments_tutor_archive_status
  on public.assignments(tutor_id, archived_at, status);

create or replace function public.archive_assignment(target_assignment uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  archived_time timestamptz := now();
begin
  if not public.is_tutor() then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.assignments
    where id = target_assignment
      and tutor_id = auth.uid()
  ) then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;

  update public.assignments
  set
    archived_previous_status = case
      when archived_at is null then status
      else archived_previous_status
    end,
    archived_at = coalesce(archived_at, archived_time),
    archived_by = coalesce(archived_by, auth.uid()),
    status = 'closed'
  where id = target_assignment
    and tutor_id = auth.uid();

  update public.attempts
  set
    status = 'expired',
    submitted_at = coalesce(submitted_at, archived_time),
    server_deadline = null,
    connection_status = 'stale',
    last_heartbeat_at = archived_time,
    released = false
  where assignment_id = target_assignment
    and status in ('not_started', 'in_progress');
end;
$$;

create or replace function public.restore_assignment(target_assignment uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_tutor() then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.assignments
    where id = target_assignment
      and tutor_id = auth.uid()
  ) then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;

  update public.assignments
  set
    status = coalesce(archived_previous_status, 'closed'),
    archived_at = null,
    archived_by = null,
    archived_previous_status = null
  where id = target_assignment
    and tutor_id = auth.uid()
    and archived_at is not null;
end;
$$;

revoke execute on function public.archive_assignment(uuid) from public, anon;
revoke execute on function public.restore_assignment(uuid) from public, anon;
grant execute on function public.archive_assignment(uuid) to authenticated;
grant execute on function public.restore_assignment(uuid) to authenticated;
