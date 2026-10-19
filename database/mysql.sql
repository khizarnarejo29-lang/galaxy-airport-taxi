-- Galaxy Airport Taxi: bookings and quote requests, for MySQL / MariaDB (e.g. Hostinger).
-- Plain column types only, so it runs on any version; the website checks the values.
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
  review_flags           LONGTEXT     NOT NULL,
  -- The full booking as the website created it. Never contains card details.
  booking                LONGTEXT     NOT NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  journey          LONGTEXT     NOT NULL,
  message          TEXT         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET = utf8mb4;
