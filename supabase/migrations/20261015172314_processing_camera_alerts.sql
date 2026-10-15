begin;
create table public.processing_director_cameras (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.processing_director_workspaces(id),
 name text not null check(length(btrim(name)) between 1 and 100),
 zone_name text not null check(length(btrim(zone_name)) between 1 and 100),
 mode text not null check(mode in ('outside_hours','restricted_zone')),
 timezone text not null default 'Africa/Lagos' check(length(timezone)<=100),
 allowed_start integer not null check(allowed_start between 0 and 1439),
 allowed_end integer not null check(allowed_end between 0 and 1439 and allowed_end<>allowed_start),
 zone_x numeric not null check(zone_x>=0 and zone_x<1),
 zone_y numeric not null check(zone_y>=0 and zone_y<1),
 zone_width numeric not null check(zone_width>0 and zone_width<=1 and zone_x+zone_width<=1),
 zone_height numeric not null check(zone_height>0 and zone_height<=1 and zone_y+zone_height<=1),
 enabled boolean not null default false,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz,
 last_alert_at timestamptz
);
create index processing_director_camera_workspace_idx on public.processing_director_cameras(workspace_id,created_at desc,id);
create table public.processing_director_camera_keys (
 camera_id uuid primary key references public.processing_director_cameras(id),
 token_hash text not null check(token_hash~'^[a-f0-9]{64}$'),
 expires_at timestamptz not null
);
create table public.processing_director_movement_alerts (
 id uuid primary key default gen_random_uuid(),
 camera_id uuid not null references public.processing_director_cameras(id),
 workspace_id uuid not null references public.processing_director_workspaces(id),
 event_id uuid not null,
 occurred_at timestamptz not null,
 received_at timestamptz not null default now(),
 camera_name text not null,
 zone_name text not null,
 rule_mode text not null,
 rule_revision integer not null,
 motion_ratio numeric not null check(motion_ratio between .05 and 1),
 snapshot_png text not null check(length(snapshot_png)<=120000),
 status text not null default 'needs_review' check(status in ('needs_review','expected_activity','follow_up')),
 review_note text check(length(review_note)<=2000),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 revision integer not null default 1,
 unique(camera_id,event_id)
);
create index processing_director_alert_workspace_idx on public.processing_director_movement_alerts(workspace_id,received_at desc,id);
alter table public.processing_director_cameras enable row level security;
alter table public.processing_director_camera_keys enable row level security;
alter table public.processing_director_movement_alerts enable row level security;
create policy processing_camera_read on public.processing_director_cameras for select to authenticated using(workspace_id in(select id from public.processing_director_workspaces where owner_id=(select auth.uid())));
create policy processing_camera_create on public.processing_director_cameras for insert to authenticated with check(workspace_id in(select id from public.processing_director_workspaces where owner_id=(select auth.uid())));
create policy processing_camera_edit on public.processing_director_cameras for update to authenticated using(workspace_id in(select id from public.processing_director_workspaces where owner_id=(select auth.uid()))) with check(workspace_id in(select id from public.processing_director_workspaces where owner_id=(select auth.uid())));
create policy processing_alert_read on public.processing_director_movement_alerts for select to authenticated using(workspace_id in(select id from public.processing_director_workspaces where owner_id=(select auth.uid())));
create policy processing_alert_review on public.processing_director_movement_alerts for update to authenticated using(workspace_id in(select id from public.processing_director_workspaces where owner_id=(select auth.uid()))) with check(workspace_id in(select id from public.processing_director_workspaces where owner_id=(select auth.uid())));
create function stratum_processing_private.stamp_camera() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
 if tg_op='UPDATE' and (to_jsonb(new)-array['last_seen_at','last_alert_at']) is distinct from (to_jsonb(old)-array['last_seen_at','last_alert_at']) then
  if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id then raise exception 'Camera identity is immutable'; end if;
  new.revision:=old.revision+1;
 end if;
 return new;
end;$$;
create trigger processing_camera_stamp before insert or update on public.processing_director_cameras for each row execute function stratum_processing_private.stamp_camera();
create function stratum_processing_private.review_movement() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if new.status not in('expected_activity','follow_up') or length(btrim(coalesce(new.review_note,'')))=0 then raise exception 'A review decision and reason are required'; end if;
 if auth.uid() is null then raise exception 'A signed-in reviewer is required'; end if;
 new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();new.revision:=old.revision+1;
 return new;
