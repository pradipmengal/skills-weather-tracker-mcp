# Data Verification Report: `weather_logs`

**Date:** 2026-10-27
**Database:** `weather.db` (local and git-ignored, so these results describe the development database)
**Method:** read-only SQL run directly against `weather.db`, bypassing the app's own `src/db.js`. This plays the role of the SQLite MCP server: an independent check of what the CLI and the web server actually wrote.

## Schema check

| Object | Type |
|---|---|
| `weather_logs` | table |
| `idx_weather_logs_city_created_at` | index on `(city, created_at)` |

The columns match [`db/schema.sql`](../db/schema.sql).

## Summary by city

```sql
SELECT city, country, COUNT(*) AS rows, ROUND(AVG(temperature_c), 2) AS avg_temp_c
FROM weather_logs GROUP BY city ORDER BY city;
```

| City | Country | Rows | Avg temp (°C) |
|---|---|---|---|
| London | United Kingdom | 2 | 15.5 |
| Mumbai | India | 2 | 31.2 |
| Pune | India | 2 | 26.9 |
| Tokyo | Japan | 2 | 17.0 |
| **Total** | | **8** | |

## Where each row came from

| IDs | City | Source |
|---|---|---|
| 1 | Pune | Seed row inserted while designing the schema (Step 2) |
| 2, 3 | London, Tokyo | CLI: `node src/cli.js add "London"` and `add "Tokyo"` |
| 4, 5 | Mumbai | Web: `POST /api/refresh?city=Mumbai`, the endpoint the dashboard's **Add / Refresh** button calls |
| 6, 7, 8 | London, Pune, Tokyo | Web: `POST /api/refresh` |

✅ Rows from both the CLI and the web endpoint are present, and the stored city and country names are the canonical names returned by geocoding.

## Anomaly checks

| Check | Result |
|---|---|
| NULLs in any column (`country`, `latitude`, `longitude`, `temperature_c`, `humidity`, `wind_kmh`, `condition`, `weather_code`, `created_at`) | ✅ 0 |
| Values out of range (temperature outside −90 to 60 °C, humidity outside 0 to 100 %, wind below 0) | ✅ 0 |
| `condition` matches `weather_code` (0 → clear, 1 → partly cloudy, 3 → cloudy) | ✅ consistent |
| Duplicate `created_at` for the same city | ⚠️ **1 found**: Mumbai, ids 4 and 5, both at `2026-10-27 15:08:57` |

## Findings

1. **Duplicate timestamp (Mumbai, ids 4 and 5).** Two refresh requests in the same second produced two identical rows. `created_at` only has one-second resolution, and nothing stops an immediate repeat refresh. This doesn't break anything, but it skews per-city averages and counts. Possible fixes:
   - Skip the insert when the same city was logged within the last N minutes.
   - Store Open-Meteo's `current.time` and add `UNIQUE(city, observed_at)`.
2. **Repeated readings are expected.** Open-Meteo's `current` block updates every 15 minutes (`"interval": 900`). Refreshing a city more often than that stores the same values again, which is why each city's two rows have identical temperatures.
3. **Timestamps are UTC.** SQLite's `CURRENT_TIMESTAMP` stores UTC without a zone suffix. The dashboard converts to local time for display, and the CLI labels the column "Logged (UTC)".
