const express = require('express');
const puppeteer = require('puppeteer');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();

let sessionCookies = [];

async function fetchNowGGCookies() {
  try {
    const browser = await puppeteer.launch({
      headless: true, // modo headless padrão para Render
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 10; Bluestacks) AppleWebKit/537.36 Chrome/99.0 Mobile Safari/537.36'
    );

    await page.goto('https://now.gg/apps/uncube/10005/now.html', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.waitForTimeout(5000);

    sessionCookies = await page.cookies();

    await browser.close();

    console.log('✅ Cookies atualizados em', new Date().toLocaleString());
  } catch (err) {
    console.error('❌ Erro ao capturar cookies:', err);
  }
}

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  selfHandleResponse: true,
  cookieDomainRewrite: 'localhost',

  onProxyReq(proxyReq, req) {
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
    proxyReq.setHeader(
      'user-agent',
      'Mozilla/5.0 (Linux; Android 10; Bluestacks) AppleWebKit/537.36 Chrome/99.0 Mobile Safari/537.36'
    );
    proxyReq.setHeader('host', 'now.gg');

    if (sessionCookies.length > 0) {
      const cookieHeader = sessionCookies.map((c) => `${c.name}=${c.value}`).join('; ');
      proxyReq.setHeader('cookie', cookieHeader);
    }
  },

  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    if (proxyRes.headers['location']) {
      proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '');
    }

    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const newCookies = cookies.map((cookie) =>
        cookie.replace(/Domain=\.?now\.gg/gi, 'Domain=localhost').replace(/Secure/gi, '')
      );
      res.setHeader('set-cookie', newCookies);
    }

    const contentType = proxyRes.headers['content-type'] || '';

    if (contentType.includes('text/html')) {
      let body = responseBuffer.toString('utf8');

      body = body.replace(/https:\/\/now\.gg/g, '');

      body = body.replace(
        /window\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g,
        'window.location = "$1"'
      );

      body = body.replace(
        /<\/head>/i,
        `
        <script>
          Object.defineProperty(window, 'devicePixelRatio', { get: () => 7 });
          Object.defineProperty(screen, 'width', { get: () => 400 });
          Object.defineProperty(screen, 'height', { get: () => 800 });
          Object.defineProperty(window, 'innerWidth', { get: () => 400 });
          Object.defineProperty(window, 'innerHeight', { get: () => 800 });
        </script>
      </head>`
      );

      return body;
    }

    return responseBuffer;
  }),

  pathRewrite: {
    '^/': '/',
  }
});

const PORT = process.env.PORT || 3000;

async function start() {
  await fetchNowGGCookies();
  setInterval(fetchNowGGCookies, 30 * 60 * 1000); // Atualiza a cada 30 minutos

  app.use('/', proxy);

  // Escuta 0.0.0.0 para a plataforma reconhecer externamente
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Proxy rodando no Render em http://localhost:${PORT}`);
  });
}

start();
