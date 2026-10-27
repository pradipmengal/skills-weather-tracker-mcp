// SQLite access for weather_logs via better-sqlite3. All queries are parameterized.
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DB_PATH = process.env.WEATHER_DB ?? fileURLToPath(new URL('../weather.db', import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL('../db/schema.sql', import.meta.url));

let db;

// Open the database once and make sure the schema exists.
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  }
  return db;
}

// Insert one weather record and return it with its id and timestamp.
export function insertLog(log) {
  const stmt = getDb().prepare(`
    INSERT INTO weather_logs
      (city, country, latitude, longitude, temperature_c, humidity, wind_kmh, condition, weather_code)
    VALUES
      (@city, @country, @latitude, @longitude, @temperature_c, @humidity, @wind_kmh, @condition, @weather_code)
  `);
  const { lastInsertRowid } = stmt.run(log);
  return getDb().prepare('SELECT * FROM weather_logs WHERE id = ?').get(lastInsertRowid);
}

// Return the most recent logs, newest first.
export function listLogs(limit = 10) {
  return getDb()
    .prepare('SELECT * FROM weather_logs ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(limit);
}

// Return min/max/avg temperature and log count for a city (case-insensitive).
export function cityStats(city) {
  return getDb()
    .prepare(`
      SELECT MIN(city) AS city,
             COUNT(*) AS count,
             MIN(temperature_c) AS min_c,
             MAX(temperature_c) AS max_c,
             AVG(temperature_c) AS avg_c
      FROM weather_logs
      WHERE city = ? COLLATE NOCASE
    `)
    .get(city);
}

// Return one row per city with its latest reading, average temperature, and log count.
export function citySummary() {
  return getDb()
    .prepare(`
      SELECT w.city,
             w.country,
             COUNT(*) AS count,
             AVG(w.temperature_c) AS avg_c,
             MAX(w.created_at) AS last_logged,
             (SELECT l.temperature_c FROM weather_logs l
               WHERE l.city = w.city ORDER BY l.created_at DESC, l.id DESC LIMIT 1) AS latest_c,
             (SELECT l.condition FROM weather_logs l
               WHERE l.city = w.city ORDER BY l.created_at DESC, l.id DESC LIMIT 1) AS latest_condition
      FROM weather_logs w
      GROUP BY w.city
      ORDER BY w.city
    `)
    .all();
}

// Close the database connection (used by the CLI on exit).
export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
