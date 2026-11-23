create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- First account becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created_first_admin
  after insert on auth.users for each row execute function public.handle_first_admin();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

-- Settings (single row)
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  brand_name text not null default 'Radar das Ofertas',
  min_discount int not null default 20,
  min_sales int not null default 100,
  min_rating numeric(3,2) not null default 4.5,
  min_price numeric(10,2) not null default 15,
  max_price numeric(10,2) not null default 500,
  keywords text[] not null default array['cozinha','casa','fone bluetooth','beleza','infantil','ferramentas'],
  daily_target int not null default 25,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "Admins manage settings" on public.app_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();
insert into public.app_settings (id) values (1);

-- Offers
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual' check (source in ('shopee','mercadolivre','manual')),
  external_id text,
  title text not null,
  image_url text,
  original_price numeric(12,2),
  price numeric(12,2) not null,
  discount_pct int not null default 0,
  sales int,
  rating numeric(3,2),
  commission_rate numeric(6,4),
  shop_name text,
  product_url text,
  affiliate_url text,
  coupon text,
  score numeric(6,2) not null default 0,
  price_flag text,
  keyword text,
  status text not null default 'new' check (status in ('new','approved','posted','rejected')),
  caption text,
  banner_url text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
create index offers_status_score_idx on public.offers (status, score desc);
grant select, insert, update, delete on public.offers to authenticated;
grant all on public.offers to service_role;
alter table public.offers enable row level security;
create policy "Admins manage offers" on public.offers for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger offers_touch before update on public.offers for each row execute function public.touch_updated_at();

-- Price history
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  price numeric(12,2) not null,
  captured_at timestamptz not null default now()
);
create index price_history_item_idx on public.price_history (source, external_id, captured_at desc);
grant select, insert, delete on public.price_history to authenticated;
grant all on public.price_history to service_role;
alter table public.price_history enable row level security;
create policy "Admins manage price history" on public.price_history for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Destinations
create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'telegram' check (platform in ('telegram','whatsapp')),
  chat_id text not null,
  title text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (platform, chat_id)
);
grant select, insert, update, delete on public.destinations to authenticated;
grant all on public.destinations to service_role;
alter table public.destinations enable row level security;
create policy "Admins manage destinations" on public.destinations for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  destination_id uuid references public.destinations(id) on delete set null,
  status text not null check (status in ('sent','failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
grant select, insert, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "Admins manage posts" on public.posts for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
