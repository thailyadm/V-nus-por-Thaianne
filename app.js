const CONFIG = {
  currency: 'USD',
  locale: 'pt-BR',
  whatsapp: '15555555555', // TROQUE pelo seu numero com codigo do pais
  paymentLinks: {
    card: '', // Cole aqui um Stripe Payment Link, Square Checkout, PayPal, etc.
    pix: ''   // Cole aqui um link de pagamento Pix do seu provedor (Mercado Pago, PagSeguro, etc.)
  },
  coupons: {
    VENUS10: 0.10,
    BEMVINDA15: 0.15
  }
};

const services = [
  { id:'essencial', icon:'✦', title:'Leitura Essencial', meta:'1 pergunta • leitura objetiva', description:'Para uma questão específica que precisa de clareza, contexto e orientação simbólica.', price:25 },
  { id:'venus', icon:'♀', title:'Leitura Vênus', meta:'3 perguntas • leitura aprofundada', description:'Uma leitura mais completa para observar diferentes aspectos de uma situação ou fase da vida.', price:45 },
  { id:'caminhos', icon:'☾', title:'Caminhos & Possibilidades', meta:'tiragem ampla • panorama', description:'Para explorar cenário atual, desafios, tendências, oportunidades e próximos passos possíveis.', price:65 },
  { id:'amor', icon:'♡', title:'Amor & Relações', meta:'tema afetivo • vínculos', description:'Leitura voltada a dinâmicas, sentimentos, limites, padrões e possibilidades no campo afetivo.', price:50 },
  { id:'espiritual', icon:'☼', title:'Direcionamento Espiritual', meta:'energia • reflexão', description:'Uma leitura focada em autoconhecimento, padrões internos, energia do momento e direcionamento pessoal.', price:50 },
  { id:'completa', icon:'✧', title:'Leitura Completa', meta:'sessão premium • múltiplos temas', description:'Para quem quer uma leitura extensa, com mais espaço para perguntas e conexão entre diferentes áreas.', price:85 }
];

let cart = JSON.parse(localStorage.getItem('venusCart') || '[]');
let discount = Number(localStorage.getItem('venusDiscount') || 0);

const $ = (s) => document.querySelector(s);
const money = (v) => new Intl.NumberFormat(CONFIG.locale,{style:'currency',currency:CONFIG.currency}).format(v);

function renderServices(){
  $('#serviceGrid').innerHTML = services.map(s => `
    <article class="service-card">
      <div class="service-icon">${s.icon}</div>
      <p class="service-meta">${s.meta}</p>
      <h3>${s.title}</h3>
      <p>${s.description}</p>
      <div class="service-footer"><span class="price">${money(s.price)}</span><button class="add-btn" data-id="${s.id}">Adicionar</button></div>
    </article>`).join('');
  document.querySelectorAll('.add-btn').forEach(b=>b.addEventListener('click',()=>addToCart(b.dataset.id)));
}

function addToCart(id){
  const service = services.find(s=>s.id===id);
  cart.push(service); persist(); renderCart(); toast(`${service.title} adicionada ao carrinho.`); openCart();
}
function removeFromCart(index){ cart.splice(index,1); persist(); renderCart(); }
function persist(){ localStorage.setItem('venusCart',JSON.stringify(cart)); localStorage.setItem('venusDiscount',discount); }
function subtotal(){ return cart.reduce((sum,i)=>sum+i.price,0); }
function total(){ return subtotal()*(1-discount); }

function renderCart(){
  $('#cartCount').textContent = cart.length;
  $('#cartItems').innerHTML = cart.length ? cart.map((i,idx)=>`<div class="cart-item"><div><h4>${i.title}</h4><p>${i.meta}</p><strong>${money(i.price)}</strong></div><button class="remove" data-index="${idx}">Remover</button></div>`).join('') : '<p>Seu carrinho está vazio.</p>';
  document.querySelectorAll('.remove').forEach(b=>b.addEventListener('click',()=>removeFromCart(Number(b.dataset.index))));
  $('#cartTotal').textContent = money(total());
}

function applyCoupon(){
  const code = $('#couponInput').value.trim().toUpperCase();
  if(CONFIG.coupons[code]){ discount = CONFIG.coupons[code]; $('#couponMessage').textContent = `Cupom aplicado: ${Math.round(discount*100)}% de desconto.`; }
  else { discount=0; $('#couponMessage').textContent = code ? 'Cupom não encontrado.' : 'Digite um cupom.'; }
  persist(); renderCart();
}

function openCart(){ $('#cartDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('show'); }
function closeCart(){ $('#cartDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('show'); }
function openCheckout(){
  if(!cart.length){ toast('Adicione uma consulta antes de continuar.'); return; }
  closeCart(); $('#checkoutModal').classList.add('show'); $('#checkoutModal').setAttribute('aria-hidden','false'); renderCheckout();
}
function closeCheckout(){ $('#checkoutModal').classList.remove('show'); $('#checkoutModal').setAttribute('aria-hidden','true'); }
function renderCheckout(){
  $('#checkoutSummary').innerHTML = `<strong>Resumo:</strong><br>${cart.map(i=>`${i.title} — ${money(i.price)}`).join('<br>')}<br><br><strong>Total: ${money(total())}</strong>`;
  updatePaymentNote();
}
function updatePaymentNote(){
  const method=$('#paymentMethod').value;
  $('#paymentNote').innerHTML = method==='card'
    ? '<strong>Cartão:</strong> o pagamento será concluído em uma página segura do provedor que você configurar.'
    : '<strong>Pix:</strong> o pagamento será concluído no link Pix do provedor configurado. Isso permite gerar QR Code e confirmação com segurança.';
}

function checkout(e){
  e.preventDefault();
  const data = new FormData(e.target);
  const method = data.get('payment');
  const link = CONFIG.paymentLinks[method];
  if(link){ window.location.href = link; return; }
  const order = cart.map(i=>`• ${i.title} (${money(i.price)})`).join('\n');
  const msg = encodeURIComponent(`Olá! Quero finalizar uma compra na Vênus por Thaianne.\n\n${order}\n\nTotal: ${money(total())}\nForma de pagamento: ${method==='card'?'Cartão de crédito':'Pix'}\nNome: ${data.get('name')}\nE-mail: ${data.get('email')}\nWhatsApp: ${data.get('phone')}\n\nAinda não há link de pagamento configurado no site.`);
  window.open(`https://wa.me/${CONFIG.whatsapp}?text=${msg}`,'_blank');
}

function toast(text){ const t=$('#toast'); t.textContent=text; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }

renderServices(); renderCart(); $('#year').textContent=new Date().getFullYear();
$('#openCart').addEventListener('click',openCart); $('#closeCart').addEventListener('click',closeCart); $('#drawerBackdrop').addEventListener('click',closeCart); $('#applyCoupon').addEventListener('click',applyCoupon); $('#goCheckout').addEventListener('click',openCheckout); $('#closeCheckout').addEventListener('click',closeCheckout); $('#checkoutForm').addEventListener('submit',checkout); $('#paymentMethod').addEventListener('change',updatePaymentNote);
$('.menu-toggle').addEventListener('click',()=>$('.nav').classList.toggle('show'));
document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>$('.nav').classList.remove('show')));
