// Open-Meteo client: geocoding + current weather (no API key needed).

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 10000;

// Thrown when geocoding returns no match for the requested city.
export class CityNotFoundError extends Error {
  constructor(city) {
    super(`City "${city}" was not found. Check the spelling and try again.`);
    this.name = 'CityNotFoundError';
  }
}

// Thrown when Open-Meteo can't be reached or returns an unexpected response.
export class WeatherApiError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WeatherApiError';
  }
}

// Fetch a URL and parse JSON, turning network and HTTP failures into WeatherApiError.
async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new WeatherApiError('Could not reach the weather service. Check your internet connection and try again.');
  }
  if (!res.ok) {
    throw new WeatherApiError(`The weather service responded with HTTP ${res.status}. Please try again later.`);
  }
  try {
    return await res.json();
  } catch {
    throw new WeatherApiError('The weather service returned an invalid response.');
  }
}

// Map a WMO weather code to a short readable condition.
export function describeWeatherCode(code) {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'unknown';
}

// Look up a city's name, country, and coordinates. The API omits `results` when nothing matches.
export async function geocodeCity(city) {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1`;
  const data = await getJson(url);
  const match = data.results?.[0];
  if (!match) throw new CityNotFoundError(city);
  return {
    city: match.name,
    country: match.country ?? null,
    latitude: match.latitude,
    longitude: match.longitude,
  };
}

// Fetch current temperature, humidity, wind, and weather code for coordinates.
export async function fetchCurrentWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
  });
  const data = await getJson(`${FORECAST_URL}?${params}`);
  const current = data.current;
  if (!current) throw new WeatherApiError('The weather service returned no current conditions.');
  return {
    temperature_c: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    wind_kmh: current.wind_speed_10m,
    weather_code: current.weather_code,
    condition: describeWeatherCode(current.weather_code),
  };
}

// Geocode a city and fetch its current weather as one record ready to store.
export async function getWeatherForCity(city) {
  const place = await geocodeCity(city);
  const weather = await fetchCurrentWeather(place.latitude, place.longitude);
  return { ...place, ...weather };
}
