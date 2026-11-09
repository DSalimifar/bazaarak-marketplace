const demoProducts = [
 {id:1,title:"عسل طبیعی کوهستان",category:"خوراکی",price:480000,city:"ارومیه",seller:"مریم احمدی",emoji:"🍯",description:"عسل طبیعی برداشت محدود"},
 {id:2,title:"ظروف سفالی دست‌ساز",category:"صنایع دستی",price:350000,city:"لالجین",seller:"کارگاه نقش خاک",emoji:"🏺",description:"ساخته‌شده با دست"},
 {id:3,title:"زعفران ممتاز",category:"خوراکی",price:920000,city:"قائن",seller:"رضا نادری",emoji:"🌺",description:"زعفران سرگل بسته‌بندی‌شده"},
 {id:4,title:"کیف چرمی دست‌دوز",category:"پوشاک",price:1250000,city:"تبریز",seller:"الهام کریمی",emoji:"👜",description:"چرم طبیعی و دوخت دستی"},
 {id:5,title:"خرمای خاصویی",category:"خوراکی",price:210000,city:"بوشهر",seller:"محمد دشتی",emoji:"🌴",description:"محصول تازه منطقه"},
 {id:6,title:"گلیم سنتی",category:"صنایع دستی",price:1850000,city:"سنندج",seller:"خانه گلیم",emoji:"🧶",description:"بافت سنتی و رنگ طبیعی"},
 {id:7,title:"ادویه محلی",category:"خوراکی",price:165000,city:"بندرعباس",seller:"فاطمه دریایی",emoji:"🫙",description:"ترکیب ادویه جنوبی"},
 {id:8,title:"محصولات چوبی",category:"خانه و زندگی",price:690000,city:"رشت",seller:"چوبینه",emoji:"🪵",description:"ساخته‌شده از چوب طبیعی"}
];
const key="bazaarak_demo_products";
let products=[...demoProducts,...JSON.parse(localStorage.getItem(key)||"[]")];
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("fa-IR").format(n)+" تومان";
function initFilters(){
 const cities=[...new Set(products.map(p=>p.city))].sort();
 const cats=[...new Set(products.map(p=>p.category))].sort();
 $("#city").innerHTML='<option value="">همه شهرها</option>'+cities.map(x=>`<option>${x}</option>`).join("");
 $("#category").innerHTML='<option value="">همه دسته‌ها</option>'+cats.map(x=>`<option>${x}</option>`).join("");
}
function render(){
 const q=$("#search").value.trim().toLowerCase(),city=$("#city").value,cat=$("#category").value;
 const filtered=products.filter(p=>(!q||[p.title,p.seller,p.city].some(x=>x.toLowerCase().includes(q)))&&(!city||p.city===city)&&(!cat||p.category===cat));
 $("#resultCount").textContent=new Intl.NumberFormat("fa-IR").format(filtered.length)+" محصول";
 $("#productGrid").innerHTML=filtered.length?filtered.map(p=>`<article class="product"><div class="product-art">${p.emoji||"📦"}</div><div class="product-body"><span class="tag">${p.category}</span><h3>${escapeHtml(p.title)}</h3><div class="seller">فروشنده: ${escapeHtml(p.seller)}</div><div class="location">📍 ${escapeHtml(p.city)} · تحویل حضوری</div><div class="price-row"><div class="price">${money(p.price)}</div><button class="buy" data-buy="${p.id}">درخواست خرید</button></div></div></article>`).join(""):'<div class="empty">محصولی با این مشخصات پیدا نشد.</div>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("#search").addEventListener("input",render);$("#city").addEventListener("change",render);$("#category").addEventListener("change",render);
$("#sellBtn").onclick=()=>$("#productDialog").showModal();
$("#loginBtn").onclick=()=>alert("ورود و ثبت‌نام دعوت‌محور در مرحله اتصال به API پیاده‌سازی می‌شود.");
$("#productGrid").addEventListener("click",e=>{
 const id=Number(e.target.dataset.buy);if(!id)return;
 const p=products.find(x=>x.id===id);$("#orderSummary").innerHTML=`<div class="order-summary"><b>${escapeHtml(p.title)}</b><p>${escapeHtml(p.city)} · ${money(p.price)}</p><small>فروشنده: ${escapeHtml(p.seller)}</small></div>`;
 $("#orderForm").dataset.productId=id;$("#orderDialog").showModal();
});
$("#productForm").addEventListener("submit",e=>{
 e.preventDefault();const d=new FormData(e.target);
 const title=String(d.get("title")||"").trim();
 const city=String(d.get("city")||"").trim();
 const seller=String(d.get("seller")||"").trim();
 const category=String(d.get("category")||"خوراکی").trim();
 const description=String(d.get("description")||"").trim();
 const price=Math.round(Number(d.get("price")));
 if(!title||!city||!seller||price<=0||Number.isNaN(price)){
  alert("لطفاً تمام اطلاعات محصول را به درستی وارد کنید (قیمت باید بزرگتر از صفر باشد).");
  return;
 }
 const p={id:Date.now(),title,price,city,category,seller,description,emoji:"📦"};
 products.push(p);const demoIds=new Set(demoProducts.map(d=>d.id));
 const custom=products.filter(x=>!demoIds.has(x.id));
 localStorage.setItem(key,JSON.stringify(custom));initFilters();render();e.target.reset();$("#productDialog").close();
});
$("#orderForm").addEventListener("submit",e=>{
 e.preventDefault();alert("درخواست خرید به‌صورت نمایشی ثبت شد. در نسخه عملیاتی، این درخواست به فروشنده ارسال می‌شود. هیچ پولی واریز نکنید.");
 e.target.reset();$("#orderDialog").close();
});
initFilters();render();
