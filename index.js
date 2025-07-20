const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

const targetHost = 'https://now.gg';

const proxy = createProxyMiddleware({
  target: targetHost,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false,
  secure: false,

  // Reescreve domínio nos cookies
  cookieDomainRewrite: {
    "*": "localhost"
  },

  pathRewrite: (path, req) => {
    return path.replace(/^\/now/, '/'); // Exemplo: /now/apps/ -> /apps/
  },

  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('origin', targetHost);
    proxyReq.setHeader('referer', `${targetHost}/`);
    proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');

    proxyReq.setHeader('accept', req.headers['accept'] || '*/*');
    proxyReq.setHeader('accept-language', req.headers['accept-language'] || 'en-US,en;q=0.9');

    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie);
    }
  },

  onProxyRes: (proxyRes, req, res) => {
    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const rewritten = cookies.map(cookie =>
        cookie
          .replace(/Domain=\.?now\.gg/gi, 'Domain=localhost')
          .replace(/; Secure/gi, '') // Remove secure para funcionar em HTTP
      );
      proxyRes.headers['set-cookie'] = rewritten;
    }

    if (proxyRes.headers['location']) {
      proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '/now');
    }
  },
});

// Página com iframe apontando para o proxy
app.get('/jogo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Proxy do Jogo</title>
      <style>
        html, body, iframe {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
      </style>
    </head>
    <body>
      <iframe 
        src="/now/apps/uncube/10005/"
        allow="autoplay; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      ></iframe>
    </body>
    </html>
  `);
});

// Aponta a rota /now/* para o proxy reverso
app.use('/now', proxy);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy rodando em: http://localhost:${PORT}/jogo`);
});
