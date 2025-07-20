const express = require('express');
const { createProxyServer } = require('http-proxy');
const app = express();
const proxy = createProxyServer({ changeOrigin: true, selfHandleResponse: true });

// Intercepta todas as rotas
app.use((req, res) => {
  proxy.web(req, res, {
    target: 'https://now.gg',
    selfHandleResponse: true,
  });
});

// Intercepta a resposta da now.gg
proxy.on('proxyRes', (proxyRes, req, res) => {
  let bodyChunks = [];

  proxyRes.on('data', chunk => {
    bodyChunks.push(chunk);
  });

  proxyRes.on('end', () => {
    const rawBody = Buffer.concat(bodyChunks);
    const contentType = proxyRes.headers['content-type'] || '';

    if (contentType.includes('text/html')) {
      let html = rawBody.toString();

      // Reescreve todos os links absolutos para ficar dentro do proxy
      html = html.replace(/https:\/\/now\.gg/g, '');

      // Injeta JavaScript para bloquear redirecionamentos
      const injectScript = `
        <script>
          // Bloqueia redirecionamento via JS
          Object.defineProperty(window, 'location', {
            configurable: false,
            writable: false,
            value: {
              ...location,
              assign: () => console.log('Bloqueado assign'),
              replace: () => console.log('Bloqueado replace'),
              set href(_) { console.log('Bloqueado href'); },
              get href() { return window.location.href; }
            }
          });

          // Bloqueia redirecionamentos imediatos
          window.stop();

          // Impede abertura de janelas externas
          window.open = () => { console.log('Bloqueado window.open'); };
        </script>
      `;

      // Injeta o script antes do fechamento do </head>
      html = html.replace('</head>', `${injectScript}</head>`);

      // Envia resposta com conteúdo modificado
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        'content-length': Buffer.byteLength(html),
      });
      res.end(html);
    } else {
      // Outros tipos de conteúdo (ex: .js, .png) são enviados sem alteração
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      res.end(rawBody);
    }
  });
});

// Inicia o servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Proxy com manipulação rodando em http://localhost:${PORT}`);
});
