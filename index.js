const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const LOCAL_DOMAIN = 'http://localhost:3000'; // seu domínio local

app.get('/jogo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Jogo via Proxy</title>
        <style>
          html, body, iframe {
            margin: 0; padding: 0;
            width: 100%; height: 100%;
            border: 0; overflow: hidden;
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

// Middleware para interceptar e reescrever HTML no proxy
function rewriteHtmlMiddleware(proxyRes, req, res) {
  const contentType = proxyRes.headers['content-type'] || '';

  if (contentType.includes('text/html')) {
    let originalWrite = res.write.bind(res);
    let originalEnd = res.end.bind(res);
    let chunks = [];

    res.write = (chunk) => {
      chunks.push(Buffer.from(chunk));
    };

    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      let body = Buffer.concat(chunks).toString('utf8');

      // Reescreve TODAS as URLs absolutas do now.gg para o proxy local
      body = body.replace(/https:\/\/now\.gg/gi, LOCAL_DOMAIN);

      // Se quiser, pode adicionar mais reescritas aqui para URLs relativas, scripts, etc.

      res.setHeader('content-length', Buffer.byteLength(body));
      originalWrite(Buffer.from(body));
      originalEnd();
    };
  }
}

const proxyOptions = {
  target: 'https://now.gg',
  changeOrigin: true,
  ws: true,

  cookieDomainRewrite: 'localhost',

  onProxyReq(proxyReq, req) {
    // Ajusta headers para parecer navegador normal
    proxyReq.setHeader('referer', 'https://now.gg/');
    proxyReq.setHeader('origin', 'https://now.gg');

    proxyReq.setHeader(
      'user-agent',
      req.headers['user-agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    // Repassa cookies do cliente para o servidor proxy
    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie);
    }
  },

  onProxyRes(proxyRes, req, res) {
    // Reescreve cookies para domínio local
    if (proxyRes.headers['set-cookie']) {
      const cookies = proxyRes.headers['set-cookie'].map(cookie =>
        cookie
          .replace(/Domain=\.?now\.gg/gi, 'Domain=localhost')
          .replace(/Secure/gi, '')
      );
      res.setHeader('set-cookie', cookies);
    }

    // Reescreve redirecionamentos para domínio local
    if (proxyRes.headers['location']) {
      const location = proxyRes.headers['location'];
      if (location.startsWith('https://now.gg')) {
        proxyRes.headers['location'] = location.replace('https://now.gg', LOCAL_DOMAIN);
      }
    }

    // Reescreve o corpo HTML para manter tudo no proxy
    rewriteHtmlMiddleware(proxyRes, req, res);
  },
};

// Proxy para /apps (jogos)
app.use('/apps', createProxyMiddleware(proxyOptions));

// Proxy para outras rotas sem reescrita (pode mudar ou remover se quiser)
app.use(
  '/',
  createProxyMiddleware({
    target: 'https://now.gg',
    changeOrigin: true,
    ws: true,
    cookieDomainRewrite: 'localhost',
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy rodando: ${LOCAL_DOMAIN}/jogo`);
});
