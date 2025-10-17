// Absolute minimal benchmark - just HTTP + JSON
const http = require('http');

const data = { message: 'Hello, World!', timestamp: Date.now() };
const jsonData = JSON.stringify(data);
const jsonLength = Buffer.byteLength(jsonData);

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': jsonLength
  });
  res.end(jsonData);
});

server.listen(4000, () => {
  console.log('Minimal server on :4000');
  console.log('Run: autocannon -c 100 -p 10 -d 10 http://localhost:4000');
});
