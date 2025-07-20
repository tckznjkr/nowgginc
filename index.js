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

    // espera extras caso tenha scripts carregando
    await page.waitForTimeout(7000);

    sessionCookies = await page.cookies();

    await browser.close();

    console.log('✅ Cookies atualizados em', new Date().toLocaleString());
  } catch (err) {
    console.error('❌ Erro ao capturar cookies:', err);
  }
}

// Função para iniciar o proxy e captura inicial dos cookies
async function start() {
  await fetchNowGGCookies();
  setInterval(fetchNowGGCookies, 30 * 60 * 1000); // atualiza a cada 30 min

  const proxy = createProxyMiddleware({
    target: 'https://now.gg',
    changeOrigin: true,
    selfHandleResponse: true,
    // cookieDomainRewrite: 'localhost', // desativado para teste, pode reativar se quiser

    onProxyReq(proxyReq, req) {
      proxyReq.setHeader('referer', 'https://now.gg');
      proxyReq.setHeader('origin', 'https://now.gg');
      proxyReq.setHeader('user-agent', req.headers['user-agent'] || 'Mozilla/5.0');
      proxyReq.setHeader('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
      proxyReq.setHeader('accept-language', 'en-US,en;q=0.9');
      proxyReq.setHeader('sec-fetch-site', 'same-origin');
      proxyReq.setHeader('sec-fetch-mode', 'navigate');
      proxyReq.setHeader('sec-fetch-user', '?1');
      proxyReq.setHeader('sec-fetch-dest', 'document');
      proxyReq.setHeader('upgrade-insecure-requests', '1');

      // Prioriza o cookie enviado pelo cliente; se não tiver, usa o da sessão Puppeteer
      const incomingCookie = req.headers['cookie'];
      if (incomingCookie) {
        proxyReq.setHeader('cookie', incomingCookie);
      } else {
        const cookieHeader = sessionCookies.map(c => `${c.name}=${c.value}`).join('; ');
        if (cookieHeader) {
          proxyReq.setHeader('cookie', cookieHeader);
        }
      }
    },

    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'];

      // Ajusta redirecionamento para dentro do proxy
      if (proxyRes.headers['location']) {
        proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^https:\/\/now\.gg/, '');
      }

      // Ajusta cookies para domínio localhost (ou remova se quiser o domínio original)
      const cookies = proxyRes.headers['set-cookie'];
      if (cookies) {
        const newCookies = cookies.map(cookie =>
          cookie.replace(/Domain=\.?now\.gg/gi, 'Domain=localhost').replace(/Secure/gi, '')
        );
        res.setHeader('set-cookie', newCookies);
      }

      if (contentType && contentType.includes('text/html')) {
        let body = responseBuffer.toString('utf8');

        // Remove urls absolutas e scripts de redirecionamento para o domínio original
        body = body.replace(/https:\/\/now\.gg/g, '');
        body = body.replace(/window\.location\s*=\s*['"]https:\/\/now\.gg([^'"]*)['"]/g, 'window.location = "$1"');

        // Injeta script para simular DPI 700 e tamanho tela razoável
        body = body.replace('</head>', `
          <script>
            Object.defineProperty(window, 'devicePixelRatio', { get: () => 700 });
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
      '^/': '/', // mantém caminho igual
    }
  });

  app.use('/', proxy);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Proxy rodando com atualização automática: http://localhost:${PORT}`);
  });
}

start();
