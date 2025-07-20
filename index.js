const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

// Lista de headers que vamos permitir passar para o cliente (ajustar se precisar)
const allowedResponseHeaders = [
  'content-type',
  'set-cookie',
  'location',
  'cache-control',
  'expires',
  'last-modified',
  'pragma',
  'etag',
  'vary',
];

// Middleware para limpar headers de resposta que podem causar problemas
function cleanResponseHeaders(proxyRes, req, res) {
  // Repassa só headers permitidos
  Object.keys(proxyRes.headers).forEach(header => {
    if (!allowedResponseHeaders.includes(header.toLowerCase())) {
      delete proxyRes.headers[header];
    }
  });
  
  // Ajuste cookies para domain correto e remove Secure para permitir HTTP local
  const cookies = proxyRes.headers['set-cookie'];
  if (cookies) {
    const newCookies = cookies.map(cookie =>
      cookie
        .replace(/Domain=\.?now\.gg/gi, 'Domain=localhost')
        .replace(/Secure/gi, '') // Remove flag secure pra não bloquear local
        .replace(/SameSite=Lax/gi, 'SameSite=None') // Forçar SameSite None para cross-site (ajuste se quiser)
    );
    proxyRes.headers['set-cookie'] = newCookies;
    res.setHeader('set-cookie', newCookies);
  }

  // Corrigir redirecionamentos para não sair do proxy
  if (proxyRes.headers['location']) {
    proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '');
  }
}

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  ws: true,
  secure: false, // Caso precise ignorar SSL (opcional)

  // Ajustar headers da requisição para parecer cliente legítimo
  onProxyReq(proxyReq, req) {
    proxyReq.setHeader('referer', 'https://now.gg/');
    proxyReq.setHeader('origin', 'https://now.gg');
    proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');
    
    // Repassar cookies do cliente
    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie);
    }
  },

  onProxyRes(proxyRes, req, res) {
    cleanResponseHeaders(proxyRes, req, res);
  },

  // Permite que todos os paths no proxy sejam roteados para now.gg
  pathRewrite: (path, req) => {
    // Se quiser, pode fazer algum rewrite específico aqui
    return path;
  },

  // Opção para modificar resposta se precisar (ex: injetar script, alterar HTML, etc)
  selfHandleResponse: false, // true se quiser interceptar e modificar conteúdo manualmente
});

// Página local que embute o iframe com o jogo
app.get('/jogo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Jogo via Proxy</title>
      <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
      <style>
        html, body, iframe { margin:0; padding:0; width:100%; height:100%; border:none; }
      </style>
    </head>
    <body>
      <iframe src="/apps/uncube/10005/" allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"></iframe>
    </body>
    </html>
  `);
});

// Usar proxy para todo o resto (rotas, assets, websockets etc)
app.use('/', proxy);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy rodando em http://localhost:${PORT}/jogo`);
});
