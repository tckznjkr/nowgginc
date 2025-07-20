const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createServer } = require('http');
const { createProxyServer } = require('http-proxy');
const app = express();
const proxy = createProxyServer({ changeOrigin: true });

app.use((req, res) => {
  proxy.web(req, res, {
    target: 'https://now.gg',
    selfHandleResponse: true,
  });

  proxy.on('proxyRes', (proxyRes, req, res) => {
    let body = Buffer.from('');
    proxyRes.on('data', data => {
      body = Buffer.concat([body, data]);
    });

    proxyRes.on('end', () => {
      let html = body.toString();

      // Reescreve redirecionamentos para passar pelo proxy
      html = html.replace(/https:\/\/now\.gg/g, '');

      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      res.end(html);
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy com manipulação de resposta rodando na porta ${PORT}`);
});
