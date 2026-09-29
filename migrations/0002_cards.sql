create table if not exists cards (
  uid text primary key,
  name text not null,
  member_id text not null unique,
  role text not null default 'Member',
  session text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
