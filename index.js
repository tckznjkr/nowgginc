const PROXY_DOMAIN = 'https://nowggincos.onrender.com';

app.use(
  '/apps',
  createProxyMiddleware({
    target: 'https://now.gg',
    changeOrigin: true,
    ws: true,
    cookieDomainRewrite: 'nowggincos.onrender.com',

    onProxyReq(proxyReq, req) {
      proxyReq.setHeader('referer', 'https://now.gg/');
      proxyReq.setHeader('origin', 'https://now.gg');
      proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');
      if (req.headers.cookie) proxyReq.setHeader('cookie', req.headers.cookie);
    },

    onProxyRes(proxyRes, req, res) {
      // Reescreve cookies para domínio do proxy
      if (proxyRes.headers['set-cookie']) {
        const cookies = proxyRes.headers['set-cookie'].map(cookie =>
          cookie
            .replace(/Domain=\.?now\.gg/gi, 'Domain=nowggincos.onrender.com')
            .replace(/Secure/gi, '')
        );
        res.setHeader('set-cookie', cookies);
      }

      // Reescreve redirecionamento para proxy
      if (proxyRes.headers['location']) {
        const location = proxyRes.headers['location'];
        if (location.startsWith('https://now.gg')) {
          proxyRes.headers['location'] = location.replace('https://now.gg', PROXY_DOMAIN);
        }
      }

      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        let originalWrite = res.write.bind(res);
        let originalEnd = res.end.bind(res);
        let chunks = [];

        res.write = (chunk) => chunks.push(Buffer.from(chunk));
        res.end = (chunk) => {
          if (chunk) chunks.push(Buffer.from(chunk));
          let body = Buffer.concat(chunks).toString('utf8');

          // Troca todas URLs absolutas para domínio do proxy
          body = body.replace(/https:\/\/now\.gg/gi, PROXY_DOMAIN);

          res.setHeader('content-length', Buffer.byteLength(body));
          originalWrite(Buffer.from(body));
          originalEnd();
        };
      }
    },
  })
);
