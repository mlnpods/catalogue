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
  const oldMap={'AirPods Max':['airpods-max','airpods-max-noir','AirPods Max - Noir',50,'assets/airpods-max-1.jpeg'],'AirPods':['airpods','airpods-5','AirPods 5',30,'assets/airpods-1.webp'],'Watch':['watch',null,'Watch',35,'assets/watch-1.jpeg'],};
  for(const [key,val] of Object.entries(raw)){
   if(typeof val==='number'){
    const m=oldMap[key]; if(!m||val<=0)continue;
    const sku=m[1]||m[0]; out[sku]={product_id:m[0],variant_id:m[1],name:m[2],quantity:Math.floor(val),price:m[3],image:m[4]};
   } else if(val&&typeof val==='object'&&Number(val.quantity)>0){
    if(val.product_id==='chargeur-rapide'||String(val.name||'').toLowerCase()==='chargeur rapide')continue;
    out[key]={...val,quantity:Math.floor(Number(val.quantity))};
   }
  }
  return out;
 }
 function readCart(){try{return migrateCart(JSON.parse(localStorage.getItem(CART_KEY)||'{}'));}catch(e){return {};}}
 let cart=readCart();
 let promoState=null;
 function save(){
  localStorage.setItem(CART_KEY,JSON.stringify(cart));
  savedOrder=null;
  if(promoState){promoState=null;const msg=$('promoCodeMessage');if(msg)msg.textContent='Panier modifié : applique à nouveau ton code promo.';}
  render();
 }
 function entries(){return Object.entries(cart).filter(([,it])=>Number(it.quantity)>0);}
 function subtotal(){return entries().reduce((sum,[,it])=>sum+Number(it.price||0)*Number(it.quantity),0);}
 function count(){return entries().reduce((sum,[,it])=>sum+Number(it.quantity),0);}
 function available(item){if(item.variant_id)return Number(variants[item.variant_id]?.stock_quantity||0);const p=products[item.product_id];return Math.max(0,Number(p?.stock_quantity||0));}
 function stockLabel(item){const n=available(item);return n>0?`${n} en stock`:'Rupture de stock';}
 async function loadStock(){
  if(!db){stockReady=false;return;}
  try{
   const p=await db.from('products').select('id,name,price,old_price,promo_enabled,stock_quantity,in_stock');
   if(p.error)throw p.error;
   (p.data||[]).forEach(x=>products[x.id]=x);
   const v=await db.from('product_variants').select('variant_id,product_id,variant_name,stock_quantity');
   if(v.error)throw v.error;
   (v.data||[]).forEach(x=>{
    variants[x.variant_id]=x;
    const canonical=({'AirPods 5':'airpods-5','AirPods Pro 3':'airpods-pro-3','AirPods 4':'airpods-4','AirPods Pro 2':'airpods-pro-2'})[String(x.variant_name||'').trim()];
    if(canonical)variants[canonical]={...x,variant_id:canonical};
   });
   stockReady=true;
   for(const [sku,it] of entries()){
    const prod=products[it.product_id];if(prod&&Number.isFinite(Number(prod.price)))it.price=Number(prod.price);
    if(it.variant_id&&variants[it.variant_id])it.name=it.variant_id==='airpods-max-noir'?'AirPods Max - Noir':variants[it.variant_id].variant_name;
   }
   localStorage.setItem(CART_KEY,JSON.stringify(cart));render();
  }catch(e){console.error('MlnPods stocks:',e);stockReady=false;}
 }
 function productImage(card,productId){
  const extra=card?.querySelector('.home-extra-photo');
  if(extra&&!extra.hidden&&extra.getAttribute('src'))return extra.getAttribute('src');
  const img=card?.querySelector('img.product-photo')||card?.querySelector('.gallery img')||card?.querySelector('img');
  return img?.getAttribute('src')||'';
 }
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
  const subTotalValue=subtotal(),discount=Math.min(subTotalValue,Math.max(0,Number(promoState?.discount||0)));
  const sub=$('cartSubtotal');if(sub)sub.textContent=money(subTotalValue);
  if($('cartSubtotalCheckout'))$('cartSubtotalCheckout').textContent=money(subTotalValue);
  if($('checkoutPromoDiscount'))$('checkoutPromoDiscount').textContent=discount>0?'−'+money(discount):money(0);
  const currentMode=$('deliveryMode')?.value;
  const currentFee=currentMode?deliveryFee(currentMode,subTotalValue):null;
  if($('checkoutDeliveryFee'))$('checkoutDeliveryFee').textContent=currentFee===null?'À choisir':money(currentFee);
  if($('checkoutGrandTotal'))$('checkoutGrandTotal').textContent=currentFee===null?'—':money(Math.max(0,subTotalValue-discount)+(currentFee||0));
  const start=$('checkoutStart');if(start)start.disabled=!entries().length;
  const productStart=$('mlnCheckout');if(productStart)productStart.disabled=!entries().length;
  document.querySelectorAll('[data-product-variant],[data-home-variant]').forEach(btn=>{
   const id=btn.dataset.productVariant||btn.dataset.homeVariant;
   const v=variants[id],baseLabel=btn.dataset.baseLabel||(btn.dataset.baseLabel=btn.textContent.trim().replace(/ · (?:\\d+ en stock|Rupture de stock|Stock…?)$/,''));
   const n=v?Number(v.stock_quantity||0):null;
   btn.disabled=false;
   btn.title=v?(n>0?`${n} en stock`:'Rupture de stock'):'Stock en cours de vérification';
   if(btn.dataset.homeVariant||btn.dataset.productVariant)btn.textContent=v?`${baseLabel} · ${n>0?n+' en stock':'Rupture de stock'}`:`${baseLabel} · Stock…`;
  });
  document.querySelectorAll('[data-stock-variant]').forEach(el=>{
   const v=variants[el.dataset.stockVariant],n=v?Number(v.stock_quantity||0):null;
   el.textContent=v?(n>0?`✓ ${n} en stock`:'✕ Rupture de stock'):'Stock en cours de vérification…';
   el.classList.toggle('is-in',!!v&&n>0);el.classList.toggle('is-out',!!v&&n<=0);
  });
  document.querySelectorAll('[data-stock-product]').forEach(el=>{
   const p=products[el.dataset.stockProduct],n=p?Number(p.stock_quantity||0):null;
   el.textContent=p?(n>0?`✓ ${n} en stock`:'✕ Rupture de stock'):'Stock en cours de vérification…';
   el.classList.toggle('is-in',!!p&&n>0);el.classList.toggle('is-out',!!p&&n<=0);
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
   if(id){
    const v=variants[id];
    add.disabled=!v||Number(v.stock_quantity||0)<=0;
   }else{
    const p=products[document.body.dataset.productId];
    const inStock=!!p&&Number(p.stock_quantity||0)>0;
    add.disabled=!inStock;
    add.textContent=inStock?'🛒 Ajouter au panier — '+money(p.price||0):'Rupture de stock';
   }
   if(add.disabled)add.textContent='Rupture de stock';
  }
  document.querySelectorAll('article.product .add-cart').forEach(button=>{
   const card=button.closest('article.product'),variant=button.dataset.variantId||card?.querySelector('.home-variant')?.value;
   if(variant){
    const v=variants[variant],qty=Number(v?.stock_quantity||0);
    button.disabled=!v||qty<=0;
    if(button.disabled)button.textContent='Rupture de stock';
    else button.textContent=variant==='airpods-max-noir'?'Ajouter au panier — Noir':'Ajouter au panier';
   }else{
    const product=products[button.dataset.productId];
    button.disabled=!product||Number(product.stock_quantity||0)<=0;
    if(button.disabled)button.textContent='Rupture de stock';
   }
  });
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
  const discount=Math.min(sub,Math.max(0,Number(promoState?.discount||order?.discount_amount||0)));
  const promoCode=promoState?.code||order?.promo_code||'';
  const lines=['🎧 NOUVELLE COMMANDE — MLNPODS','',`👤 Client : ${client}`,'', '🛍️ PRODUITS',...entries().map(([,it])=>`• ${it.quantity} × ${it.name} — ${money(it.price)} / unité = ${money(it.price*it.quantity)}`),'',`🧾 Sous-total : ${money(sub)}`];
  if(promoCode)lines.push(`🎟️ Code promo : ${promoCode}`);
  lines.push(`💸 Réduction : ${money(discount)}`,`🚚 Livraison : ${deliveryLabel(mode)} — ${money(fee)}`,`💶 TOTAL : ${money(Math.max(0,sub-discount)+fee)}`,'',`📞 Téléphone : ${$('customerPhone')?.value.trim()||''}`);
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
  const {data,error}=await db.rpc('mlnpods_place_order_with_promo',{p_items:payload,p_delivery_code:mode,p_address:[[$('customerFirstName')?.value.trim(),$('customerLastName')?.value.trim()].filter(Boolean).join(' '),addressValue(mode)].filter(Boolean).join(' — '),p_phone:$('customerPhone').value.trim(),p_email:$('customerEmail').value.trim()||null,p_promo_code:promoState?.code||null});
  if(error)throw new Error(error.message||'La commande n’a pas pu être enregistrée.');
  if(!data?.success)throw new Error(data?.message||'La commande n’a pas pu être enregistrée.');
  savedOrder=data;
  await loadStock();
  return data;
 }

 async function applyPromo(){
  const input=$('promoCodeInput'),message=$('promoCodeMessage'),button=$('applyPromoCode');
  const code=(input?.value||'').trim().toUpperCase();
  if(!code){promoState=null;if(message)message.textContent='Saisis un code promo.';render();return false;}
  if(!db){if(message)message.textContent='Connexion indisponible. Réessaie.';return false;}
  if(button){button.disabled=true;button.textContent='Vérification…';}
  try{
   const {data,error}=await db.rpc('mlnpods_validate_promo',{p_code:code,p_subtotal:subtotal()});
   if(error)throw error;
   const result=Array.isArray(data)?data[0]:data;
   if(!result?.valid){promoState=null;if(message)message.textContent=result?.message||'Code promo invalide ou expiré.';render();return false;}
   else{
    promoState={code:result.code||code,discount:Number(result.discount_amount||0)};
    if(message)message.textContent=`✓ Code accepté : ${money(promoState.discount)} de réduction.`;
   }
   render();
   return true;
  }catch(e){
   promoState=null;
   if(message)message.textContent='Impossible de vérifier ce code : '+(e.message||'réessaie après configuration SQL.');
   render();
   return false;
  }finally{if(button){button.disabled=false;button.textContent='Appliquer';}}
 }
 function clearPromo(){
  promoState=null;
  if($('promoCodeInput'))$('promoCodeInput').value='';
  if($('promoCodeMessage'))$('promoCodeMessage').textContent='Code promo retiré.';
  render();
 }

 async function send(){
  if(!validate())return;
  const button=$('sendWhatsApp');if(button)button.disabled=true;
  try{
   const typedCode=$('promoCodeInput')?.value.trim()||'';
   if(typedCode&&(!promoState||promoState.code!==typedCode.toUpperCase())){const ok=await applyPromo();if(!ok)throw new Error('Le code promo n’est pas valide.');}
   const order=await placeOrder();
   const text=summary(order);$('orderSummary').value=text;
   // La commande est enregistrée et le message WhatsApp préparé : vider le panier maintenant.
   cart={};localStorage.removeItem(CART_KEY);savedOrder=null;render();
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
  document.querySelectorAll('.add-cart').forEach(btn=>btn.addEventListener('click',()=>{const card=btn.closest('article.product');const name=btn.dataset.product||card?.querySelector('h3')?.textContent.trim();const productId=btn.dataset.productId||({'AirPods Max':'airpods-max','AirPods':'airpods','Watch':'watch'}[name]);const variantId=btn.dataset.variantId||(name==='AirPods'?card?.querySelector('.home-variant')?.value:null);const variantName=variantId?({'airpods-5':'AirPods 5','airpods-4':'AirPods 4','airpods-pro-3':'AirPods Pro 3','airpods-pro-2':'AirPods Pro 2','airpods-max-noir':'Noir'}[variantId]):null;const price=Number((card?.querySelector('.current-price')?.textContent||'').replace(',','.').replace(/[^\d.]/g,''))||Number(products[productId]?.price||0);const item={product_id:productId,variant_id:variantId||null,name:variantName?(name==='AirPods Max'?'AirPods Max - Noir':variantName):name,price,image:productImage(card,productId)};if(addItem(item,1))$('cartOverlay')?.classList.add('open');}));
  $('mlnVariantSelect')?.addEventListener('change',render);
  document.querySelectorAll('[data-product-variant]').forEach(btn=>btn.addEventListener('click',()=>{
   $('mlnVariantSelect').value=btn.dataset.productVariant;
   document.body.dataset.variantId=btn.dataset.productVariant;
   document.querySelectorAll('[data-product-variant]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));
   render();
  }));
  document.querySelectorAll('[data-home-variant]').forEach(btn=>btn.addEventListener('click',()=>{
   const card=btn.closest('article.product'),variant=btn.dataset.homeVariant;
   const hidden=card?.querySelector('.home-variant');
   if(hidden)hidden.value=variant;
   card?.querySelectorAll('[data-home-variant]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));
   const photo=card?.querySelector('.home-extra-photo'),view=card?.querySelector('a.view');
   const routes={
    'airpods-5':{href:'AirPods-5.html',image:'assets/airpods5-01.jpeg',alt:'AirPods 5 — photo 1'},
    'airpods-pro-3':{href:'AirPods-Pro-3.html',image:'assets/airpodspro3-01.jpeg',alt:'AirPods Pro 3 — photo 1'},
    'airpods-4':{href:'AirPods.html',image:'',alt:''},
    'airpods-pro-2':{href:'AirPods.html',image:'',alt:''}
   };
   const target=routes[variant];
   if(target&&view)view.href=target.href;
   if(photo&&target){
    if(target.image){photo.src=target.image;photo.alt=target.alt;photo.hidden=false;}
    else photo.hidden=true;
   }
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
   const sub=subtotal(),discount=Math.min(sub,Math.max(0,Number(promoState?.discount||0)));
   const mode=$('deliveryMode')?.value,fee=mode?deliveryFee(mode,sub):null;
   if($('cartSubtotalCheckout'))$('cartSubtotalCheckout').textContent=money(sub);
   if($('checkoutPromoDiscount'))$('checkoutPromoDiscount').textContent=discount>0?'−'+money(discount):money(0);
   if($('checkoutDeliveryFee'))$('checkoutDeliveryFee').textContent=fee===null?'À choisir':money(fee);
   if($('checkoutGrandTotal'))$('checkoutGrandTotal').textContent=fee===null?'—':money(Math.max(0,sub-discount)+(fee||0));
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
   ['customerFirstName','customerLastName'].forEach(id=>{const el=$(id);if(el)el.required=true;});
   const email=$('customerEmail');if(email)email.required=shipped;
   const emailLabel=email?.closest('label');
   if(emailLabel){const hint=emailLabel.querySelector('.mln-optional');if(hint)hint.textContent=shipped?'(obligatoire)':'(facultatif)';}
   ['customerFirstName','customerLastName'].forEach(id=>{const el=$(id);const hint=el?.closest('label')?.querySelector('.mln-optional');if(hint)hint.textContent='(obligatoire)';});
   $('orderSummary').value='';refreshCheckoutTotals();
  }));
  $('applyPromoCode')?.addEventListener('click',applyPromo);
  $('removePromoCode')?.addEventListener('click',clearPromo);
  $('promoCodeInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyPromo();}});
  $('promoCodeInput')?.addEventListener('input',()=>{if(promoState){promoState=null;render();}if($('promoCodeMessage'))$('promoCodeMessage').textContent='';});
  $('sendWhatsApp')?.addEventListener('click',send);
  ['customerFirstName','customerLastName','customerPhone','customerEmail','customerSnapchat','customerStreetNumber','customerStreet','customerAddressComplement','customerPostcode','customerCity','relayName','relayStreetNumber','relayStreet','relayAddressComplement','relayPostcode','relayCity'].forEach(id=>$(id)?.addEventListener('input',()=>{$('orderSummary').value='';}));
  refreshCheckoutTotals();
  const returnHome=()=>{if(sessionStorage.getItem('mlnpods_return_home_after_whatsapp')==='1'&&document.visibilityState==='visible'){sessionStorage.removeItem('mlnpods_return_home_after_whatsapp');window.location.replace('index.html');}};
  document.addEventListener('visibilitychange',returnHome);
  window.addEventListener('pageshow',returnHome);
  window.addEventListener('storage',e=>{if(e.key===CART_KEY){cart=readCart();render();}});
  render();loadStock();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
