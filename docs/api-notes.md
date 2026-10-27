# Open-Meteo API Notes

Both endpoints are free and need no API key. The fields below were taken from real responses fetched on 2026-10-27.

## 1. Geocoding

`GET https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1`

Turns a city name into coordinates.

| JSON field | Type | Stored as |
|---|---|---|
| `results[0].name` | string | `city` |
| `results[0].country` | string | `country` |
| `results[0].latitude` | number | `latitude` |
| `results[0].longitude` | number | `longitude` |

Example response for `Pune` (trimmed):

```json
{
  "results": [
    {
      "id": 1259229,
      "name": "Pune",
      "latitude": 18.51957,
      "longitude": 73.85535,
      "country_code": "IN",
      "country": "India",
      "admin1": "Maharashtra",
      "timezone": "Asia/Kolkata"
    }
  ],
  "generationtime_ms": 0.15
}
```

**Unknown city:** the response has **no `results` key** at all (for example `{"generationtime_ms":0.047}`), so check that `results` exists and is not empty.

## 2. Current weather

`GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`

| JSON field | Unit | Stored as |
|---|---|---|
| `current.temperature_2m` | °C | `temperature_c` |
| `current.relative_humidity_2m` | % | `humidity` |
| `current.wind_speed_10m` | km/h (the default unit, so no conversion is needed) | `wind_kmh` |
| `current.weather_code` | WMO code | `weather_code`, and mapped to `condition` |

Example response for Pune (trimmed):

```json
{
  "latitude": 18.523726,
  "longitude": 73.86876,
  "timezone": "GMT",
  "current_units": {
    "temperature_2m": "°C",
    "relative_humidity_2m": "%",
    "wind_speed_10m": "km/h",
    "weather_code": "wmo code"
  },
  "current": {
    "time": "2026-10-27T15:00",
    "interval": 900,
    "temperature_2m": 26.9,
    "relative_humidity_2m": 29,
    "wind_speed_10m": 14.7,
    "weather_code": 3
  }
}
```

## WMO weather codes → `condition`

| Codes | Condition |
|---|---|
| 0 | clear |
| 1, 2 | partly cloudy |
| 3 | cloudy |
| 45, 48 | fog |
| 51–57 | drizzle |
| 61–67, 80–82 | rain |
| 71–77, 85, 86 | snow |
| 95–99 | thunderstorm |
