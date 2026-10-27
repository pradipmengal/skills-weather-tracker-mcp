#!/usr/bin/env node
// Weather Tracker CLI: add, list, and stats commands.
import { getWeatherForCity, CityNotFoundError, WeatherApiError } from './weather.js';
import { insertLog, listLogs, cityStats, closeDb } from './db.js';

const USAGE = `Usage:
  node src/cli.js add "<city>"        Fetch current weather for a city and save it
  node src/cli.js list [--limit N]    Show recent logs (default 10)
  node src/cli.js stats "<city>"      Show min/max/avg temperature for a city`;

// Format a number to one decimal place, or "-" when missing.
function fmt(value, suffix = '') {
  return value == null ? '-' : `${Number(value).toFixed(1)}${suffix}`;
}

// Print rows as an aligned text table with the given column definitions.
function printTable(columns, rows) {
  const cells = rows.map((row) => columns.map((c) => String(c.value(row))));
  const widths = columns.map((c, i) => Math.max(c.label.length, ...cells.map((r) => r[i].length)));
  const line = (values) => values.map((v, i) => v.padEnd(widths[i])).join('  ');
  console.log(line(columns.map((c) => c.label)));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  cells.forEach((r) => console.log(line(r)));
}

// `add <city>`: fetch weather for a city and store it.
async function addCommand(city) {
  if (!city) throw new UsageError('Please provide a city, e.g. node src/cli.js add "London"');
  const log = insertLog(await getWeatherForCity(city));
  console.log(
    `Saved: ${log.city}${log.country ? `, ${log.country}` : ''} — ${fmt(log.temperature_c, '°C')}, ` +
      `${log.condition}, humidity ${log.humidity}%, wind ${fmt(log.wind_kmh, ' km/h')}`
  );
}

// `list [--limit N]`: print recent logs as a table.
function listCommand(args) {
  let limit = 10;
  const i = args.indexOf('--limit');
  if (i !== -1) {
    limit = Number.parseInt(args[i + 1], 10);
    if (!Number.isInteger(limit) || limit < 1) throw new UsageError('--limit must be a positive whole number.');
  }
  const logs = listLogs(limit);
  if (logs.length === 0) {
    console.log('No weather logs yet. Add one with: node src/cli.js add "London"');
    return;
  }
  printTable(
    [
      { label: 'ID', value: (r) => r.id },
      { label: 'City', value: (r) => r.city },
      { label: 'Country', value: (r) => r.country ?? '-' },
      { label: 'Temp', value: (r) => fmt(r.temperature_c, '°C') },
      { label: 'Humidity', value: (r) => (r.humidity == null ? '-' : `${r.humidity}%`) },
      { label: 'Wind', value: (r) => fmt(r.wind_kmh, ' km/h') },
      { label: 'Condition', value: (r) => r.condition ?? '-' },
      { label: 'Logged (UTC)', value: (r) => r.created_at },
    ],
    logs
  );
}

// `stats <city>`: print temperature statistics for one city.
function statsCommand(city) {
  if (!city) throw new UsageError('Please provide a city, e.g. node src/cli.js stats "London"');
  const s = cityStats(city);
  if (!s || s.count === 0) {
    console.log(`No logs found for "${city}". Add one with: node src/cli.js add "${city}"`);
    return;
  }
  console.log(`Stats for ${s.city}`);
  console.log(`  Logs:    ${s.count}`);
  console.log(`  Min:     ${fmt(s.min_c, '°C')}`);
  console.log(`  Max:     ${fmt(s.max_c, '°C')}`);
  console.log(`  Average: ${fmt(s.avg_c, '°C')}`);
}

// Error for bad command-line input; printed with the usage text.
class UsageError extends Error {}

// Dispatch to the requested command and print friendly errors instead of stack traces.
async function main() {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'add') await addCommand(args.join(' ').trim());
    else if (command === 'list') listCommand(args);
    else if (command === 'stats') statsCommand(args.join(' ').trim());
    else {
      console.log(USAGE);
      if (command) process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof CityNotFoundError || err instanceof WeatherApiError) {
      console.error(`Error: ${err.message}`);
    } else if (err instanceof UsageError) {
      console.error(`Error: ${err.message}\n\n${USAGE}`);
    } else {
      console.error(`Something went wrong: ${err.message}`);
    }
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}

main();
