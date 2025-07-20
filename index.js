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

    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const newCookies = cookies.map(cookie =>
        cookie.replace(/Domain=\.?now\.gg/gi, 'Domain=localhost')
      );
      res.setHeader('set-cookie', newCookies);
    }

    if (contentType && contentType.includes('text/html')) {
      let body = responseBuffer.toString('utf8');

      // Reescreve redirecionamentos
      body = body.replace(/https:\/\/now\.gg/g, '');
      body = body.replace(/window\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location = "$1"');
      body = body.replace(/window\.location\.href\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location.href = "$1"');
      body = body.replace(/document\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'document.location = "$1"');
      body = body.replace(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=https:\/\/now\.gg([^"']*)["']/gi,
        '<meta http-equiv="refresh" content="0;url=$1">');

      // Injetar simulação de DPI e largura mobile
      body = body.replace('</head>', `
        <script>
          Object.defineProperty(window, 'devicePixelRatio', {
            get: () => 7
          });
          Object.defineProperty(screen, 'width', {
            get: () => 400
          });
          Object.defineProperty(screen, 'height', {
            get: () => 800
          });
          Object.defineProperty(window, 'innerWidth', {
            get: () => 400
          });
          Object.defineProperty(window, 'innerHeight', {
            get: () => 800
          });
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
  console.log(`✅ Proxy rodando em http://localhost:${PORT}`);
});
