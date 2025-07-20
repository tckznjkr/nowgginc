const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const app = express();

const proxy = createProxyMiddleware({
  target: 'https://now.gg',
  changeOrigin: true,
  selfHandleResponse: true, // necessário para interceptar a resposta
  onProxyReq(proxyReq) {
    proxyReq.setHeader('referer', 'https://now.gg');
    proxyReq.setHeader('origin', 'https://now.gg');
  },
  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    let contentType = proxyRes.headers['content-type'];

    if (contentType && contentType.includes('text/html')) {
      let response = responseBuffer.toString('utf8');

      // Substitui links absolutos para manter dentro do proxy
      response = response.replace(/https:\/\/now\.gg/g, '');
      response = response.replace(/href="\/+/g, 'href="/');
      response = response.replace(/src="\/+/g, 'src="/');

      // Corrige redirecionamentos forçados para now.gg
      response = response.replace(/window\.location\s*=\s*["']https:\/\/now\.gg[^"']*["']/g, '/* redirecionamento bloqueado */');

      return response;
    }

    return responseBuffer; // conteúdo não HTML
  }),
  pathRewrite: {
    '^/': '/', // mantém o caminho original
  }
});

app.use('/', proxy);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy reverso rodando em http://localhost:${PORT}`);
});
