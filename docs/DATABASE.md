# Booking database (Hostinger MySQL)

Without a database the live site can't save bookings, so the last step of the
calculator offers "Book on WhatsApp" instead. With one, customers book online
and get a booking reference straight away.

## 1. Create the tables (once)

1. Hostinger hPanel → **Databases** → **Management**: note the database name and
   user (they look like `u123456789_galaxy`). Keep the password private.
2. Next to the database, open **phpMyAdmin**.
3. Choose the database on the left, open the **SQL** tab, paste the whole of
   `database/mysql.sql` and press **Go**. It creates two tables, `bookings` and
   `quote_requests`, and changes nothing else.

## 2. Tell the website how to connect

In hPanel, open the website's Node.js app settings → **Environment variables**
and add (never put these in the code or in chat):

| Variable | Value |
| --- | --- |
| `MYSQL_HOST` | Shown on the database page, often `localhost` or an address like `srv123.hstgr.io` |
| `MYSQL_PORT` | `3306` (can be left out) |
| `MYSQL_DATABASE` | The database name |
| `MYSQL_USER` | The database user |
| `MYSQL_PASSWORD` | The database user's password |

Restart the app. The calculator's last button changes from "Book on WhatsApp"
back to "Confirm booking".

## 3. Check

Make a test booking. In phpMyAdmin, the `bookings` table should have a new row
with its reference. Delete the test row afterwards if you like.
