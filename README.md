# Vênus por Thaianne — site para GitHub Pages

Site estático em HTML/CSS/JavaScript pronto para publicar no GitHub Pages.

## Arquivos
- `index.html` — página principal
- `assets/styles.css` — identidade visual e responsividade
- `assets/app.js` — serviços, carrinho, cupons e checkout
- `termos.html` — termos iniciais
- `politica-de-privacidade.html` — política inicial
- `CNAME` — domínio customizado

## Antes de publicar
1. Abra `assets/app.js`.
2. Troque `whatsapp: '15555555555'` pelo seu número no formato internacional, somente números.
3. Edite serviços e preços no array `services`.
4. Em `paymentLinks.card`, cole um link seguro de checkout de cartão do seu provedor.
5. Em `paymentLinks.pix`, cole um link Pix/checkout do seu provedor.
6. Edite ou remova os cupons em `coupons`.

## Pagamentos
GitHub Pages não executa backend. Por segurança, não coloque chaves secretas de Stripe, Mercado Pago, PayPal ou outro provedor dentro de JavaScript público.

A forma mais simples para esta versão é usar Payment Links / Checkout Links hospedados pelo provedor. O site já está preparado para redirecionar o cliente quando esses links forem adicionados.

## GitHub Pages
1. Crie um repositório.
2. Envie todos os arquivos preservando as pastas.
3. Vá em Settings > Pages.
4. Em Build and deployment, selecione Deploy from a branch.
5. Escolha a branch `main` e a pasta `/ (root)`.
6. Configure o domínio `venusporthaianne.com` em Custom domain.

## Domínio
O arquivo `CNAME` já contém `venusporthaianne.com`. Você ainda precisa configurar os registros DNS no provedor do domínio conforme as instruções do GitHub Pages.
