const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const TARGET = 'https://now.gg';

app.use('/apps', createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  cookieDomainRewrite: 'localhost',
  ws: true,
  pathRewrite: {
    '^/apps': '/apps', // pode mudar se quiser mapear diferente
  },
  onProxyReq(proxyReq, req, res) {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Proxy)');
    proxyReq.setHeader('Referer', TARGET);
  },
  onProxyRes(proxyRes, req, res) {
    proxyRes.headers['access-control-allow-origin'] = '*';
  },
  logLevel: 'debug',
}));

app.listen(3000, () => {
  console.log('Proxy now.gg rodando em http://localhost:3000');
});
