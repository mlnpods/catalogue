// MlnPods - synchronisation publique Supabase (lecture seule)
(function(){
 'use strict';
 const URL='https://fvighhpzcjzioyijtmzo.supabase.co';
 const KEY='sb_publishable_4-7YlOeRwbtA9GTavIxLmQ_6nAuSryg';
 const headers={'apikey':KEY,'Content-Type':'application/json'};
 async function request(path,opts={}){
  const response=await fetch(URL+'/rest/v1/'+path,{...opts,headers:{...headers,...(opts.headers||{})}});
  if(!response.ok)throw new Error('Supabase '+response.status+': '+await response.text());
  if(response.status===204)return [];
  return response.json();
 }
 const ids={'AirPods Max':'airpods-max','AirPods':'airpods','Watch':'watch','Chargeur rapide':'chargeur-rapide'};
 const byName=name=>ids[(name||'').trim()]||null;
 const euro=value=>Number(value||0).toLocaleString('fr-FR',{maximumFractionDigits:2})+' €';
 function countdown(date){if(!date)return '';const ms=new Date(date).getTime()-Date.now();if(!Number.isFinite(ms)||ms<=0)return '';let s=Math.floor(ms/1000),d=Math.floor(s/86400);s%=86400;let h=Math.floor(s/3600);s%=3600;let m=Math.floor(s/60);s%=60;return (d?d+'j ':'')+String(h).padStart(2,'0')+'h '+String(m).padStart(2,'0')+'m '+String(s).padStart(2,'0')+'s';}
 function addStyles(){if(document.getElementById('mln-sync-style'))return;const style=document.createElement('style');style.id='mln-sync-style';style.textContent='.mln-photo-wrap{position:relative;overflow:hidden}.mln-photo-wrap>.product-photo{display:block;width:100%;transition:filter .3s}.mln-stock-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:12px;background:rgba(0,0,0,.6);color:#ffd21c;z-index:5;font-weight:900;letter-spacing:1px}.mln-count{font-size:clamp(15px,3vw,23px);margin-top:9px;color:#fff;letter-spacing:0}.mln-out .product-photo{filter:blur(5px) brightness(.48)}.mln-stock-pill{display:inline-block;margin:6px 0;padding:5px 9px;border-radius:20px;background:#3a1515;color:#ffb3b3;font-size:11px;font-weight:800}.mln-stock-pill.ok{background:#12351f;color:#a8f0bc}';document.head.appendChild(style);}
 function setCard(card,p){
  const current=card.querySelector('.current-price'),old=card.querySelector('.old-price');
  if(current)current.textContent=euro(p.price);
  if(old){old.textContent=p.promo_enabled?euro(p.old_price):'';old.style.display=p.promo_enabled?'':'none';}
  const img=card.querySelector('.product-photo');
  if(img){let wrap=img.parentElement;if(!wrap.classList.contains('mln-photo-wrap')){wrap=document.createElement('div');wrap.className='mln-photo-wrap';img.parentNode.insertBefore(wrap,img);wrap.appendChild(img);}let overlay=wrap.querySelector('.mln-stock-overlay');
   if(!p.in_stock){card.classList.add('mln-out');if(!overlay){overlay=document.createElement('div');overlay.className='mln-stock-overlay';wrap.appendChild(overlay);}const timer=countdown(p.restock_at);overlay.innerHTML='<div>RESTOCK BIENTÔT</div>'+(timer?'<div class="mln-count" data-restock="'+p.id+'">'+timer+'</div>':'<small>PRODUIT INDISPONIBLE</small>');}
   else{card.classList.remove('mln-out');if(overlay)overlay.remove();}
  }
  const content=card.querySelector('.product-content');
  if(content){let pill=content.querySelector('.mln-stock-pill');if(!pill){pill=document.createElement('span');pill.className='mln-stock-pill';const title=content.querySelector('h3');if(title)title.insertAdjacentElement('afterend',pill);else content.prepend(pill);}pill.textContent=p.in_stock?'EN STOCK · '+p.stock_quantity+' disponible(s)':'RUPTURE DE STOCK';pill.classList.toggle('ok',!!p.in_stock);}
 }
 function render(rows){addStyles();const map=Object.fromEntries(rows.map(p=>[p.id,p]));
  document.querySelectorAll('article.product').forEach(card=>{const name=card.querySelector('h3')?.textContent.trim();const id=byName(name);const p=map[id];if(p)setCard(card,p);});
  const heading=document.querySelector('main h1');if(heading){const p=map[byName(heading.textContent.trim())];if(p){const row=document.querySelector('.price-row'),current=row?.querySelector('.current'),old=row?.querySelector('.old');if(current)current.textContent=euro(p.price);if(old){old.textContent=p.promo_enabled?euro(p.old_price):'';old.style.display=p.promo_enabled?'':'none';}
   const img=document.querySelector('main img.product-photo, main .product-image');if(img){let wrap=img.parentElement;if(!wrap.classList.contains('mln-photo-wrap')){wrap.classList.add('mln-photo-wrap');}let overlay=wrap.querySelector('.mln-stock-overlay');if(!p.in_stock){if(!overlay){overlay=document.createElement('div');overlay.className='mln-stock-overlay';wrap.appendChild(overlay);}const timer=countdown(p.restock_at);overlay.innerHTML='<div>RESTOCK BIENTÔT</div>'+(timer?'<div class="mln-count" data-restock="'+p.id+'">'+timer+'</div>':'<small>PRODUIT INDISPONIBLE</small>');img.style.filter='blur(5px) brightness(.48)';}else{img.style.filter='';if(overlay)overlay.remove();}}
  }}
 }
 async function refresh(){try{const rows=await request('products?select=*');window.MlnPodsProducts=rows;render(rows);}catch(error){console.error('MlnPods sync:',error);}}
 function tick(){document.querySelectorAll('[data-restock]').forEach(el=>{const product=(window.MlnPodsProducts||[]).find(p=>p.id===el.dataset.restock);const timer=countdown(product?.restock_at);el.textContent=timer||'RESTOCK DISPONIBLE';});}
 window.MlnPodsSync={URL,KEY,request,refresh,render,euro,countdown};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refresh();setInterval(tick,1000);});else{refresh();setInterval(tick,1000);}
})();
