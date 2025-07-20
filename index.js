const express = require('express');
const puppeteer = require('puppeteer');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();

let sessionCookies = [];

// Função para capturar cookies atualizados da now.gg
async function fetchNowGGCookies() {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; Bluestacks) AppleWebKit/537.36 Chrome/99.0 Mobile Safari/537.36');

    await page.goto('https://now.gg/apps/uncube/10005/now.html', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    sessionCookies = await page.cookies();
    await browser.close();

    console.log('✅ Cookies atualizados em', new Date().toLocaleString());
  } catch (err) {
    console.error('❌ Erro ao capturar cookies:', err);
  }
}

async function start() {
  await fetchNowGGCookies();
  setInterval(fetchNowGGCookies, 30 * 60 * 1000); // Atualiza cookies a cada 30 minutos

  const proxy = createProxyMiddleware({
    target: 'https://now.gg',
    changeOrigin: true,
    selfHandleResponse: true,
    // cookieDomainRewrite: 'localhost', // desative para evitar problemas

    onProxyReq(proxyReq, req) {
      proxyReq.setHeader('referer', 'https://now.gg');
      proxyReq.setHeader('origin', 'https://now.gg');
      proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');

      // Usa o cookie da requisição do cliente se existir, senão usa os cookies Puppeteer
      const clientCookie = req.headers['cookie'];
      if (clientCookie) {
        proxyReq.setHeader('cookie', clientCookie);
      } else {
        const cookieHeader = sessionCookies.map(c => `${c.name}=${c.value}`).join('; ');
        if (cookieHeader) proxyReq.setHeader('cookie', cookieHeader);
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
    console.log(`🚀 Proxy rodando com atualização automática: http://localhost:${PORT}`);
  });
}

start();
