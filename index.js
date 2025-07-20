const express = require('express');
const puppeteer = require('puppeteer');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();

let sessionCookies = [];

async function fetchNowGGCookies() {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // User-Agent coerente com o que o site espera (Bluestacks Android)
    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 10; Bluestacks) AppleWebKit/537.36 Chrome/99.0 Mobile Safari/537.36'
    );

    await page.goto('https://now.gg/apps/uncube/10005/now.html', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Aguarda 5s para garantir carregamento total
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
    // Cabeçalhos necessários para evitar bloqueios
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
    proxyReq.setHeader(
      'user-agent',
      'Mozilla/5.0 (Linux; Android 10; Bluestacks) AppleWebKit/537.36 Chrome/99.0 Mobile Safari/537.36'
    );
    proxyReq.setHeader('host', 'now.gg');

    // Repasse dos cookies obtidos pelo Puppeteer
    if (sessionCookies.length > 0) {
      const cookieHeader = sessionCookies.map((c) => `${c.name}=${c.value}`).join('; ');
      proxyReq.setHeader('cookie', cookieHeader);
      //console.log('>> Cookies repassados:', cookieHeader);
    }
  },

  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    // Reescreve Location para manter no proxy
    if (proxyRes.headers['location']) {
      proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '');
    }

    // Ajusta cookies para o domínio localhost e remove Secure (para HTTP)
    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const newCookies = cookies.map((cookie) =>
        cookie.replace(/Domain=\.?now\.gg/gi, 'Domain=localhost').replace(/Secure/gi, '')
      );
      res.setHeader('set-cookie', newCookies);
    }

    const contentType = proxyRes.headers['content-type'] || '';

    // Manipula corpo HTML para corrigir URLs e injetar script para DPI e resolução
    if (contentType.includes('text/html')) {
      let body = responseBuffer.toString('utf8');

      // Remove URLs absolutas para manter proxy interno
      body = body.replace(/https:\/\/now\.gg/g, '');

      // Corrige redirecionamentos JS
      body = body.replace(
        /window\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g,
        'window.location = "$1"'
      );

      // Injeta script para simular devicePixelRatio e resoluções específicas
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

    // Para conteúdos não-HTML, retorna buffer sem alteração
    return responseBuffer;
  }),

  pathRewrite: {
    '^/': '/',
  },
});

const PORT = process.env.PORT || 3000;

async function start() {
  await fetchNowGGCookies();
  setInterval(fetchNowGGCookies, 30 * 60 * 1000); // Atualiza cookies a cada 30 min

  app.use('/', proxy);

  app.listen(PORT, () => {
    console.log(`🚀 Proxy rodando: http://localhost:${PORT}`);
  });
}

start();
