create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key
        references auth.users(id)
        on delete cascade,

    login_id text unique not null
        check (
            login_id ~
            '^[a-z0-9_]{4,20}$'
        ),

    display_name text unique not null
        check (
            char_length(display_name)
            between 3 and 16
        ),

    role text not null
        default 'PLAYER'
        check (
            role in (
                'PLAYER',
                'MODERATOR',
                'ADMIN'
            )
        ),

    selected_rank text not null
        default 'PLAYER',

    created_at timestamptz not null
        default now()
);

alter table public.profiles
    add column if not exists
    selected_rank text not null
    default 'PLAYER';

create or replace function
public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    requested_login_id text;
    requested_display_name text;
begin
    requested_login_id :=
        lower(
            trim(
                new.raw_user_meta_data
                    ->> 'login_id'
            )
        );

    requested_display_name :=
        trim(
            new.raw_user_meta_data
                ->> 'display_name'
        );

    if requested_login_id is null
       or requested_login_id = '' then
        raise exception
            'Login ID is missing';
    end if;

    if requested_display_name is null
       or requested_display_name = '' then
        raise exception
            'Display name is missing';
    end if;

    insert into public.profiles (
        id,
        login_id,
        display_name,
        role,
        selected_rank
    )
    values (
        new.id,
        requested_login_id,
        requested_display_name,
        'PLAYER',
        'PLAYER'
    )
    on conflict (id)
    do update set
        login_id =
            excluded.login_id,

        display_name =
            excluded.display_name;

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

insert into public.profiles (
    id,
    login_id,
    display_name,
    role,
    selected_rank
)
select
    auth_users.id,

    lower(
        trim(
            auth_users.raw_user_meta_data
                ->> 'login_id'
        )
    ),

    trim(
        auth_users.raw_user_meta_data
            ->> 'display_name'
    ),

    'PLAYER',
    'PLAYER'

from auth.users as auth_users

where
    auth_users.raw_user_meta_data
        ->> 'login_id'
        is not null

    and auth_users.raw_user_meta_data
        ->> 'display_name'
        is not null

    and not exists (
        select 1
        from public.profiles
        where profiles.id =
            auth_users.id
    )

on conflict do nothing;

alter table public.profiles
enable row level security;

drop policy if exists
"profiles readable by signed users"
on public.profiles;

drop policy if exists
"Authenticated users can read profiles"
on public.profiles;

create policy
"Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists
"own profile update"
on public.profiles;

drop policy if exists
"Users can update their own profile"
on public.profiles;

create policy
"Users can update their own profile"
on public.profiles
for update
to authenticated
using (
    id = auth.uid()
)
with check (
    id = auth.uid()
);

grant select
on public.profiles
to authenticated;

grant update (
    display_name,
    selected_rank
)
on public.profiles
to authenticated;
