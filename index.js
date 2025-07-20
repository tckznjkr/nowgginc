const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

app.use('/', createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  onProxyReq(proxyReq) {
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
  },
  pathRewrite: {
    '^/': '/', // mantém a estrutura de caminho
  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy reverso rodando na porta ${PORT}`);
});
