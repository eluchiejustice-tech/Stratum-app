-- Adapted from GeoMind mill operations. Creates fresh Stratum-owned records; imports no users or data.

create schema if not exists stratum_processing_private;
revoke all on schema stratum_processing_private from public, anon, authenticated;
create table public.processing_director_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 200),
  location text check (length(location) <= 200),
  created_at timestamptz not null default now()
);
create index processing_director_owner_idx on public.processing_director_workspaces(owner_id,created_at desc,id);
create unique index processing_director_workspace_name_idx on public.processing_director_workspaces(owner_id,lower(btrim(name)));
create table public.processing_director_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.processing_director_workspaces(id),
  batch_code text not null check (length(btrim(batch_code)) between 1 and 200),
  received_on date not null,
  claimed_mineral text not null check (length(btrim(claimed_mineral)) between 1 and 200),
  received_weight_kg numeric not null check (received_weight_kg > 0 and received_weight_kg <= 1e12),
  supplier text check (length(supplier) <= 200),
  origin text check (length(origin) <= 200),
  intake_notes text check (length(intake_notes) <= 4000),
  feed_sample_code text check (length(feed_sample_code) <= 200),
  concentrate_sample_code text check (length(concentrate_sample_code) <= 200),
  analyte text check (length(analyte) <= 200),
  laboratory text check (length(laboratory) <= 200),
  assay_report_ref text check (length(assay_report_ref) <= 200),
  assay_method text check (length(assay_method) <= 200),
  assayed_on date,
  feed_grade_pct numeric check (feed_grade_pct >= 0 and feed_grade_pct <= 100),
  concentrate_grade_pct numeric check (concentrate_grade_pct >= 0 and concentrate_grade_pct <= 100),
  processing_method text check (length(processing_method) <= 200),
  processed_on date,
  feed_dry_kg numeric check (feed_dry_kg > 0 and feed_dry_kg <= 1e12),
  concentrate_dry_kg numeric check (concentrate_dry_kg >= 0 and concentrate_dry_kg <= 1e12),
  tailings_dry_kg numeric check (tailings_dry_kg >= 0 and tailings_dry_kg <= 1e12),
  downtime_minutes numeric check (downtime_minutes >= 0 and downtime_minutes <= 1e12),
  processing_notes text check (length(processing_notes) <= 4000),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index processing_director_batch_code_idx on public.processing_director_batches(workspace_id,lower(btrim(batch_code)));
create index processing_director_batch_page_idx on public.processing_director_batches(workspace_id,created_at desc,id);
create table public.processing_director_batch_revisions (
  batch_id uuid not null references public.processing_director_batches(id),
  workspace_id uuid not null references public.processing_director_workspaces(id),
  revision integer not null,
  actor_id uuid not null references auth.users(id),
  saved_at timestamptz not null,
  snapshot jsonb not null,
  primary key(batch_id,revision)
);
create index processing_director_revision_workspace_idx on public.processing_director_batch_revisions(workspace_id);
alter table public.processing_director_workspaces enable row level security;
alter table public.processing_director_batches enable row level security;
alter table public.processing_director_batch_revisions enable row level security;
create policy processing_director_workspace_read on public.processing_director_workspaces for select to authenticated using (owner_id = (select auth.uid()));
create policy processing_director_workspace_create on public.processing_director_workspaces for insert to authenticated with check (owner_id = (select auth.uid()));
create policy processing_director_batch_read on public.processing_director_batches for select to authenticated using (workspace_id in (select id from public.processing_director_workspaces where owner_id = (select auth.uid())));
create policy processing_director_batch_create on public.processing_director_batches for insert to authenticated with check (workspace_id in (select id from public.processing_director_workspaces where owner_id = (select auth.uid())));
create policy processing_director_batch_update on public.processing_director_batches for update to authenticated using (workspace_id in (select id from public.processing_director_workspaces where owner_id = (select auth.uid()))) with check (workspace_id in (select id from public.processing_director_workspaces where owner_id = (select auth.uid())));
create policy processing_director_revision_read on public.processing_director_batch_revisions for select to authenticated using (workspace_id in (select id from public.processing_director_workspaces where owner_id = (select auth.uid())));

