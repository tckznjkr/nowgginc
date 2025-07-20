const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.get('/jogo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Jogo via Proxy</title>
        <style>
          html, body, iframe {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            border: 0;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <iframe
          src="/apps/Blox-fruit/19901/Blox-fruit.html"
          allow="autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        ></iframe>
      </body>
    </html>
  `);
});

// Proxy para todos os caminhos, especialmente /apps/*
app.use(
  '/',
  createProxyMiddleware({
    target: 'https://now.gg',
    changeOrigin: true,
    ws: true,
    cookieDomainRewrite: 'localhost',

    onProxyReq(proxyReq, req) {
      proxyReq.setHeader('referer', 'https://now.gg/');
      proxyReq.setHeader('origin', 'https://now.gg');

      proxyReq.setHeader(
        'user-agent',
        req.headers['user-agent'] ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      );

      if (req.headers.cookie) {
        proxyReq.setHeader('cookie', req.headers.cookie);
      }
    },

    onProxyRes(proxyRes, req, res) {
      // Ajusta cookies para localhost
      if (proxyRes.headers['set-cookie']) {
        const cookies = proxyRes.headers['set-cookie'].map(cookie =>
          cookie
            .replace(/Domain=\.?now\.gg/gi, 'Domain=localhost')
            .replace(/Secure/gi, '')
        );
        res.setHeader('set-cookie', cookies);
      }

      // Reescreve redirecionamentos Location para continuar no proxy
      if (proxyRes.headers['location']) {
        const original = proxyRes.headers['location'];
        if (original.startsWith('https://now.gg')) {
          proxyRes.headers['location'] = original.replace('https://now.gg', '');
        }
      }

      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        const originalWrite = res.write;
        const originalEnd = res.end;
        const chunks = [];

        res.write = function (chunk) {
          chunks.push(chunk);
        };

        res.end = function (chunk) {
          if (chunk) chunks.push(chunk);
          let body = Buffer.concat(chunks).toString('utf8');

          // Reescreve urls absolutas do now.gg para URLs relativas no proxy
          body = body.replace(/https:\/\/now\.gg/gi, '');

          res.setHeader('content-length', Buffer.byteLength(body));
          originalWrite.call(res, Buffer.from(body));
          originalEnd.call(res);
        };
      }
    },

    // Aqui não precisa mudar nada no pathRewrite porque a gente quer proxyar tudo do /
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy rodando: http://localhost:${PORT}/jogo`);
});
