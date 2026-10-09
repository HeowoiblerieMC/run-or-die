 RUN FOR LIVE REBUILD V2
-- Run this after the earlier schema, or on a fresh Supabase project.

alter table public.profiles
    add column if not exists selected_rank text not null default 'PLAYER';

create table if not exists public.entities (
    id text primary key,
    entity_type text not null check (entity_type in ('PLAYER','NPC')),
    user_id uuid unique references public.profiles(id) on delete cascade,
    display_name text unique not null,
    role text not null default 'PLAYER',
    selected_rank text not null default 'PLAYER',
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.entity_economies (
    entity_id text primary key references public.entities(id) on delete cascade,
    coins bigint not null default 0 check (coins >= 0),
    owned_chat_ranks text[] not null default array['PLAYER']::text[],
    champion_expires_at timestamptz,
    last_npc_gift_at timestamptz,
    updated_at timestamptz not null default now()
);

create table if not exists public.entity_stats (
    entity_id text primary key references public.entities(id) on delete cascade,
    wins bigint not null default 0 check (wins >= 0),
    captures bigint not null default 0 check (captures >= 0),
    escapes bigint not null default 0 check (escapes >= 0),
    rank_gifts_sent bigint not null default 0 check (rank_gifts_sent >= 0),
    updated_at timestamptz not null default now()
);

create table if not exists public.rank_gifts (
    id uuid primary key default gen_random_uuid(),
    sender_entity_id text not null references public.entities(id),
    recipient_entity_id text not null references public.entities(id),
    rank_id text not null,
    price bigint not null check (price >= 0),
    counts_for_leaderboard boolean not null default true,
    created_at timestamptz not null default now(),
    check (sender_entity_id <> recipient_entity_id)
);

create table if not exists public.moderation_actions (
    id uuid primary key default gen_random_uuid(),
    target_entity_id text not null references public.entities(id),
    moderator_user_id uuid not null references public.profiles(id),
    action_type text not null check (action_type in ('WARN','MUTE','BAN','NPC_DISABLE')),
    reason text not null,
    starts_at timestamptz not null default now(),
    expires_at timestamptz,
    revoked_at timestamptz,
    revoked_by uuid references public.profiles(id),
    created_at timestamptz not null default now()
);

create or replace function public.sync_profile_entity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.entities(id,entity_type,user_id,display_name,role,selected_rank)
    values('player_' || new.id::text,'PLAYER',new.id,new.display_name,new.role,new.selected_rank)
    on conflict(user_id) do update set
        display_name=excluded.display_name,
        role=excluded.role,
        selected_rank=excluded.selected_rank;
    insert into public.entity_economies(entity_id)
    values('player_' || new.id::text)
    on conflict do nothing;
    insert into public.entity_stats(entity_id)
    values('player_' || new.id::text)
    on conflict do nothing;
    return new;
end;
$$;

drop trigger if exists sync_profile_entity_trigger on public.profiles;
create trigger sync_profile_entity_trigger
after insert or update on public.profiles
for each row execute function public.sync_profile_entity();

create or replace function public.get_leaderboard(p_category text,p_limit integer,p_viewer uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    entries jsonb;
    viewer jsonb;
    viewer_entity text;
begin
    if p_category not in ('wins','captures','escapes','rank_gifts_sent') then
        raise exception 'Invalid leaderboard category';
    end if;
    if p_limit < 1 or p_limit > 10 then raise exception 'Invalid leaderboard limit'; end if;

    execute format($q$
        select coalesce(jsonb_agg(row_data order by position),'[]'::jsonb)
        from (
            select row_number() over(order by %I desc,e.display_name asc) as position,
                   e.id,e.display_name,e.role,e.selected_rank,s.%I as value
            from entity_stats s join entities e on e.id=s.entity_id
            where e.active=true
            order by s.%I desc,e.display_name asc
            limit $1
        ) row_data
    $q$,p_category,p_category,p_category) into entries using p_limit;

    if p_viewer is not null then
        viewer_entity := 'player_' || p_viewer::text;
        execute format($q$
            select to_jsonb(v) from (
                select value,position from (
                    select e.id,s.%I as value,
                           row_number() over(order by s.%I desc,e.display_name asc) as position
                    from entity_stats s join entities e on e.id=s.entity_id
                    where e.active=true
                ) ranked where id=$1
            ) v
        $q$,p_category,p_category) into viewer using viewer_entity;
    end if;

    return jsonb_build_object('entries',entries,'viewer',viewer);
end;
$$;

create or replace function public.gift_rank(p_target text,p_rank_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    sender_id text := 'player_' || auth.uid()::text;
    target_id text;
    price bigint;
    balance bigint;
begin
    select id into target_id from entities
    where lower(display_name)=lower(p_target) or lower(id)=lower(p_target)
    limit 1;
    if target_id is null then raise exception 'Target was not found'; end if;
    if target_id=sender_id then raise exception 'You cannot gift yourself'; end if;

    price := case upper(p_rank_id)
        when 'PLUS' then 5000 when 'GOOD' then 15000 when 'GOOD_PLUS' then 35000
        when 'VIP' then 75000 when 'VIP_PLUS' then 150000
        when 'MVP' then 300000 when 'MVP_PLUS' then 600000
        when 'PRO' then 1000000 when 'PRO_PLUS' then 1750000
        when 'KING' then 3000000 when 'CHAMPION' then 30000
        else null end;
    if price is null then raise exception 'Unknown rank'; end if;

    select coins into balance from entity_economies where entity_id=sender_id for update;
    if balance < price then raise exception 'Not enough Coins'; end if;

    update entity_economies set coins=coins-price,updated_at=now() where entity_id=sender_id;
    update entity_economies
    set owned_chat_ranks=array_append(owned_chat_ranks,upper(p_rank_id)),updated_at=now()
    where entity_id=target_id and not upper(p_rank_id)=any(owned_chat_ranks);
    if not found then raise exception 'Target already owns this rank'; end if;

    update entities set selected_rank=upper(p_rank_id) where id=target_id;
    update entity_stats set rank_gifts_sent=rank_gifts_sent+1,updated_at=now() where entity_id=sender_id;
    insert into rank_gifts(sender_entity_id,recipient_entity_id,rank_id,price)
    values(sender_id,target_id,upper(p_rank_id),price);

    return jsonb_build_object('ok',true,'target',target_id,'rank',upper(p_rank_id),'price',price);
end;
$$;

alter table public.entities enable row level security;
alter table public.entity_economies enable row level security;
alter table public.entity_stats enable row level security;
alter table public.rank_gifts enable row level security;
alter table public.moderation_actions enable row level security;

create policy "entities readable" on public.entities for select to authenticated using(true);
create policy "stats readable" on public.entity_stats for select to authenticated using(true);
create policy "own economy readable" on public.entity_economies for select to authenticated
using(entity_id='player_' || auth.uid()::text);
create policy "gift participants read" on public.rank_gifts for select to authenticated
using(sender_entity_id='player_' || auth.uid()::text or recipient_entity_id='player_' || auth.uid()::text);

grant select on public.entities,public.entity_stats to authenticated;
grant select on public.entity_economies,public.rank_gifts to authenticated;
grant execute on function public.get_leaderboard(text,integer,uuid) to authenticated,anon;
grant execute on function public.gift_rank(text,text) to authenticated;

-- Seed a small NPC roster. Add the remaining names later with a migration.
insert into public.entities(id,entity_type,display_name,role,selected_rank) values
('npc_0001','NPC','Alice','PLAYER','VIP_PLUS'),
('npc_0002','NPC','Alex','PLAYER','PLAYER'),
('npc_0003','NPC','Olivia','PLAYER','MVP_PLUS'),
('npc_0004','NPC','Ethan','PLAYER','MVP'),
('npc_0005','NPC','Ruby','PLAYER','GOOD_PLUS'),
('npc_0006','NPC','Mason','PLAYER','KING'),
('npc_0007','NPC','Grace','PLAYER','VIP'),
('npc_0008','NPC','Liam','PLAYER','PLAYER')
on conflict do nothing;

insert into public.entity_economies(entity_id,coins)
select id,50000 + floor(random()*250000)::bigint from public.entities
where entity_type='NPC' on conflict do nothing;

insert into public.entity_stats(entity_id,wins,captures,escapes,rank_gifts_sent)
select id,
       floor(random()*350)::bigint,
       floor(random()*430)::bigint,
       floor(random()*220)::bigint,
       floor(random()*30)::bigint
from public.entities where entity_type='NPC'
on conflict do nothing;
