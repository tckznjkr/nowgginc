const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  ws: true,
  cookieDomainRewrite: 'localhost',

  onProxyReq(proxyReq, req) {
    proxyReq.setHeader('referer', 'https://now.gg/');
    proxyReq.setHeader('origin', 'https://now.gg');
    proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');

    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie);
    }
  },

  onProxyRes(proxyRes, req, res) {
    if (proxyRes.headers['set-cookie']) {
      const newCookies = proxyRes.headers['set-cookie'].map(cookie =>
        cookie
          .replace(/Domain=\.?now\.gg/gi, 'Domain=localhost')
          .replace(/Secure/gi, '')
      );
      res.setHeader('set-cookie', newCookies);
    }

    if (proxyRes.headers['location']) {
      proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '');
    }
  },

  pathRewrite: {
    '^/': '/',
  },
});

app.use('/', proxy);
