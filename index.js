const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  selfHandleResponse: true,

  onProxyReq(proxyReq, req) {
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
    proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');

    // Usa os cookies que vierem do cliente
    if (req.headers['cookie']) {
      proxyReq.setHeader('cookie', req.headers['cookie']);
    }
  },

  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    const contentType = proxyRes.headers['content-type'];

    if (proxyRes.headers['location']) {
      proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '');
    }

    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const newCookies = cookies.map(cookie =>
        cookie.replace(/Domain=\.?now\.gg/gi, 'Domain=localhost').replace(/Secure/gi, '')
      );
      res.setHeader('set-cookie', newCookies);
    }

    if (contentType && contentType.includes('text/html')) {
      let body = responseBuffer.toString('utf8');

      body = body.replace(/https:\/\/now\.gg/g, '');
      body = body.replace(/window\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location = "$1"');

      body = body.replace('</head>', `
        <script>
          Object.defineProperty(window, 'devicePixelRatio', { get: () => 7 });
          Object.defineProperty(screen, 'width', { get: () => 1080 });
          Object.defineProperty(screen, 'height', { get: () => 1920 });
          Object.defineProperty(window, 'innerWidth', { get: () => 1080 });
          Object.defineProperty(window, 'innerHeight', { get: () => 1920 });
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
  console.log(`🚀 Proxy rodando em http://localhost:${PORT}`);
});