create function stratum_processing_private.stamp_batch() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id or new.created_at is distinct from old.created_at then
      raise exception 'Batch identity cannot be changed' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  else
    new.revision := 1;
    new.created_at := clock_timestamp();
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create function stratum_processing_private.archive_batch() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or not exists(select 1 from public.processing_director_workspaces w where w.id = new.workspace_id and w.owner_id = auth.uid()) then
    raise exception 'Director access required' using errcode = '42501';
  end if;
  insert into public.processing_director_batch_revisions(batch_id,workspace_id,revision,actor_id,saved_at,snapshot)
  values(new.id,new.workspace_id,new.revision,auth.uid(),new.updated_at,to_jsonb(new));
  return new;
end;
$$;
revoke all on function stratum_processing_private.stamp_batch() from public,anon,authenticated;
revoke all on function stratum_processing_private.archive_batch() from public,anon,authenticated;
create trigger processing_director_stamp before insert or update on public.processing_director_batches for each row execute function stratum_processing_private.stamp_batch();
create trigger processing_director_archive after insert or update on public.processing_director_batches for each row execute function stratum_processing_private.archive_batch();

revoke all on public.processing_director_workspaces,public.processing_director_batches,public.processing_director_batch_revisions from public,anon,authenticated;
grant select on public.processing_director_workspaces,public.processing_director_batches,public.processing_director_batch_revisions to authenticated;
grant insert (name,location) on public.processing_director_workspaces to authenticated;
grant insert (workspace_id,batch_code,received_on,claimed_mineral,received_weight_kg,supplier,origin,intake_notes,feed_sample_code,concentrate_sample_code,analyte,laboratory,assay_report_ref,assay_method,assayed_on,feed_grade_pct,concentrate_grade_pct,processing_method,processed_on,feed_dry_kg,concentrate_dry_kg,tailings_dry_kg,downtime_minutes,processing_notes) on public.processing_director_batches to authenticated;
grant update (batch_code,received_on,claimed_mineral,received_weight_kg,supplier,origin,intake_notes,feed_sample_code,concentrate_sample_code,analyte,laboratory,assay_report_ref,assay_method,assayed_on,feed_grade_pct,concentrate_grade_pct,processing_method,processed_on,feed_dry_kg,concentrate_dry_kg,tailings_dry_kg,downtime_minutes,processing_notes) on public.processing_director_batches to authenticated;



