// Weather dashboard server: JSON API + static page, using Node's built-in http module.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getWeatherForCity, CityNotFoundError, WeatherApiError } from './weather.js';
import { insertLog, listLogs, citySummary } from './db.js';

const PORT = Number(process.env.PORT) || 3000;
const INDEX_PATH = fileURLToPath(new URL('../public/index.html', import.meta.url));

// Send a JSON response with the given status code.
function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// POST /api/refresh?city=NAME: fetch current weather for a city and save it.
async function handleRefresh(url, res) {
  const city = url.searchParams.get('city')?.trim();
  if (!city) return sendJson(res, 400, { error: 'Please provide a city, e.g. /api/refresh?city=London' });
  try {
    const log = insertLog(await getWeatherForCity(city));
    sendJson(res, 201, log);
  } catch (err) {
    if (err instanceof CityNotFoundError) return sendJson(res, 404, { error: err.message });
    if (err instanceof WeatherApiError) return sendJson(res, 502, { error: err.message });
    throw err;
  }
}

// Route a request to the matching API endpoint or the dashboard page.
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const key = `${req.method} ${url.pathname}`;

  if (key === 'GET /api/logs') return sendJson(res, 200, listLogs(50));
  if (key === 'GET /api/summary') return sendJson(res, 200, citySummary());
  if (key === 'POST /api/refresh') return handleRefresh(url, res);
  if (key === 'GET /' || key === 'GET /index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(await readFile(INDEX_PATH));
  }
  sendJson(res, 404, { error: `Not found: ${req.method} ${url.pathname}` });
}

const server = createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error(`Request failed: ${err.message}`);
    if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong on the server.' });
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: PORT=3001 npm start`);
  } else {
    console.error(`Server error: ${err.message}`);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Weather dashboard running at http://localhost:${PORT}`);
});
