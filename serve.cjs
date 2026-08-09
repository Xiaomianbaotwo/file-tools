const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const zlib = require('zlib');

const PORT = 9178;
const DIST = path.join(__dirname, 'dist');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(DIST, urlPath);

  // 尝试发送 .gz 压缩版本（如果存在且客户端支持）
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (acceptEncoding.includes('gzip') && fs.existsSync(filePath + '.gz')) {
    filePath += '.gz';
    res.setHeader('Content-Encoding', 'gzip');
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 对于单页应用，回退到 index.html
      fs.readFile(path.join(DIST, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 Not Found</h1>');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

// 监听所有网络接口，端口 9178
server.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`🚀 服务器已启动：${url}`);
  console.log(`📡 内网用户可通过 Radmin VPN 访问：http://<您的虚拟IP>:${PORT}`);
  // 自动打开浏览器
  exec(`start "" "${url}"`);
});