-- Team operations extend the existing private director ledger without replacing it.
create schema stratum_processing_team;
revoke all on schema stratum_processing_team from public,anon,authenticated;
grant usage on schema stratum_processing_team to authenticated;
alter table public.processing_director_batches alter column received_weight_kg drop not null;
alter table public.processing_director_batches add column bag_count integer check(bag_count>0 and bag_count<=10000000);
alter table public.processing_director_batches add column output_bags integer check(output_bags>=0 and output_bags<=10000000);
alter table public.processing_director_batches add column output_weight_kg numeric check(output_weight_kg>=0 and output_weight_kg<=1e12);
alter table public.processing_director_batches add column workflow_status text not null default 'received' check(workflow_status in ('received','approved','processing','processed','completed','dispatched','rejected'));
alter table public.processing_director_batches add constraint processing_received_quantity check(bag_count is not null or received_weight_kg is not null);
create table public.processing_mill_members (
 workspace_id uuid not null references public.processing_director_workspaces(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('receiving','manager','production','supervisor','laboratory','dispatch')),
 display_name text not null check(length(btrim(display_name)) between 1 and 100), account_email text,
 status text not null check(status in ('pending','active','revoked')), joined_at timestamptz not null default now(), primary key(workspace_id,user_id)
);
create table stratum_processing_team.invites (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.processing_director_workspaces(id),
 token_hash text not null unique,role text not null check(role in ('receiving','manager','production','supervisor','laboratory','dispatch')),
 display_name text not null check(length(btrim(display_name)) between 1 and 100), created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',claimed_by uuid references auth.users(id),revoked boolean not null default false
);
create table stratum_processing_team.requests (
 workspace_id uuid not null references public.processing_director_workspaces(id),request_id uuid not null,actor_id uuid not null references auth.users(id),
 action text not null,payload jsonb not null,batch_id uuid not null references public.processing_director_batches(id),primary key(workspace_id,request_id)
);
create table public.processing_mill_events (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.processing_director_workspaces(id),batch_id uuid not null references public.processing_director_batches(id),
 actor_id uuid not null references auth.users(id),actor_name text not null,actor_role text not null,action text not null,
 recorded_at timestamptz not null default clock_timestamp(),revision integer not null,snapshot jsonb not null,
 unique(batch_id,revision)
);
create index processing_mill_event_page on public.processing_mill_events(workspace_id,recorded_at desc,id);
create index processing_mill_event_batch on public.processing_mill_events(batch_id,recorded_at);
alter table public.processing_mill_members enable row level security;
alter table public.processing_mill_events enable row level security;
alter table stratum_processing_team.invites enable row level security;
alter table stratum_processing_team.requests enable row level security;
revoke all on public.processing_mill_members,public.processing_mill_events from public,anon,authenticated;
revoke all on stratum_processing_team.invites,stratum_processing_team.requests from public,anon,authenticated;
grant select on public.processing_mill_members,public.processing_mill_events to authenticated;

create function stratum_processing_team.role_for(w uuid) returns text language sql stable security definer set search_path=pg_catalog as $$
 select case when auth.uid() is null then null when exists(select 1 from public.processing_director_workspaces where id=w and owner_id=auth.uid()) then 'director'
 else (select role from public.processing_mill_members where workspace_id=w and user_id=auth.uid() and status='active') end
$$;
revoke all on function stratum_processing_team.role_for(uuid) from public,anon;
grant execute on function stratum_processing_team.role_for(uuid) to authenticated;
create policy mill_member_read on public.processing_mill_members for select to authenticated using(user_id=(select auth.uid()) or stratum_processing_team.role_for(workspace_id)='director');
create policy mill_event_read on public.processing_mill_events for select to authenticated using(stratum_processing_team.role_for(workspace_id) is not null);
create policy mill_workspace_team_read on public.processing_director_workspaces for select to authenticated using(stratum_processing_team.role_for(id) is not null);
create policy mill_batch_team_read on public.processing_director_batches for select to authenticated using(stratum_processing_team.role_for(workspace_id) is not null);
create policy mill_revision_team_read on public.processing_director_batch_revisions for select to authenticated using(stratum_processing_team.role_for(workspace_id) is not null);

-- Every write, including a legacy director edit, has an actor and an immutable activity event.
create or replace function stratum_processing_private.archive_batch() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare r text; n text; a text;
begin
 r:=stratum_processing_team.role_for(new.workspace_id);
 if r is null then raise exception 'Mill access required' using errcode='42501'; end if;
 n:=case when r='director' then 'Director' else (select display_name from public.processing_mill_members where workspace_id=new.workspace_id and user_id=auth.uid()) end;
 a:=coalesce(nullif(current_setting('stratum.mill_action',true),''),'record_update');
 insert into public.processing_director_batch_revisions(batch_id,workspace_id,revision,actor_id,saved_at,snapshot) values(new.id,new.workspace_id,new.revision,auth.uid(),new.updated_at,to_jsonb(new));
 insert into public.processing_mill_events(workspace_id,batch_id,actor_id,actor_name,actor_role,action,revision,snapshot) values(new.workspace_id,new.id,auth.uid(),n,r,a,new.revision,to_jsonb(new));
 return new;
end; $$;

