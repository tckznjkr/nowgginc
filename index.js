const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const app = express();

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  selfHandleResponse: true,
  cookieDomainRewrite: 'localhost',

  onProxyReq(proxyReq, req) {
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
    proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');

    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie);
    }
  },

  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    const contentType = proxyRes.headers['content-type'];

    // Redirecionamentos HTTP (location header)
    if (proxyRes.headers['location']) {
      proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '');
    }

    // Reescreve cookies
    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const newCookies = cookies.map(cookie => {
        return cookie
          .replace(/Domain=\.?now\.gg/gi, 'Domain=localhost')
          .replace(/Secure/gi, ''); // remove "Secure" para funcionar em HTTP local
      });
      res.setHeader('set-cookie', newCookies);
    }

    // Manipula HTML
    if (contentType && contentType.includes('text/html')) {
      let body = responseBuffer.toString('utf8');

      // Substitui redirecionamentos JS
      body = body.replace(/https:\/\/now\.gg/g, '');
      body = body.replace(/window\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location = "$1"');
      body = body.replace(/window\.location\.href\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location.href = "$1"');
      body = body.replace(/document\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'document.location = "$1"');
      body = body.replace(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=https:\/\/now\.gg([^"']*)["']/gi,
        '<meta http-equiv="refresh" content="0;url=$1">');

      // Injetar DPI 700 e largura mobile
      body = body.replace('</head>', `
        <script>
          Object.defineProperty(window, 'devicePixelRatio', { get: () => 7 });
          Object.defineProperty(screen, 'width', { get: () => 400 });
          Object.defineProperty(screen, 'height', { get: () => 800 });
          Object.defineProperty(window, 'innerWidth', { get: () => 400 });
          Object.defineProperty(window, 'innerHeight', { get: () => 800 });
        </script>
      </head>`);

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
  console.log(`✅ Proxy rodando com domínio e DPI ajustado: http://localhost:${PORT}`);
});
