[media pointer="file-service://file-HcyjE44ht2WXytJkBCuTDn"]
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  cookieDomainRewrite: 'localhost',
  ws: true,

  onProxyReq(proxyReq, req) {
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
    proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');

    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie);
    }
  },

  onProxyRes(proxyRes, req, res) {
    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const newCookies = cookies.map(cookie =>
        cookie.replace(/Domain=\.?now\.gg/gi, 'Domain=localhost').replace(/Secure/gi, '')
      );
      res.setHeader('set-cookie', newCookies);
    }

    if (proxyRes.headers['location']) {
      proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '');
    }
  },

  pathRewrite: {
    '^/': '/',
  }
});

// 🔧 Página HTML local que embute o iframe com o jogo
app.get('/jogo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Jogo via Proxy</title>
      <style>
        html, body, iframe { margin:0; padding:0; width:100%; height:100%; border:0; }
      </style>
    </head>
    <body>
      <iframe src="/apps/uncube/10005/" allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    </body>
    </html>
  `);
});

// ⚡ Usa o proxy para tudo do now.gg
app.use('/', proxy);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy rodando em http://localhost:${PORT}/jogo`);
}); o que falta para funcionar 
