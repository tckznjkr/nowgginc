const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const app = express();

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  selfHandleResponse: true,
  onProxyReq(proxyReq) {
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
  },
  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    const contentType = proxyRes.headers['content-type'];

    if (contentType && contentType.includes('text/html')) {
      let body = responseBuffer.toString('utf8');

      // Substitui redirecionamentos via JavaScript
      body = body.replace(/window\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location = "$1"');
      body = body.replace(/window\.location\.href\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location.href = "$1"');
      body = body.replace(/document\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'document.location = "$1"');

      // Redirecionamentos via meta refresh
      body = body.replace(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=https:\/\/now\.gg([^"']*)["']/gi,
        '<meta http-equiv="refresh" content="0;url=$1">');

      // Substitui links absolutos
      body = body.replace(/https:\/\/now\.gg/g, '');

      return body;
    }

    return responseBuffer;
  }),
  pathRewrite: {
    '^/': '/',
  }
});

app.use('/', proxy);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy com redirecionamento reescrito rodando em http://localhost:${PORT}`);
});
