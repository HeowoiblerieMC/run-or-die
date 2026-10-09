create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key
        references auth.users(id)
        on delete cascade,

    login_id text unique not null,

    display_name text unique not null,

    role text not null default 'PLAYER',

    selected_rank text not null default 'PLAYER',

    created_at timestamptz not null default now()
);

create table if not exists public.entities (
    id text primary key,

    entity_type text not null,

    display_name text unique not null,

    role text not null default 'PLAYER',

    selected_rank text not null default 'PLAYER',

    active boolean not null default true
);

create table if not exists public.entity_stats (
    entity_id text primary key
        references public.entities(id)
        on delete cascade,

    wins bigint not null default 0,

    captures bigint not null default 0,

    escapes bigint not null default 0,

    rank_gifts_sent bigint not null default 0
);

create table if not exists public.rooms (
    id uuid primary key default gen_random_uuid(),

    code text unique not null,

    host_id uuid not null
        references public.profiles(id),

    status text not null default 'LOBBY'
);

create table if not exists public.room_members (
    room_id uuid
        references public.rooms(id)
        on delete cascade,

    user_id uuid
        references public.profiles(id)
        on delete cascade,

    ready boolean not null default false,

    primary key (
        room_id,
        user_id
    )
);

create or replace function
public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (
        id,
        login_id,
        display_name
    )
    values (
        new.id,
        lower(
            new.raw_user_meta_data
                ->> 'login_id'
        ),
        new.raw_user_meta_data
            ->> 'display_name'
    );

    insert into public.entities (
        id,
        entity_type,
        display_name
    )
    values (
        'player_' || new.id::text,
        'PLAYER',
        new.raw_user_meta_data
            ->> 'display_name'
    )
    on conflict do nothing;

    insert into public.entity_stats (
        entity_id
    )
    values (
        'player_' || new.id::text
    )
    on conflict do nothing;

    return new;
end;
$$;

drop trigger if exists
on_auth_user_created
on auth.users;

create trigger
on_auth_user_created
after insert
on auth.users
for each row
execute function
public.handle_new_user();

create or replace function
public.get_leaderboard (
    p_category text,
    p_limit integer,
    p_viewer uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    entries jsonb;
    viewer jsonb;
begin
    if p_category not in (
        'wins',
        'captures',
        'escapes',
        'rank_gifts_sent'
    ) then
        raise exception
            'Invalid category';
    end if;

    execute format(
        '
        select coalesce(
            jsonb_agg(
                leaderboard_row
                order by position
            ),
            ''[]''::jsonb
        )
        from (
            select
                row_number() over (
                    order by
                        stats.%I desc,
                        entity.display_name
                ) as position,

                entity.display_name,
                entity.role,
                entity.selected_rank,
                stats.%I as value

            from public.entity_stats as stats

            join public.entities as entity
            on entity.id = stats.entity_id

            where entity.active = true

            order by
                stats.%I desc,
                entity.display_name

            limit $1
        ) as leaderboard_row
        ',
        p_category,
        p_category,
        p_category
    )
    into entries
    using p_limit;

    if p_viewer is not null then
        execute format(
            '
            select jsonb_build_object(
                ''rank'',
                ranked.position,

                ''value'',
                ranked.value
            )
            from (
                select
                    profile.id,

                    row_number() over (
                        order by
                            stats.%I desc,
                            entity.display_name
                    ) as position,

                    stats.%I as value

                from public.entity_stats as stats

                join public.entities as entity
                on entity.id = stats.entity_id

                join public.profiles as profile
                on entity.id =
                    ''player_'' ||
                    profile.id::text

                where entity.active = true
            ) as ranked

            where ranked.id = $1
            ',
            p_category,
            p_category
        )
        into viewer
        using p_viewer;
    end if;

    return jsonb_build_object(
        'entries',
        entries,

        'viewer',
        viewer
    );
end;
$$;

alter table public.profiles
enable row level security;

alter table public.entities
enable row level security;

alter table public.entity_stats
enable row level security;

alter table public.rooms
enable row level security;

alter table public.room_members
enable row level security;

drop policy if exists
profiles_read
on public.profiles;

create policy profiles_read
on public.profiles
for select
to authenticated
using (true);

drop policy if exists
entities_read
on public.entities;

create policy entities_read
on public.entities
for select
to authenticated
using (true);

drop policy if exists
stats_read
on public.entity_stats;

create policy stats_read
on public.entity_stats
for select
to authenticated
using (true);

drop policy if exists
rooms_read
on public.rooms;

create policy rooms_read
on public.rooms
for select
to authenticated
using (true);

drop policy if exists
rooms_insert
on public.rooms;

create policy rooms_insert
on public.rooms
for insert
to authenticated
with check (
    host_id = auth.uid()
);

drop policy if exists
members_read
on public.room_members;

create policy members_read
on public.room_members
for select
to authenticated
using (true);

drop policy if exists
members_insert
on public.room_members;

create policy members_insert
on public.room_members
for insert
to authenticated
with check (
    user_id = auth.uid()
);

grant select
on public.profiles
to authenticated;

grant select
on public.entities
to authenticated;

grant select
on public.entity_stats
to authenticated;

grant select
on public.rooms
to authenticated;

grant select
on public.room_members
to authenticated;

grant insert
on public.rooms
to authenticated;

grant insert
on public.room_members
to authenticated;

grant execute
on function
public.get_leaderboard(
    text,
    integer,
    uuid
)
to authenticated;
