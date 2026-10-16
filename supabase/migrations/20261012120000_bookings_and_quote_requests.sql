-- Galaxy Airport Taxi: persistent bookings and quote requests.
--
-- NOT APPLIED. Review, then apply by hand in the Supabase SQL editor.
-- Still pending the owner's decision before go-live: the project's data region,
-- the retention period for bookings and quote requests, and the Privacy Policy wording.
--
-- Access is server-side only, with the secret key. Row Level Security is on with
-- no policies, so the public (anon) and signed-in (authenticated) roles can neither
-- read nor write these tables.

create table public.bookings (
  reference              text primary key check (reference ~ '^GAT-[2-9A-HJKMNP-Z]{6}$'),
  status                 text not null check (status in ('received', 'confirmed', 'completed', 'cancelled')),
  trip_type              text not null check (trip_type in ('one_way', 'return')),
  vehicle_id             text not null check (vehicle_id in ('saloon', 'estate', 'executive', 'mpv', 'minibus')),
  pickup_at              timestamptz not null,
  return_pickup_at       timestamptz,
  total_pence            integer not null check (total_pence > 0),
  pricing_version        text not null,
  reference_fare_id      text,
  reference_total_pence  integer check (reference_total_pence is null or reference_total_pence > 200),
  payment_status         text not null check (payment_status in ('unpaid', 'paid', 'invoiced')),
  customer_name          text not null check (length(customer_name) between 1 and 100),
  customer_email         text not null check (length(customer_email) between 3 and 200),
  customer_phone         text not null check (length(customer_phone) between 7 and 30),
  review_flags           text[] not null default '{}',
  -- The full booking as the website created it. Never contains card details.
  booking                jsonb not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- The stored booking must agree with its key columns.
  constraint bookings_json_matches check (
    booking->>'reference' = reference
    and (booking->>'total')::integer = total_pence
    and booking->>'status' = status
  ),
  -- Galaxy's price is the reference total minus £2.00 when a reference fare was used.
  constraint bookings_reference_fare_price check (
    reference_total_pence is null or total_pence = reference_total_pence - 200
  ),
  -- A return trip has a return pickup; a one-way trip doesn't.
  constraint bookings_return_pickup check (
    (trip_type = 'return') = (return_pickup_at is not null)
  )
);

create index bookings_created_at_idx on public.bookings (created_at desc);
create index bookings_pickup_at_idx on public.bookings (pickup_at);
create index bookings_status_idx on public.bookings (status);
create index bookings_customer_email_idx on public.bookings (lower(customer_email));

create table public.quote_requests (
  id               uuid primary key default gen_random_uuid(),
  status           text not null default 'new' check (status in ('new', 'contacted', 'priced', 'booked', 'closed')),
  customer_name    text not null check (length(customer_name) between 1 and 100),
  customer_phone   text not null check (length(customer_phone) between 7 and 30),
  customer_email   text check (customer_email is null or length(customer_email) between 3 and 200),
  journey_kind     text not null check (journey_kind in ('to_airport', 'from_airport', 'address_to_address')),
  -- The airport the journey uses, if any. Never two: airport-to-airport journeys aren't accepted.
  airport          text check (airport is null or airport in ('LHR', 'LGW', 'STN', 'LTN', 'LCY')),
  trip_type        text not null check (trip_type in ('one_way', 'return')),
  pickup_at        timestamptz not null,
  pickup_postcode  text,
  dropoff_postcode text,
  -- Why no instant price was available.
  reason           text not null,
  -- The journey as the customer entered it. Never a price.
  journey          jsonb not null,
  message          text check (message is null or length(message) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- An airport journey names its airport; an address-to-address journey has none.
  constraint quote_requests_airport_kind check ((journey_kind = 'address_to_address') = (airport is null))
  -- Deliberately no price columns: a quote request never carries an amount.
);

create index quote_requests_created_at_idx on public.quote_requests (created_at desc);
create index quote_requests_status_idx on public.quote_requests (status);

-- Keep updated_at current.
create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
create trigger quote_requests_set_updated_at before update on public.quote_requests
  for each row execute function public.set_updated_at();

-- Row Level Security on, with no policies: only the server's secret key can access these tables.
alter table public.bookings enable row level security;
alter table public.quote_requests enable row level security;
revoke all on table public.bookings from anon, authenticated;
revoke all on table public.quote_requests from anon, authenticated;
revoke all on function public.set_updated_at() from anon, authenticated;
