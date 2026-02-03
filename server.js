const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const storageFile = path.join(__dirname, 'storage.json');

const readStorage = () => {
  try {
    const raw = fs.readFileSync(storageFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    console.error('Failed to read storage:', error);
    return {};
  }
};

const writeStorage = (data) => {
  fs.writeFileSync(storageFile, JSON.stringify(data, null, 2));
};

const serveIndex = (res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to load index.html');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  });
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    serveIndex(res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/storage') {
    const key = url.searchParams.get('key');
    if (!key) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing key parameter.' }));
      return;
    }
    const data = readStorage();
    const value = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ value }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/storage') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!payload.key || typeof payload.value !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload must include key and value.' }));
          return;
        }
        const data = readStorage();
        data[payload.key] = payload.value;
        writeStorage(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Port Committee running at http://localhost:${PORT}`);
});
