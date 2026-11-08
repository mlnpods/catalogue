/* MlnPods - panier partagé et validation sécurisée du stock via Supabase RPC */
(() => {
 'use strict';
 const CART_KEY='mlnpods_cart_v1';
 const SUPABASE_URL='https://fvighhpzcjzioyijtmzo.supabase.co';
 const SUPABASE_KEY='sb_publishable_4-7YlOeRwbtA9GTavIxLmQ_6nAuSryg';
 const WHATSAPP='33780842264';
 const SNAPCHAT='https://www.snapchat.com/add/shopmaillot25';
 const $=id=>document.getElementById(id);
 const money=n=>Number(n||0).toLocaleString('fr-FR',{maximumFractionDigits:2})+' €';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const db=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
 const products={}; const variants={}; let stockReady=false; let savedOrder=null;
 function migrateCart(raw){
  const out={}; if(!raw||typeof raw!=='object')return out;
  const oldMap={'AirPods Max':['airpods-max','airpods-max-noir','AirPods Max - Noir',50,'assets/airpods-max-1.jpeg'],'AirPods':['airpods','airpods-5','AirPods 5',30,'assets/airpods-1.webp'],'Watch':['watch',null,'Watch',35,'assets/watch-1.jpeg'],'Chargeur rapide':['chargeur-rapide',null,'Chargeur rapide',15,'assets/chargeur-rapide.jpeg']};
  for(const [key,val] of Object.entries(raw)){
   if(typeof val==='number'){
    const m=oldMap[key]; if(!m||val<=0)continue;
    const sku=m[1]||m[0]; out[sku]={product_id:m[0],variant_id:m[1],name:m[2],quantity:Math.floor(val),price:m[3],image:m[4]};
   } else if(val&&typeof val==='object'&&Number(val.quantity)>0){out[key]={...val,quantity:Math.floor(Number(val.quantity))};}
  }
  return out;
 }
 function readCart(){try{return migrateCart(JSON.parse(localStorage.getItem(CART_KEY)||'{}'));}catch(e){return {};}}
 let cart=readCart();
  let appliedPromo=null, promoMessage='';
 function save(){localStorage.setItem(CART_KEY,JSON.stringify(cart));savedOrder=null;render();}
 function entries(){return Object.entries(cart).filter(([,it])=>Number(it.quantity)>0);}
 function subtotal(){return entries().reduce((sum,[,it])=>sum+Number(it.price||0)*Number(it.quantity),0);}
 function count(){return entries().reduce((sum,[,it])=>sum+Number(it.quantity),0);}
  function promoDiscount(sub=subtotal()){if(!appliedPromo)return 0;const v=Number(appliedPromo.discount_value||0);return Math.min(sub,appliedPromo.discount_type==='percent'?sub*v/100:v);}
  function payableSubtotal(){return Math.max(0,subtotal()-promoDiscount());}
  async function applyPromo(){
   const input=$('promoCodeInput'),status=$('promoCodeMessage'),button=$('applyPromoCode');
   const code=String(input?.value||'').trim().toUpperCase();
   if(!code){if(status)status.textContent='Saisis un code promo.';return;}
   if(button)button.disabled=true;
   try{
    if(!db)throw new Error('Service indisponible. Réessaie plus tard.');
    const {data,error}=await db.from('promo_codes').select('id,code,discount_type,discount_value,min_subtotal,max_uses,uses_count,starts_at,expires_at,active').eq('code',code).eq('active',true).maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Code promo invalide ou désactivé.');
    const now=Date.now(),sub=subtotal();
    if(data.starts_at&&new Date(data.starts_at).getTime()>now)throw new Error('Ce code promo n’est pas encore valable.');
    if(data.expires_at&&new Date(data.expires_at).getTime()<now)throw new Error('Ce code promo a expiré.');
    if(data.max_uses!==null&&Number(data.uses_count)>=Number(data.max_uses))throw new Error('Ce code promo a atteint sa limite d’utilisation.');
    if(sub<Number(data.min_subtotal||0))throw new Error('Montant minimum requis : '+money(data.min_subtotal)+'.');
    if(!['percent','fixed'].includes(data.discount_type)||Number(data.discount_value)<=0)throw new Error('Code promo mal configuré.');
    appliedPromo=data;promoMessage='Code '+code+' appliqué : −'+money(promoDiscount())+'.';
    if(status)status.textContent=promoMessage;
    render();
   }catch(e){appliedPromo=null;promoMessage='';if(status)status.textContent=e.message||'Impossible de vérifier ce code.';render();}
   finally{if(button)button.disabled=false;}
  }
  function removePromo(){appliedPromo=null;promoMessage='';if($('promoCodeInput'))$('promoCodeInput').value='';if($('promoCodeMessage'))$('promoCodeMessage').textContent='Code promo retiré.';render();}
 function available(item){if(item.variant_id)return Number(variants[item.variant_id]?.stock_quantity||0);const p=products[item.product_id];return p&&p.in_stock===false?0:Number(p?.stock_quantity||0);}
 function stockLabel(item){const n=available(item);return n>0?`${n} en stock`:'Rupture de stock';}
 async function loadStock(){
  if(!db){stockReady=false;return;}
  try{
   const p=await db.from('products').select('id,name,price,old_price,promo_enabled,stock_quantity,in_stock');
   if(p.error)throw p.error;
   (p.data||[]).forEach(x=>products[x.id]=x);
   const v=await db.from('product_variants').select('variant_id,product_id,variant_name,stock_quantity');
   if(v.error)console.warn('MlnPods variantes non chargées :',v.error.message);
   else (v.data||[]).forEach(x=>variants[x.variant_id]=x);
   stockReady=true;
   for(const [sku,it] of entries()){
    const prod=products[it.product_id];if(prod&&Number.isFinite(Number(prod.price)))it.price=Number(prod.price);
    if(it.variant_id&&variants[it.variant_id])it.name=it.variant_id==='airpods-max-noir'?'AirPods Max - Noir':variants[it.variant_id].variant_name;
   }
   localStorage.setItem(CART_KEY,JSON.stringify(cart));render();
  }catch(e){console.error('MlnPods stocks:',e);stockReady=false;}
 }
 const HOME_PRODUCT_IMAGES={'airpods-max':'assets/panier-airpods-max.jpg','airpods':'assets/panier-airpods.jpg','watch':'assets/panier-watch.jpg','chargeur-rapide':'assets/panier-chargeur.jpg'};
 function productImage(card,productId){if(productId&&HOME_PRODUCT_IMAGES[productId])return HOME_PRODUCT_IMAGES[productId];const img=card?.querySelector('img.product-photo')||card?.querySelector('.gallery img')||card?.querySelector('img');return img?.getAttribute('src')||'';}
 function getCurrentProduct(){const body=document.body;const id=body.dataset.productId||'';const variant=body.dataset.variantId||$('mlnVariantSelect')?.value||null;const name=body.dataset.product||'';const price=Number(body.dataset.price||0);return {product_id:id,variant_id:variant,name:variant?(variant==='airpods-max-noir'?'AirPods Max - Noir':( $('mlnVariantSelect')?.selectedOptions[0]?.textContent||name)):name,price,image:productImage(document.querySelector('main'),id)};}
 function addItem(item,qty){
  if(!stockReady){alert('Les stocks ne sont pas disponibles pour le moment. Actualise la page et réessaie.');return false;}
  const sku=item.variant_id||item.product_id;const old=cart[sku]?.quantity||0;const max=available(item);
  if(max<=old||qty>max-old){alert(`Stock insuffisant pour ${item.name}. Disponible : ${Math.max(0,max-old)}.`);return false;}
  const p=products[item.product_id];if(p)item.price=Number(p.price||item.price);
  cart[sku]={...item,image:productImage(null,item.product_id)||item.image||'',quantity:old+qty};save();return true;
 }
 function render(){
  const countEl=$('cartCount');if(countEl)countEl.textContent=count();
  const box=$('cartItems');if(box){const rows=entries();box.innerHTML=rows.length?rows.map(([sku,it])=>{
   const max=available(it),q=Number(it.quantity);
   return `<div class="cart-line mln-cart-line"><img src="${esc(productImage(null,it.product_id)||it.image||'')}" alt="" style="width:58px;height:58px;object-fit:cover;border-radius:9px;background:#171717" onerror="this.style.display='none'"><div><strong>${esc(it.name)}</strong><small>${money(it.price)} / unité · ${esc(stockLabel(it))}</small><div class="qty-controls mln-qty-controls"><button type="button" data-cart-minus="${esc(sku)}" aria-label="Diminuer">−</button><span>${q}</span><button type="button" data-cart-plus="${esc(sku)}" aria-label="Augmenter" ${q>=max?'disabled':''}>+</button><button type="button" data-cart-remove="${esc(sku)}">Supprimer</button></div></div><strong>${money(Number(it.price||0)*q)}</strong></div>`;
  }).join(''):'<p class="notice mln-empty">Ton panier est vide pour le moment.</p>';}
  const sub=$('cartSubtotal');if(sub)sub.textContent=money(subtotal());
  if($('cartSubtotalCheckout'))$('cartSubtotalCheckout').textContent=money(subtotal());
  const currentMode=$('deliveryMode')?.value;
  const currentFee=currentMode?deliveryFee(currentMode,subtotal()):null;
  if($('checkoutPromoDiscount'))$('checkoutPromoDiscount').textContent=appliedPromo?'−'+money(promoDiscount()):money(0);
  if($('promoCodeMessage')&&appliedPromo)$('promoCodeMessage').textContent='Code '+appliedPromo.code+' appliqué : −'+money(promoDiscount())+'.';
  if($('checkoutDeliveryFee'))$('checkoutDeliveryFee').textContent=currentFee===null?'À choisir':money(currentFee);
  if($('checkoutGrandTotal'))$('checkoutGrandTotal').textContent=currentFee===null?'—':money(payableSubtotal()+currentFee);
  const start=$('checkoutStart');if(start)start.disabled=!entries().length;
  const productStart=$('mlnCheckout');if(productStart)productStart.disabled=!entries().length;
  document.querySelectorAll('[data-product-variant],[data-home-variant]').forEach(btn=>{
   const id=btn.dataset.productVariant||btn.dataset.homeVariant;
   const v=variants[id],baseLabel=btn.dataset.baseLabel||(btn.dataset.baseLabel=btn.textContent.trim().replace(/ · (?:\\d+ en stock|Rupture de stock|Stock…?)$/,''));
   const n=v?Number(v.stock_quantity||0):null;
   btn.disabled=false;
   btn.title=v?(n>0?`${n} en stock`:'Rupture de stock'):'Stock en cours de vérification';
   if(btn.dataset.homeVariant)btn.textContent=v?`${baseLabel} · ${n>0?n+' en stock':'Rupture de stock'}`:`${baseLabel} · Stock…`;
  });
  const status=$('mlnVariantStock');
  if(status){
   const id=document.body.dataset.variantId||$('mlnVariantSelect')?.value;
   const v=id?variants[id]:null;
   const n=v?Number(v.stock_quantity||0):null;
   status.textContent=id?(v?(n>0?`✓ ${n} disponible(s)`:'✕ Rupture de stock'):'Stock indisponible — actualise la page'):'';
   status.style.color=n>0?'#72d69a':'#ff8b8b';
  }
  const add=$('mlnAddToCart');
  if(add && document.body.dataset.productId){
   const id=document.body.dataset.variantId||$('mlnVariantSelect')?.value;
   const v=id?variants[id]:null;
   add.disabled=!!id&&(!v||Number(v.stock_quantity||0)<=0);
   if(add.disabled)add.textContent='Rupture de stock';
   else if(document.body.dataset.product==='AirPods')add.textContent='🛒 Ajouter au panier — 30 €';
  }
 }
 function deliveryFee(mode,sub){if(mode==='besancon')return sub>=30?0:5;if(mode==='saint-claude')return 0;if(mode==='relay')return 5;if(mode==='home')return 10;return 0;}
 function deliveryLabel(mode){return ({besancon:'Livraison à Besançon','saint-claude':'Retrait secteur Saint-Claude',relay:'Mondial Relay',home:'Livraison à domicile'})[mode]||'À choisir';}
 function addressValue(mode){
  if(mode==='relay'){
   const no=$('relayStreetNumber')?.value.trim()||'';
   const street=$('relayStreet')?.value.trim()||'';
   const complement=$('relayAddressComplement')?.value.trim()||'';
   const postcode=$('relayPostcode')?.value.trim()||'';
   const city=$('relayCity')?.value.trim()||'';
   const address=[no,street].filter(Boolean).join(' ')+(complement?', '+complement:'')+`, ${postcode} ${city}`;
   return `Point relais : ${$('relayName')?.value.trim()} — ${address}`;
  }
  if(mode==='saint-claude')return 'Retrait secteur Saint-Claude, Besançon';
  if(['besancon','home'].includes(mode)){
   const no=$('customerStreetNumber')?.value.trim()||'';
   const street=$('customerStreet')?.value.trim()||'';
   const complement=$('customerAddressComplement')?.value.trim()||'';
   const postcode=$('customerPostcode')?.value.trim()||'';
   const city=$('customerCity')?.value.trim()||'';
   return [no,street].filter(Boolean).join(' ') + (complement?`, ${complement}`:'') + `, ${postcode} ${city}`.trim();
  }
  return '';
 }
 function summary(order){
  const mode=$('deliveryMode')?.value,sub=subtotal(),fee=deliveryFee(mode,sub);
  const first=$('customerFirstName')?.value.trim()||'',last=$('customerLastName')?.value.trim()||'';
  const client=[first,last].filter(Boolean).join(' ')||'Non renseigné';
  const lines=['🎧 NOUVELLE COMMANDE — MLNPODS','',`👤 Client : ${client}`,'', '🛍️ PRODUITS',...entries().map(([,it])=>`• ${it.quantity} × ${it.name} — ${money(it.price)} / unité = ${money(it.price*it.quantity)}`),'',`🧾 Sous-total : ${money(sub)}`,...(appliedPromo?[`🎟️ Code promo : ${appliedPromo.code}`,`💸 Réduction : −${money(promoDiscount(sub))}`]:[]),`🚚 Livraison : ${deliveryLabel(mode)} — ${money(fee)}`,`💶 TOTAL : ${money(payableSubtotal()+fee)}`,'',`📞 Téléphone : ${$('customerPhone')?.value.trim()||''}`];
  const a=addressValue(mode);if(a)lines.push(mode==='relay'?'📦 Point relais : '+a:'🏠 Adresse / retrait : '+a);
  if($('customerEmail')?.value.trim())lines.push('✉️ E-mail : '+$('customerEmail').value.trim());
  if($('customerSnapchat')?.value.trim())lines.push('👻 Snapchat : '+$('customerSnapchat').value.trim());
  lines.push('','📲 Merci de vérifier le récapitulatif puis d’appuyer sur « ENVOYER » dans WhatsApp pour transmettre ta commande.','💬 La commande sera confirmée avec MlnPods.','💳 Paiement : à convenir avec MlnPods.');
  if(order?.order_number)lines.push('','Référence : '+order.order_number);
  return lines.join('\n');
 }
 function setRequiredGroup(id,required){const group=$(id);if(!group)return;group.hidden=!required;group.querySelectorAll('input,textarea').forEach(x=>{x.required=required;if(!required)x.value='';});}
 function validate(){
  const mode=$('deliveryMode')?.value,form=$('checkoutForm');
  if(!mode){alert('Choisis un mode de livraison.');return false;}
  if(!form.reportValidity())return false;
  const city=($('customerCity')?.value||'').trim().toLocaleLowerCase('fr-FR');
  if(mode==='besancon'&&city!=='besançon'&&city!=='besancon'){alert('La livraison locale est réservée à Besançon.');return false;}
  if(mode==='home'&&(city==='besançon'||city==='besancon')){alert('Pour Besançon, choisis « Livraison à Besançon » ou le retrait secteur Saint-Claude.');return false;}
  if(!$('acceptConditions')?.checked){alert('Tu dois accepter les conditions avant de continuer.');return false;}
  if(!entries().length){alert('Ton panier est vide.');return false;}
  if(!stockReady){alert('Impossible de vérifier le stock. Actualise la page et réessaie.');return false;}
  for(const [,it] of entries()){if(it.quantity>available(it)){alert(`Stock insuffisant pour ${it.name}. Stock disponible : ${available(it)}.`);return false;}}
  return true;
 }
 async function placeOrder(){
  if(savedOrder)return savedOrder;
  if(!db)throw new Error('Connexion à la base de commandes indisponible.');
  const mode=$('deliveryMode').value;
  const payload=entries().map(([,it])=>({product_id:it.product_id,variant_id:it.variant_id||null,quantity:Number(it.quantity)}));
  const {data,error}=await db.rpc('mlnpods_place_order',{p_items:payload,p_delivery_code:mode,p_address:[[$('customerFirstName')?.value.trim(),$('customerLastName')?.value.trim()].filter(Boolean).join(' '),addressValue(mode)].filter(Boolean).join(' — '),p_phone:$('customerPhone').value.trim(),p_email:$('customerEmail').value.trim()||null});
  if(error)throw new Error(error.message||'La commande n’a pas pu être enregistrée.');
  if(!data?.success)throw new Error(data?.message||'La commande n’a pas pu être enregistrée.');
  savedOrder=data;
  await loadStock();
  return data;
 }
 async function send(){
  if(!validate())return;
  const button=$('sendWhatsApp');if(button)button.disabled=true;
  try{
   const order=await placeOrder();
   const text=summary(order);$('orderSummary').value=text;
   // La commande est enregistrée et le message WhatsApp préparé : vider le panier maintenant.
   cart={};localStorage.removeItem(CART_KEY);savedOrder=null;appliedPromo=null;render();
   $('cartOverlay')?.classList.remove('open');
   $('checkoutForm').hidden=true;
   sessionStorage.setItem('mlnpods_return_home_after_whatsapp','1');
   window.location.href='https://wa.me/'+WHATSAPP+'?text='+encodeURIComponent(text);
  }catch(e){
   alert('Impossible de préparer la commande : '+(e.message||'Erreur inconnue')+'\nRéessaie dans un instant.');
  }finally{if(button)button.disabled=false;}
 }
 function init(){
  if(!document.getElementById('mln-cart-layout-style')){const st=document.createElement('style');st.id='mln-cart-layout-style';st.textContent='.mln-cart-line{grid-template-columns:68px minmax(0,1fr) auto!important;align-items:center}.mln-cart-line>img{width:68px!important;height:68px!important;object-fit:cover!important;border:1px solid #b18b32;box-shadow:0 2px 10px #0005}.mln-qty-controls button:disabled{opacity:.35;cursor:not-allowed}.checkout-form[hidden]{display:none!important}.mln-relay-help{font-size:12px;color:#cbbd8b;margin-top:10px;line-height:1.5}';document.head.appendChild(st);}
  // Shared menu and cart open/close controls (home and product pages).
  $('menuOpen')?.addEventListener('click',()=>$('menuOverlay')?.classList.add('open'));
  $('cartOpen')?.addEventListener('click',()=>$('cartOverlay')?.classList.add('open'));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close)?.classList.remove('open')));
  ['menuOverlay','cartOverlay'].forEach(id=>$(id)?.addEventListener('click',e=>{if(e.target.id===id)e.currentTarget.classList.remove('open');}));
  $('cartItems')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const sku=b.dataset.cartPlus||b.dataset.cartMinus||b.dataset.cartRemove;if(!sku)return;const it=cart[sku];if(!it)return;if(b.dataset.cartPlus){if(it.quantity<available(it))it.quantity++;else alert('Stock maximum atteint.');}if(b.dataset.cartMinus)it.quantity=Math.max(0,it.quantity-1);if(b.dataset.cartRemove||it.quantity===0)delete cart[sku];save();});
  document.querySelectorAll('.add-cart').forEach(btn=>btn.addEventListener('click',()=>{const card=btn.closest('article.product');const name=btn.dataset.product||card?.querySelector('h3')?.textContent.trim();const productId=btn.dataset.productId||({'AirPods Max':'airpods-max','AirPods':'airpods','Watch':'watch','Chargeur rapide':'chargeur-rapide'}[name]);const variantId=btn.dataset.variantId||(name==='AirPods'?card?.querySelector('.home-variant')?.value:null);const variantName=variantId?({'airpods-5':'AirPods 5','airpods-4':'AirPods 4','airpods-pro-3':'AirPods Pro 3','airpods-pro-2':'AirPods Pro 2','airpods-max-noir':'Noir'}[variantId]):null;const price=Number((card?.querySelector('.current-price')?.textContent||'').replace(',','.').replace(/[^\d.]/g,''))||Number(products[productId]?.price||0);const item={product_id:productId,variant_id:variantId||null,name:variantName?(name==='AirPods Max'?'AirPods Max - Noir':variantName):name,price,image:productImage(card,productId)};if(addItem(item,1))$('cartOverlay')?.classList.add('open');}));
  $('mlnVariantSelect')?.addEventListener('change',render);
  document.querySelectorAll('[data-product-variant]').forEach(btn=>btn.addEventListener('click',()=>{
   $('mlnVariantSelect').value=btn.dataset.productVariant;
   document.body.dataset.variantId=btn.dataset.productVariant;
   document.querySelectorAll('[data-product-variant]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));
   render();
  }));
  document.querySelectorAll('[data-home-variant]').forEach(btn=>btn.addEventListener('click',()=>{
   const card=btn.closest('article.product');const hidden=card?.querySelector('.home-variant');
   if(hidden)hidden.value=btn.dataset.homeVariant;
   card?.querySelectorAll('[data-home-variant]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));
  }));
  const qty=$('mlnProductQty');if(qty){$('mlnQtyMinus')?.addEventListener('click',()=>qty.value=Math.max(1,(Number(qty.value)||1)-1));$('mlnQtyPlus')?.addEventListener('click',()=>qty.value=Math.min(99,(Number(qty.value)||1)+1));qty.addEventListener('change',()=>qty.value=Math.max(1,Math.min(99,Math.floor(Number(qty.value)||1))));}
  $('mlnAddToCart')?.addEventListener('click',()=>{
   const qtyEl=$('mlnProductQty');
   const item=getCurrentProduct();
   const q=Math.max(1,Math.floor(Number(qtyEl?.value)||1));
   if(!item.product_id){alert('Produit non reconnu. Recharge la page.');return;}
   if(item.variant_id&&!variants[item.variant_id]){alert('Le stock de cette variante n’est pas encore chargé. Recharge la page dans quelques secondes.');return;}
   if(addItem(item,q))$('cartOverlay')?.classList.add('open');
  });
  function openCheckout(){
   $('checkoutForm').hidden=false;
   $('cartOverlay')?.classList.add('open');
   $('checkoutForm').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('checkoutStart')?.addEventListener('click',openCheckout);
  $('productCheckoutStart')?.addEventListener('click',()=>{
   if(!entries().length){alert('Ajoute d’abord un produit au panier.');return;}
   openCheckout();
  });
  function refreshCheckoutTotals(){
   const sub=subtotal(),mode=$('deliveryMode')?.value,fee=mode?deliveryFee(mode,sub):null;
   if($('cartSubtotalCheckout'))$('cartSubtotalCheckout').textContent=money(sub);
   if($('checkoutDeliveryFee'))$('checkoutDeliveryFee').textContent=fee===null?'À choisir':money(fee);
   if($('checkoutPromoDiscount'))$('checkoutPromoDiscount').textContent=appliedPromo?'−'+money(promoDiscount()):money(0);
    if($('checkoutGrandTotal'))$('checkoutGrandTotal').textContent=fee===null?'—':money(payableSubtotal()+fee);
  }
  document.querySelectorAll('[data-delivery-mode]').forEach(btn=>btn.addEventListener('click',()=>{
   const mode=btn.dataset.deliveryMode;$('deliveryMode').value=mode;
   document.querySelectorAll('[data-delivery-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));
   const address=['besancon','home'].includes(mode),relay=mode==='relay';
   $('addressGroup').hidden=!address;$('relayGroup').hidden=!relay;
   ['customerStreetNumber','customerStreet','customerPostcode','customerCity'].forEach(id=>{const el=$(id);if(el)el.required=address;});
   ['relayName','relayStreetNumber','relayStreet','relayPostcode','relayCity'].forEach(id=>{const el=$(id);if(el)el.required=relay;});
   const relayComplement=$('relayAddressComplement');if(relayComplement)relayComplement.required=false;
   const shipped=mode==='home'||mode==='relay';
   ['customerFirstName','customerLastName'].forEach(id=>{const el=$(id);if(el)el.required=shipped;});
   const email=$('customerEmail');if(email)email.required=shipped;
   const emailLabel=email?.closest('label');
   if(emailLabel){const hint=emailLabel.querySelector('.mln-optional');if(hint)hint.textContent=shipped?'(obligatoire)':'(facultatif)';}
   ['customerFirstName','customerLastName'].forEach(id=>{const el=$(id);const hint=el?.closest('label')?.querySelector('.mln-optional');if(hint)hint.textContent=shipped?'(obligatoire)':'(facultatif)';});
   $('orderSummary').value='';refreshCheckoutTotals();
  }));
  // Promo controls are attached globally below using event delegation.
  $('sendWhatsApp')?.addEventListener('click',send);
  ['customerFirstName','customerLastName','customerPhone','customerEmail','customerSnapchat','customerStreetNumber','customerStreet','customerAddressComplement','customerPostcode','customerCity','relayName','relayStreetNumber','relayStreet','relayAddressComplement','relayPostcode','relayCity'].forEach(id=>$(id)?.addEventListener('input',()=>{$('orderSummary').value='';}));
  refreshCheckoutTotals();
  const returnHome=()=>{if(sessionStorage.getItem('mlnpods_return_home_after_whatsapp')==='1'&&document.visibilityState==='visible'){sessionStorage.removeItem('mlnpods_return_home_after_whatsapp');window.location.replace('index.html');}};
  document.addEventListener('visibilitychange',returnHome);
  window.addEventListener('pageshow',returnHome);
  window.addEventListener('storage',e=>{if(e.key===CART_KEY){cart=readCart();render();}});
  render();loadStock();
 }
 // Robust delegated listeners: they still work if the checkout is moved or rebuilt dynamically.
 document.addEventListener('click',e=>{
  const apply=e.target.closest('#applyPromoCode');
  if(apply){e.preventDefault();applyPromo();return;}
  const remove=e.target.closest('#removePromoCode');
  if(remove){e.preventDefault();removePromo();}
 });
 document.addEventListener('keydown',e=>{
  if(e.target && e.target.id==='promoCodeInput' && e.key==='Enter'){
   e.preventDefault();applyPromo();
  }
 });
 window.MLNPODS_PROMO_HANDLER_VERSION='2.1-delegated';
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
