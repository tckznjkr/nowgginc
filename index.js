const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const app = express();

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  selfHandleResponse: true,
  cookieDomainRewrite: 'localhost', // Redireciona os cookies para o domínio do proxy

  onProxyReq(proxyReq, req) {
    // Cabeçalhos importantes para enganar o site
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
    proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');

    // Encaminha os cookies do navegador para o now.gg
    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie);
    }
  },

  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    const contentType = proxyRes.headers['content-type'];

    // Reescreve cookies de resposta para o domínio do proxy
    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const newCookies = cookies.map(cookie =>
        cookie.replace(/Domain=\.?now\.gg/gi, 'Domain=localhost')
      );
      res.setHeader('set-cookie', newCookies);
    }

    // Se for HTML, intercepta para reescrever URLs
    if (contentType && contentType.includes('text/html')) {
      let body = responseBuffer.toString('utf8');

      // Reescreve links absolutos para manter dentro do proxy
      body = body.replace(/https:\/\/now\.gg/g, '');

      // Redirecionamentos JavaScript (window.location)
      body = body.replace(/window\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location = "$1"');
      body = body.replace(/window\.location\.href\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location.href = "$1"');
      body = body.replace(/document\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'document.location = "$1"');

      // Redirecionamentos via meta tag
      body = body.replace(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=https:\/\/now\.gg([^"']*)["']/gi,
        '<meta http-equiv="refresh" content="0;url=$1">');

      return body;
    }

    // Resposta sem modificação
    return responseBuffer;
  }),

  pathRewrite: {
    '^/': '/',
  }
});

app.use('/', proxy);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy reverso rodando: http://localhost:${PORT}`);
});