create function stratum_processing_team.record_batch(w uuid,a text,p jsonb,b uuid,expected integer,request uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r text; row public.processing_director_batches; previous stratum_processing_team.requests; allowed text[];
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 perform 1 from public.processing_director_workspaces where id=w for update;
 r:=stratum_processing_team.role_for(w);
 if r is null then raise exception 'Mill access required' using errcode='42501'; end if;
 if request is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>20000 then raise exception 'Invalid submission'; end if;
 select * into previous from stratum_processing_team.requests where workspace_id=w and request_id=request;
 if found then
  if previous.actor_id<>auth.uid() or previous.action<>a or previous.payload<>p or (a<>'receive' and previous.batch_id is distinct from b) then raise exception 'Submission ID already used'; end if;
  return (select to_jsonb(x) from public.processing_director_batches x where id=previous.batch_id);
 end if;
 if a='receive' then
  if r not in ('director','receiving','manager') then raise exception 'Receiving role required' using errcode='42501'; end if;
  allowed:=array['batch_code','received_on','claimed_mineral','bag_count','received_weight_kg','supplier','origin','intake_notes'];
 else
  select * into row from public.processing_director_batches where id=b and workspace_id=w for update;
  if not found or row.revision is distinct from expected then raise exception 'Batch changed. Refresh before submitting.' using errcode='40001'; end if;
  if a in ('approve','reject') then
   if r not in ('director','manager') or row.workflow_status<>'received' then raise exception 'Manager review is not available for this batch' using errcode='42501'; end if;
   allowed:=array['notes'];
  elsif a='start' then
   if r not in ('director','production') or row.workflow_status<>'approved' then raise exception 'Approved batch and production role required' using errcode='42501'; end if;
   allowed:=array['processing_method','notes'];
  elsif a='finish' then
   if r not in ('director','production') or row.workflow_status<>'processing' then raise exception 'Running batch and production role required' using errcode='42501'; end if;
   allowed:=array['output_bags','output_weight_kg','notes'];
  elsif a='verify' then
   if r not in ('director','supervisor') or row.workflow_status<>'processed' then raise exception 'Supervisor check is not available' using errcode='42501'; end if;
   allowed:=array['notes'];
  elsif a='dispatch' then
   if r not in ('director','dispatch') or row.workflow_status<>'completed' then raise exception 'Checked batch and dispatch role required' using errcode='42501'; end if;
   allowed:=array['notes'];
  elsif a='note' then allowed:=array['notes'];
  else raise exception 'Unknown action'; end if;
 end if;
 if exists(select 1 from jsonb_object_keys(p) k where not(k=any(allowed))) then raise exception 'Unexpected fields in submission'; end if;
 if a<>'receive' and length(btrim(coalesce(p->>'notes',''))) not between 1 and 4000 then raise exception 'Add a short record of this step'; end if;
 perform set_config('stratum.mill_action',a,true);
 if a='receive' then
  if coalesce(nullif(p->>'received_on','')::date,current_date)>current_date then raise exception 'Received date cannot be in the future'; end if;
  insert into public.processing_director_batches(workspace_id,batch_code,received_on,claimed_mineral,bag_count,received_weight_kg,supplier,origin,intake_notes)
  values(w,btrim(p->>'batch_code'),coalesce(nullif(p->>'received_on','')::date,current_date),btrim(p->>'claimed_mineral'),nullif(p->>'bag_count','')::integer,nullif(p->>'received_weight_kg','')::numeric,nullif(btrim(p->>'supplier'),''),nullif(btrim(p->>'origin'),''),nullif(btrim(p->>'intake_notes'),'')) returning * into row;
 else
  if a='start' and length(btrim(coalesce(p->>'processing_method',''))) not between 1 and 200 then raise exception 'Enter the processing method'; end if;
  if a='finish' and nullif(p->>'output_bags','') is null and nullif(p->>'output_weight_kg','') is null then raise exception 'Record measured output bags or weight'; end if;
  update public.processing_director_batches set
   workflow_status=case a when 'approve' then 'approved' when 'reject' then 'rejected' when 'start' then 'processing' when 'finish' then 'processed' when 'verify' then 'completed' when 'dispatch' then 'dispatched' else workflow_status end,
   processing_method=case when a='start' then btrim(p->>'processing_method') else processing_method end,
   processed_on=case when a='finish' then current_date else processed_on end,
   output_bags=case when a='finish' then nullif(p->>'output_bags','')::integer else output_bags end,
   output_weight_kg=case when a='finish' then nullif(p->>'output_weight_kg','')::numeric else output_weight_kg end,
   processing_notes=p->>'notes' where id=b returning * into row;
 end if;
 insert into stratum_processing_team.requests values(w,request,auth.uid(),a,p,row.id);
 perform set_config('stratum.mill_action','',true);
 return to_jsonb(row);
end; $$;

create function stratum_processing_team.team_action(w uuid,a text,p jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare invitation stratum_processing_team.invites; token text; u uuid; r text;
begin
 if auth.uid() is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>2000 then raise exception 'Sign in with a valid request' using errcode='42501'; end if;
 if a='join' then
  if length(coalesce(p->>'code',''))<>64 then raise exception 'Invalid invitation code'; end if;
  select * into invitation from stratum_processing_team.invites where token_hash=encode(sha256(convert_to(p->>'code','UTF8')),'hex') and not revoked and expires_at>now() for update;
  if not found or (invitation.claimed_by is not null and invitation.claimed_by<>auth.uid()) then raise exception 'Invitation expired, revoked or already used'; end if;
  if stratum_processing_team.role_for(invitation.workspace_id) is not null then raise exception 'You already have access to this mill'; end if;
  insert into public.processing_mill_members(workspace_id,user_id,role,display_name,account_email,status)
   select invitation.workspace_id,auth.uid(),invitation.role,invitation.display_name,email,'pending' from auth.users where id=auth.uid()
   on conflict(workspace_id,user_id) do update set role=excluded.role,display_name=excluded.display_name,account_email=excluded.account_email,status='pending';
  update stratum_processing_team.invites set claimed_by=auth.uid() where id=invitation.id;
  return jsonb_build_object('pending',true);
 end if;
 perform 1 from public.processing_director_workspaces where id=w for update;
 if stratum_processing_team.role_for(w) is distinct from 'director' then raise exception 'Only the director manages staff' using errcode='42501'; end if;
 if a='invite' then
  token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into stratum_processing_team.invites(workspace_id,token_hash,role,display_name) values(w,encode(sha256(convert_to(token,'UTF8')),'hex'),p->>'role',btrim(p->>'name')) returning * into invitation;
  return jsonb_build_object('id',invitation.id,'code',token,'expires_at',invitation.expires_at);
 elsif a='approve_member' then
  u:=(p->>'user_id')::uuid;
  if not exists(select 1 from stratum_processing_team.invites where workspace_id=w and claimed_by=u and not revoked and expires_at>now() and role=(select m.role from public.processing_mill_members m where m.workspace_id=w and m.user_id=u) and display_name=(select m.display_name from public.processing_mill_members m where m.workspace_id=w and m.user_id=u)) then raise exception 'A current invitation is required'; end if;
  update public.processing_mill_members set status='active' where workspace_id=w and user_id=u and status='pending';
  if not found then raise exception 'Pending staff request not found'; end if;
 elsif a='remove_member' then
  update public.processing_mill_members set status='revoked' where workspace_id=w and user_id=(p->>'user_id')::uuid;
  update stratum_processing_team.invites set revoked=true where workspace_id=w and claimed_by=(p->>'user_id')::uuid;
 elsif a='revoke_invite' then
  update stratum_processing_team.invites set revoked=true where workspace_id=w and id=(p->>'id')::uuid;
  if not found then raise exception 'Invitation not found'; end if;
 else raise exception 'Unknown team action'; end if;
 return jsonb_build_object('ok',true);
end; $$;

create function stratum_processing_team.board(w uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare r text;
begin
 r:=stratum_processing_team.role_for(w);
 if r is null then raise exception 'Mill access required' using errcode='42501'; end if;
 return jsonb_build_object('role',r,'counts',coalesce((select jsonb_object_agg(workflow_status,n) from(select workflow_status,count(*) n from public.processing_director_batches where workspace_id=w group by workflow_status) q),'{}'),
 'batches',coalesce((select jsonb_agg(to_jsonb(x)) from(select * from public.processing_director_batches where workspace_id=w order by updated_at desc,id limit 50) x),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(x)) from(select * from public.processing_mill_events where workspace_id=w order by recorded_at desc,id limit 50) x),'[]'),
 'members',case when r='director' then coalesce((select jsonb_agg(to_jsonb(x)) from public.processing_mill_members x where workspace_id=w),'[]'::jsonb) else '[]'::jsonb end,
 'invites',case when r='director' then coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',display_name,'role',role,'expires_at',expires_at,'claimed',claimed_by is not null,'revoked',revoked)) from stratum_processing_team.invites where workspace_id=w),'[]'::jsonb) else '[]'::jsonb end);
end; $$;

-- Public wrappers run as caller. Private implementations are the sole privileged mutation boundary.
create function public.mill_record_batch(p_workspace uuid,p_action text,p_payload jsonb,p_batch uuid,p_revision integer,p_request uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select stratum_processing_team.record_batch(p_workspace,p_action,p_payload,p_batch,p_revision,p_request) $$;
create function public.mill_team_action(p_workspace uuid,p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select stratum_processing_team.team_action(p_workspace,p_action,p_payload) $$;
create function public.mill_dashboard(p_workspace uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select stratum_processing_team.board(p_workspace) $$;
revoke all on function stratum_processing_team.record_batch(uuid,text,jsonb,uuid,integer,uuid),stratum_processing_team.team_action(uuid,text,jsonb),stratum_processing_team.board(uuid) from public,anon;
revoke all on function public.mill_record_batch(uuid,text,jsonb,uuid,integer,uuid),public.mill_team_action(uuid,text,jsonb),public.mill_dashboard(uuid) from public,anon;
grant execute on function stratum_processing_team.record_batch(uuid,text,jsonb,uuid,integer,uuid),stratum_processing_team.team_action(uuid,text,jsonb),stratum_processing_team.board(uuid) to authenticated;
grant execute on function public.mill_record_batch(uuid,text,jsonb,uuid,integer,uuid),public.mill_team_action(uuid,text,jsonb),public.mill_dashboard(uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='processing_mill_events') then
  alter publication supabase_realtime add table public.processing_mill_events;
 end if;
end $$;
notify pgrst,'reload schema';


-- Supplier contact and bank records stay out of shared batch snapshots and realtime payloads.
create table stratum_processing_team.supplier_details (
 batch_id uuid primary key references public.processing_director_batches(id),workspace_id uuid not null references public.processing_director_workspaces(id),
 phone text check(length(phone)<=40),bank_name text check(length(bank_name)<=100),account_name text check(length(account_name)<=200),account_number text check(length(account_number)<=34),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 check((bank_name is null and account_name is null and account_number is null) or (bank_name is not null and account_name is not null and account_number is not null))
);
alter table stratum_processing_team.supplier_details enable row level security;
revoke all on stratum_processing_team.supplier_details from public,anon,authenticated;
create index processing_supplier_workspace on stratum_processing_team.supplier_details(workspace_id);
create or replace function stratum_processing_team.record_batch(w uuid,a text,p jsonb,b uuid,expected integer,request uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r text; row public.processing_director_batches; previous stratum_processing_team.requests; allowed text[];
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 perform 1 from public.processing_director_workspaces where id=w for update;
 r:=stratum_processing_team.role_for(w);
 if r is null then raise exception 'Mill access required' using errcode='42501'; end if;
 if request is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>20000 then raise exception 'Invalid submission'; end if;
 select * into previous from stratum_processing_team.requests where workspace_id=w and request_id=request;
 if found then
  if previous.actor_id<>auth.uid() or previous.action<>a or previous.payload<>p or (a<>'receive' and previous.batch_id is distinct from b) then raise exception 'Submission ID already used'; end if;
  return (select to_jsonb(x) from public.processing_director_batches x where id=previous.batch_id);
 end if;
 if a='receive' then
  if r not in ('director','receiving','manager') then raise exception 'Receiving role required' using errcode='42501'; end if;
  allowed:=array['batch_code','received_on','claimed_mineral','bag_count','received_weight_kg','supplier','origin','intake_notes','supplier_phone','bank_name','account_name','account_number'];
 else
  select * into row from public.processing_director_batches where id=b and workspace_id=w for update;
  if not found or row.revision is distinct from expected then raise exception 'Batch changed. Refresh before submitting.' using errcode='40001'; end if;
  if a in ('approve','reject') then
   if r not in ('director','manager') or row.workflow_status<>'received' then raise exception 'Manager review is not available for this batch' using errcode='42501'; end if;
   allowed:=array['notes'];
  elsif a='start' then
   if r not in ('director','production') or row.workflow_status<>'approved' then raise exception 'Approved batch and production role required' using errcode='42501'; end if;
   allowed:=array['processing_method','notes'];
  elsif a='finish' then
   if r not in ('director','production') or row.workflow_status<>'processing' then raise exception 'Running batch and production role required' using errcode='42501'; end if;
   allowed:=array['output_bags','output_weight_kg','notes'];
  elsif a='verify' then
   if r not in ('director','supervisor') or row.workflow_status<>'processed' then raise exception 'Supervisor check is not available' using errcode='42501'; end if;
   allowed:=array['notes'];
  elsif a='dispatch' then
   if r not in ('director','dispatch') or row.workflow_status<>'completed' then raise exception 'Checked batch and dispatch role required' using errcode='42501'; end if;
   allowed:=array['notes'];
  elsif a='supplier_update' then
   if r not in ('director','manager','receiving') then raise exception 'Supplier management role required' using errcode='42501'; end if;
   allowed:=array['supplier','supplier_phone','bank_name','account_name','account_number','notes'];
  elsif a='note' then allowed:=array['notes'];
  else raise exception 'Unknown action'; end if;
 end if;
 if exists(select 1 from jsonb_object_keys(p) k where not(k=any(allowed))) then raise exception 'Unexpected fields in submission'; end if;
 if a<>'receive' and length(btrim(coalesce(p->>'notes',''))) not between 1 and 4000 then raise exception 'Add a short record of this step'; end if;
 if a in ('receive','supplier_update') then
  if length(coalesce(p->>'supplier_phone',''))>40 then raise exception 'Phone number is too long'; end if;
  if a='supplier_update' and length(btrim(coalesce(p->>'supplier',''))) not between 1 and 200 then raise exception 'Enter supplier name'; end if;
  if coalesce(nullif(btrim(p->>'bank_name'),''),nullif(btrim(p->>'account_name'),''),nullif(btrim(p->>'account_number'),'')) is not null and (
   length(btrim(coalesce(p->>'bank_name',''))) not between 1 and 100 or length(btrim(coalesce(p->>'account_name',''))) not between 1 and 200 or coalesce(p->>'account_number','') !~ '^[A-Za-z0-9 -]{4,34}$') then raise exception 'Complete bank name, account name and account number, or leave all three blank'; end if;
 end if;
 perform set_config('stratum.mill_action',a,true);
 if a='receive' then
  if coalesce(nullif(p->>'received_on','')::date,current_date)>current_date then raise exception 'Received date cannot be in the future'; end if;
  insert into public.processing_director_batches(workspace_id,batch_code,received_on,claimed_mineral,bag_count,received_weight_kg,supplier,origin,intake_notes)
  values(w,btrim(p->>'batch_code'),coalesce(nullif(p->>'received_on','')::date,current_date),btrim(p->>'claimed_mineral'),nullif(p->>'bag_count','')::integer,nullif(p->>'received_weight_kg','')::numeric,nullif(btrim(p->>'supplier'),''),nullif(btrim(p->>'origin'),''),nullif(btrim(p->>'intake_notes'),'')) returning * into row;
 else
  if a='start' and length(btrim(coalesce(p->>'processing_method',''))) not between 1 and 200 then raise exception 'Enter the processing method'; end if;
  if a='finish' and nullif(p->>'output_bags','') is null and nullif(p->>'output_weight_kg','') is null then raise exception 'Record measured output bags or weight'; end if;
  update public.processing_director_batches set
   supplier=case when a='supplier_update' then btrim(p->>'supplier') else supplier end,
   workflow_status=case a when 'approve' then 'approved' when 'reject' then 'rejected' when 'start' then 'processing' when 'finish' then 'processed' when 'verify' then 'completed' when 'dispatch' then 'dispatched' else workflow_status end,
   processing_method=case when a='start' then btrim(p->>'processing_method') else processing_method end,
   processed_on=case when a='finish' then current_date else processed_on end,
   output_bags=case when a='finish' then nullif(p->>'output_bags','')::integer else output_bags end,
   output_weight_kg=case when a='finish' then nullif(p->>'output_weight_kg','')::numeric else output_weight_kg end,
   processing_notes=p->>'notes' where id=b returning * into row;
 end if;
 if a in ('receive','supplier_update') then
  insert into stratum_processing_team.supplier_details(batch_id,workspace_id,phone,bank_name,account_name,account_number,updated_by)
  values(row.id,w,nullif(btrim(p->>'supplier_phone'),''),nullif(btrim(p->>'bank_name'),''),nullif(btrim(p->>'account_name'),''),nullif(btrim(p->>'account_number'),''),auth.uid())
  on conflict(batch_id) do update set phone=excluded.phone,bank_name=excluded.bank_name,account_name=excluded.account_name,account_number=excluded.account_number,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 end if;
 insert into stratum_processing_team.requests values(w,request,auth.uid(),a,p,row.id);
 perform set_config('stratum.mill_action','',true);
 return to_jsonb(row);
end; $$;

create function stratum_processing_team.suppliers(w uuid,off integer,lim integer,b uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare r text;
begin
 r:=stratum_processing_team.role_for(w);
 if r is null then raise exception 'Mill access required' using errcode='42501'; end if;
 if off is null or off<0 or lim is null or lim<1 or lim>50 then raise exception 'Invalid page'; end if;
 return jsonb_build_object('total',(select count(*) from public.processing_director_batches where workspace_id=w and (b is null or id=b)),
 'items',coalesce((select jsonb_agg(q.row) from (
 select jsonb_build_object('batch_id',x.id,'batch_code',x.batch_code,'revision',x.revision,'supplier',x.supplier,'material',x.claimed_mineral,'origin',x.origin,'bag_count',x.bag_count,'received_weight_kg',x.received_weight_kg,'received_on',x.received_on,'phone',d.phone,'account_details',case when r in ('director','manager','receiving') then jsonb_build_object('bank_name',d.bank_name,'account_name',d.account_name,'account_number',d.account_number) else null end) as row
 from public.processing_director_batches x left join stratum_processing_team.supplier_details d on d.batch_id=x.id and d.workspace_id=w
 where x.workspace_id=w and (b is null or x.id=b) order by x.updated_at desc,x.id offset off limit lim) q),'[]'::jsonb));
end; $$;
create function public.mill_suppliers(p_workspace uuid,p_offset integer,p_limit integer,p_batch uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$select stratum_processing_team.suppliers(p_workspace,p_offset,p_limit,p_batch)$$;
revoke all on function stratum_processing_team.suppliers(uuid,integer,integer,uuid),public.mill_suppliers(uuid,integer,integer,uuid) from public,anon;
grant execute on function stratum_processing_team.suppliers(uuid,integer,integer,uuid),public.mill_suppliers(uuid,integer,integer,uuid) to authenticated;
notify pgrst,'reload schema';

