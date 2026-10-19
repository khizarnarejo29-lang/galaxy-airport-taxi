-- Galaxy Airport Taxi: bookings and quote requests, for MySQL 8 / MariaDB 10.5+ (e.g. Hostinger).
--
-- Run once, by hand: Hostinger hPanel -> Databases -> phpMyAdmin -> choose the database ->
-- SQL tab -> paste this whole file -> Go. It only creates the two tables; it changes nothing else.
-- Times are stored in UTC.

CREATE TABLE IF NOT EXISTS bookings (
  reference              VARCHAR(10)  NOT NULL PRIMARY KEY,
  status                 VARCHAR(12)  NOT NULL,
  trip_type              VARCHAR(8)   NOT NULL,
  vehicle_id             VARCHAR(12)  NOT NULL,
  pickup_at              DATETIME     NOT NULL,
  return_pickup_at       DATETIME     NULL,
  total_pence            INT          NOT NULL,
  pricing_version        VARCHAR(40)  NOT NULL,
  reference_fare_id      VARCHAR(120) NULL,
  reference_total_pence  INT          NULL,
  payment_status         VARCHAR(10)  NOT NULL,
  customer_name          VARCHAR(100) NOT NULL,
  customer_email         VARCHAR(200) NOT NULL,
  customer_phone         VARCHAR(30)  NOT NULL,
  review_flags           JSON         NOT NULL,
  -- The full booking as the website created it. Never contains card details.
  booking                JSON         NOT NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bookings_status CHECK (status IN ('received', 'confirmed', 'completed', 'cancelled')),
  CONSTRAINT bookings_trip_type CHECK (trip_type IN ('one_way', 'return')),
  CONSTRAINT bookings_payment CHECK (payment_status IN ('unpaid', 'paid', 'invoiced')),
  CONSTRAINT bookings_total CHECK (total_pence > 0),
  INDEX bookings_created_at_idx (created_at),
  INDEX bookings_pickup_at_idx (pickup_at)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS quote_requests (
  id               CHAR(36)     NOT NULL PRIMARY KEY,
  status           VARCHAR(12)  NOT NULL DEFAULT 'new',
  customer_name    VARCHAR(100) NOT NULL,
  customer_phone   VARCHAR(30)  NOT NULL,
  customer_email   VARCHAR(200) NULL,
  journey_kind     VARCHAR(20)  NOT NULL,
  airport          VARCHAR(3)   NULL,
  trip_type        VARCHAR(8)   NOT NULL,
  pickup_at        DATETIME     NOT NULL,
  pickup_postcode  VARCHAR(10)  NULL,
  dropoff_postcode VARCHAR(10)  NULL,
  reason           VARCHAR(60)  NOT NULL,
  journey          JSON         NOT NULL,
  message          TEXT         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX quote_requests_created_at_idx (created_at)
) DEFAULT CHARSET = utf8mb4;