end;$$;
create trigger processing_movement_review before update on public.processing_director_movement_alerts for each row execute function stratum_processing_private.review_movement();
revoke all on function stratum_processing_private.stamp_camera(),stratum_processing_private.review_movement() from public,anon,authenticated;
revoke all on public.processing_director_cameras,public.processing_director_camera_keys,public.processing_director_movement_alerts from public,anon,authenticated;
grant select on public.processing_director_cameras,public.processing_director_movement_alerts to authenticated;
grant insert(workspace_id,name,zone_name,mode,timezone,allowed_start,allowed_end,zone_x,zone_y,zone_width,zone_height,enabled) on public.processing_director_cameras to authenticated;
grant update(name,zone_name,mode,timezone,allowed_start,allowed_end,zone_x,zone_y,zone_width,zone_height,enabled) on public.processing_director_cameras to authenticated;
grant update(status,review_note) on public.processing_director_movement_alerts to authenticated;
grant select,insert,update on public.processing_director_cameras,public.processing_director_camera_keys,public.processing_director_movement_alerts to service_role;
create function public.ingest_processing_camera_motion(p_camera_id uuid,p_hash text,p_event_id uuid,p_occurred_at timestamptz,p_revision integer,p_ratio numeric,p_snapshot text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare camera public.processing_director_cameras; minute integer; local_time timestamp; permitted boolean; alert_id uuid;
begin
 -- Lock the key and camera so rotation, cooldown and rule changes are authoritative.
 perform 1 from public.processing_director_camera_keys where camera_id=p_camera_id and token_hash=p_hash and expires_at>clock_timestamp() for share;
 if not found then raise exception 'Invalid gateway credential' using errcode='42501'; end if;
 select * into camera from public.processing_director_cameras where id=p_camera_id for update;
 if not found or not camera.enabled then raise exception 'Camera is disabled' using errcode='42501'; end if;
 if camera.revision<>p_revision then raise exception 'Camera rule changed. Reload configuration.'; end if;
 if p_occurred_at is null or abs(extract(epoch from clock_timestamp()-p_occurred_at))>120 or p_ratio is null or p_ratio<.05 or p_ratio>1 or p_snapshot is null or length(p_snapshot)>120000 then raise exception 'Invalid or stale event'; end if;
 select id into alert_id from public.processing_director_movement_alerts where camera_id=p_camera_id and event_id=p_event_id;
 if found then return jsonb_build_object('status','duplicate','alert_id',alert_id); end if;
 update public.processing_director_cameras set last_seen_at=clock_timestamp() where id=p_camera_id;
 local_time:=p_occurred_at at time zone camera.timezone;
 minute:=extract(hour from local_time)::integer*60+extract(minute from local_time)::integer;
 permitted:=case when camera.allowed_start<camera.allowed_end then minute>=camera.allowed_start and minute<camera.allowed_end else minute>=camera.allowed_start or minute<camera.allowed_end end;
 if camera.mode='outside_hours' and permitted then return jsonb_build_object('status','within_permitted_hours'); end if;
 if camera.last_alert_at>clock_timestamp()-interval '60 seconds' then return jsonb_build_object('status','cooldown'); end if;
 insert into public.processing_director_movement_alerts(camera_id,workspace_id,event_id,occurred_at,camera_name,zone_name,rule_mode,rule_revision,motion_ratio,snapshot_png)
 values(camera.id,camera.workspace_id,p_event_id,p_occurred_at,camera.name,camera.zone_name,camera.mode,camera.revision,p_ratio,p_snapshot) returning id into alert_id;
 update public.processing_director_cameras set last_alert_at=clock_timestamp() where id=p_camera_id;
 return jsonb_build_object('status','needs_review','alert_id',alert_id);
end;$$;
revoke all on function public.ingest_processing_camera_motion(uuid,text,uuid,timestamptz,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.ingest_processing_camera_motion(uuid,text,uuid,timestamptz,integer,numeric,text) to service_role;
commit;

