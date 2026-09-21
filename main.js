(function(){

/* ---------------- Color helpers ---------------- */
const COLOR_META = {
  W:{name:'Branco', bg:'linear-gradient(160deg,#f4ecd2,#cdbd88)', pip:'#d9c145'},
  U:{name:'Azul',   bg:'linear-gradient(160deg,#5f93c9,#1f4874)', pip:'#3c6ea5'},
  B:{name:'Preto',  bg:'linear-gradient(160deg,#59505f,#181319)', pip:'#2a2430'},
  R:{name:'Vermelho', bg:'linear-gradient(160deg,#d3775a,#7a2418)', pip:'#9c3a2a'},
  G:{name:'Verde',  bg:'linear-gradient(160deg,#7cab5f,#254a22)', pip:'#3c6b3a'},
  M:{name:'Multicolor', bg:'linear-gradient(160deg,#e8c25e,#8a6620)', pip:'#b6862c'},
  C:{name:'Incolor', bg:'linear-gradient(160deg,#c9c2b4,#7d7568)', pip:'#6b6255'},
  L:{name:'Terreno', bg:'linear-gradient(160deg,#b7a06e,#5b4a2c)', pip:'#8a7245'}
};
const RARITY_META = {
  common:{label:'Comum', color:'#b8ae9c', band:[0.5,1.8]},
  uncommon:{label:'Incomum', color:'#b9c2c9', band:[2,7]},
  rare:{label:'Rara', color:'#d8b84a', band:[7,35]},
  mythic:{label:'Mítica', color:'#d4794a', band:[18,90]}
};
/* estimated reference prices for known chase cards (BRL, non-foil) */
const PRICE_OVERRIDE = {
  "Smaug, the Great Calamity": 62,
  "Smaug the Magnificent": 185,
  "Dáin Ironfoot": 16,
  "Thranduil, Sindarin Liege": 11,
  "The Lonely Mountain": 13,
  "My Precious": 9,
  "An Unexpected Party // At the Door": 15,
  "Tom, Bert, and William": 12,
  "The Misty Mountains Cold": 10,
  "Fateful Discovery": 22
};

function hash(str){ let h=0; for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i))|0; } return Math.abs(h); }
function basePrice(card){
  if(PRICE_OVERRIDE[card.name] != null) return PRICE_OVERRIDE[card.name];
  const band = RARITY_META[card.rarity].band;
  const t = (hash(card.name) % 1000)/1000;
  return Math.round((band[0] + t*(band[1]-band[0]))*100)/100;
}
function foilMultiplier(rarity){
  return rarity === 'common' ? 4.5 : rarity === 'uncommon' ? 3.4 : rarity === 'rare' ? 2.2 : 1.6;
}
function fmtBRL(v){ return 'R$ ' + v.toFixed(2).replace('.', ','); }

/* ---------------- Card pool ----------------
   Real names/costs/types/rarities from Magic: The Gathering — The Hobbit (set HOB). */
const POOL = {
  common: [
    {name:"Boughside Wanderers", cost:"2G", color:"G", type:"Criatura — Elfo Batedor", pt:"3/3", rules:"Ao entrar, olhe as 4 cartas do topo do grimório; pode revelar um permanente e colocá-lo na mão."},
    {name:"Gundabad Opportunist", cost:"1B", color:"B", type:"Criatura — Orc Batedor", pt:"2/1", rules:"Ataque furtivo — causa dano extra se for a única criatura atacante."},
    {name:"Cantankerous Keepers", cost:"2GG", color:"G", type:"Criatura — Elfo Soldado", pt:"3/4", rules:"Defensor. Enquanto defende, seus bloqueios não podem ser destruídos por dano de combate."},
    {name:"Bejeweled Warg", cost:"3R", color:"R", type:"Criatura — Lobo", pt:"4/3", rules:"Assombroso. Entra tapado se você controla menos de três terrenos."},
    {name:"Stone-Giant of High Pass", cost:"5R", color:"R", type:"Criatura — Gigante", pt:"6/5", rules:"Ao entrar, cause 2 de dano a um oponente — as montanhas tremem."},
    {name:"Gigantic Big Bear", cost:"4G", color:"G", type:"Criatura — Urso", pt:"5/5", rules:"Trampa. Este é um urso muito grande."},
    {name:"Woodland Weavemaster", cost:"2G", color:"G", type:"Criatura — Aranha", pt:"2/4", rules:"Alcance. Enreda — criaturas bloqueadas por esta não desenroscam no próximo turno."},
    {name:"Mirkwood Pathmaker", cost:"1G", color:"G", type:"Criatura — Elfo Batedor", pt:"1/2", rules:"Ao entrar, procure um terreno básico Floresta e coloque-o virado na mão."},
    {name:"Lake-town Lookout", cost:"1U", color:"U", type:"Criatura — Humano Cidadão", pt:"1/3", rules:"Sempre que outra criatura entra sob seu controle, compre uma carta se for a primeira vez neste turno."},
    {name:"Attercop", cost:"2B", color:"B", type:"Criatura — Aranha", pt:"3/2", rules:"Veneno. Quando esta criatura morre, cada oponente perde 1 de vida."},
    {name:"Getaway Barrel", cost:"2", color:"C", type:"Artefato", rules:"Vinculado — anexe a uma criatura. A criatura anexada não pode ser bloqueada quando ataca sozinha."},
    {name:"Old Fat Spider", cost:"3B", color:"B", type:"Criatura — Aranha", pt:"3/5", rules:"Ao bloquear, esta criatura envenena a criatura bloqueada."},
    {name:"Wood Elves", cost:"3G", color:"G", type:"Criatura — Elfo Batedor", pt:"2/3", rules:"Ao entrar, procure uma Floresta e coloque-a tapada no campo."},
    {name:"Through the Forest Gate", cost:"2G", color:"G", type:"Feitiço", rules:"Compre duas cartas. Se você controla um terreno lendário, compre mais uma."},
    {name:"Part in Friendship", cost:"1W", color:"W", type:"Encantamento", rules:"Sempre que uma criatura que você controla deixa o campo, ganhe 1 de vida."},
    {name:"Great Ugly-Looking Goblin // Clap! Snap!", cost:"5B // 1B", color:"B", type:"Criatura // Feitiço — Aventura", pt:"4/4", rules:"Clap! Snap! — cause 3 de dano a uma criatura alvo. Depois lance a criatura do exílio."}
  ],
  uncommon: [
    {name:"Glóin the Mighty // Easy Pickings", cost:"3R // 2R", color:"R", type:"Criatura Lendária // Feitiço — Aventura", pt:"4/3", rules:"Easy Pickings — ganhe controle de um artefato ou tesouro alvo com custo 2 ou menor até o final do turno."},
    {name:"Thranduil, Sindarin Liege", cost:"2UG", color:"M", type:"Criatura Lendária — Elfo Nobre", pt:"3/4", rules:"Outras criaturas Elfo que você controla recebem +1/+1. {T}: procure uma carta de Floresta ou Ilha."},
    {name:"Dwalin, Weaponmaster", cost:"2WW", color:"W", type:"Criatura Lendária — Anão Guerreiro", pt:"3/3", rules:"Vínculo com a vida. Equipamentos anexados a esta criatura custam {1} a menos para equipar."},
    {name:"Radagast of Rhosgobel", cost:"2GG", color:"G", type:"Criatura Lendária — Avatar Feiticeiro", pt:"2/4", rules:"{T}: crie uma ficha de criatura 1/1 verde Pássaro com voar."}
  ],
  rare: [
    {name:"An Unexpected Party // At the Door", cost:"2WW // X2W", color:"W", type:"Encantamento // Feitiço — Aventura", rules:"At the Door — crie X fichas 1/1 brancas Anão com vínculo com a vida."},
    {name:"Most Decrepit Old Bird // Speak Secrets", cost:"U // 1U", color:"U", type:"Criatura // Feitiço — Aventura", pt:"1/1", rules:"Speak Secrets — olhe as 3 cartas do topo do grimório de um oponente; exile uma virada para baixo."},
    {name:"My Precious", cost:"1", color:"C", type:"Artefato — Equipamento", rules:"A criatura equipada tem proteção contra tudo e não pode ser bloqueada. Equipar {3}, pague 2 de vida."},
    {name:"Allure of Power", cost:"2U", color:"U", type:"Feitiço", rules:"Custo adicional: sacrifique uma criatura. Compre duas cartas."},
    {name:"Tom, Bert, and William", cost:"3GB", color:"M", type:"Criatura Lendária — Troll", pt:"5/5", rules:"Ameaça. Se seria destruída, exile-a até o amanhecer em vez disso."},
    {name:"Dáin Ironfoot", cost:"3RW", color:"M", type:"Criatura Lendária — Anão Guerreiro", pt:"4/4", rules:"Outros Anões que você controla recebem +1/+1 e têm ameaça."},
    {name:"The Misty Mountains Cold", cost:"1B", color:"B", type:"Encantamento — Saga", rules:"I, II — cada oponente perde 1 de vida, você ganha 1. III — crie uma cópia da criatura mais forte no seu cemitério."}
  ],
  mythic: [
    {name:"Fateful Discovery", cost:"3", color:"C", type:"Encantamento", rules:"Sempre que um artefato entra sob seu controle, compre uma carta."},
    {name:"Smaug, the Great Calamity", cost:"4RR", color:"R", type:"Criatura Lendária — Dragão", pt:"7/6", rules:"Voar. Ao entrar, cause 6 de dano dividido entre até dois alvos. Ataque de fogo destrói terrenos não-básicos."},
    {name:"Smaug the Magnificent", cost:"2RR", color:"R", type:"Criatura Lendária — Dragão", pt:"6/6", rules:"Voar, ímpeto. Ao atacar, causa dano igual ao número de Tesouros que você controla a um alvo. No início da sua manutenção, crie um Tesouro."}
  ]
};
const LANDS_BASIC = [
  {name:"Plains", color:"W", type:"Terreno Básico — Planície", rules:""},
  {name:"Forest", color:"G", type:"Terreno Básico — Floresta", rules:""},
  {name:"Mountain", color:"R", type:"Terreno Básico — Montanha", rules:""}
];
const LANDS_SPECIAL = [
  {name:"The Lonely Mountain", cost:"—", color:"L", type:"Terreno", rules:"Entra tapado a menos que você controle um Equipamento. {T}, pague 2: crie uma ficha 2/2 vermelha Anão."},
  {name:"Hobbit Hole", cost:"—", color:"L", type:"Terreno", rules:"Sacrifique este terreno: procure um terreno básico, coloque-o tapado no campo e embaralhe.", flavor:"Em um buraco no chão vivia um Hobbit..."}
];

const ALL_CARDS = [...POOL.common, ...POOL.uncommon, ...POOL.rare, ...POOL.mythic, ...LANDS_BASIC, ...LANDS_SPECIAL];

/* ---------------- Collection (persisted in this browser via localStorage) ---------------- */
const COLL_KEY = 'hobbit_hob_collection_v1';

function loadCollection(){
  try{
    const raw = localStorage.getItem(COLL_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function saveCollection(coll){
  try{ localStorage.setItem(COLL_KEY, JSON.stringify(coll)); }catch(e){ /* storage unavailable, ignore */ }
}
function addToCollection(card){
  const coll = loadCollection();
  const existing = coll[card.name];
  if(!existing || (card.isFoil && !existing.isFoil)){
    coll[card.name] = {
      name:card.name, color:card.color, rarity:card.rarity, cost:card.cost,
      type:card.type, price:card.price, isFoil:card.isFoil
    };
    saveCollection(coll);
  }
  renderCollection();
}

const RARITY_ORDER = {mythic:0, rare:1, uncommon:2, common:3};
function renderCollection(){
  const coll = loadCollection();
  const entries = Object.values(coll).sort((a,b) => (RARITY_ORDER[a.rarity]-RARITY_ORDER[b.rarity]) || a.name.localeCompare(b.name));
  collCount.textContent = `${entries.length} / ${ALL_CARDS.length} cartas descobertas`;
  if(entries.length === 0){
    collGrid.innerHTML = '<span class="coll-empty">abra um booster pra começar sua coleção</span>';
    return;
  }
  collGrid.innerHTML = entries.map(c => {
    const meta = COLOR_META[c.color] || COLOR_META.C;
    return `<div class="coll-card r-${c.rarity} ${c.isFoil?'is-foil':''}" style="background:${meta.bg}" title="${c.name} — ${fmtBRL(c.price)}${c.isFoil?' (foil)':''}">
      ${c.isFoil ? '<span class="coll-star">✦</span>' : ''}
      <span class="coll-name">${c.name.split(' // ')[0]}</span>
    </div>`;
  }).join('');
}

/* ---------------- Pack generation ---------------- */
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function pickMany(arr, n){
  const pool = [...arr]; const out = [];
  for(let i=0;i<n;i++){
    if(pool.length === 0) pool.push(...arr);
    const idx = Math.floor(Math.random()*pool.length);
    out.push(pool[idx]); pool.splice(idx,1);
  }
  return out;
}

function generateBooster(){
  const cards = [];
  cards.push(...pickMany(POOL.common, 10).map(c => ({...c, rarity:'common'})));
  cards.push(...pickMany(POOL.uncommon, 3).map(c => ({...c, rarity:'uncommon'})));

  const wantsSpecialLand = Math.random() < 0.2;
  const landCard = wantsSpecialLand ? pick(LANDS_SPECIAL) : pick(LANDS_BASIC);
  cards.push({...landCard, rarity: wantsSpecialLand ? 'rare' : 'common', cost:landCard.cost||"—"});

  const isMythic = Math.random() < (1/8);
  const rc = isMythic ? pick(POOL.mythic) : pick(POOL.rare);
  cards.push({...rc, rarity:isMythic?'mythic':'rare'});
  // fixed presentation order: commons -> uncommons -> land -> rare/mythic (climax last)

  cards.forEach(c => { c.isFoil = false; });
  // guaranteed foil: 1 per booster, any slot
  const foilIdx = new Set();
  foilIdx.add(Math.floor(Math.random()*cards.length));
  // small chance of extra foils
  if(Math.random() < 0.10){
    let extra;
    do{ extra = Math.floor(Math.random()*cards.length); } while(foilIdx.has(extra));
    foilIdx.add(extra);
    if(Math.random() < 0.02){
      let extra2;
      do{ extra2 = Math.floor(Math.random()*cards.length); } while(foilIdx.has(extra2));
      foilIdx.add(extra2);
    }
  }
  foilIdx.forEach(i => cards[i].isFoil = true);

  cards.forEach(c => {
    c.base = basePrice(c);
    c.price = c.isFoil ? Math.round(c.base*foilMultiplier(c.rarity)*100)/100 : c.base;
  });

  return cards;
}

/* ---------------- Rendering ---------------- */
function pipHTML(costStr){
  if(!costStr || costStr === "—") return '<span class="pip" style="background:#8a7245">T</span>';
  const seg = costStr.split('//')[0].trim();
  const matches = seg.match(/[0-9]+|[WUBRGX]/g) || [];
  return matches.slice(0,5).map(tok => {
    if(/^[0-9]+$/.test(tok) || tok==='X') return `<span class="pip" style="background:#3a3128">${tok}</span>`;
    const meta = COLOR_META[tok] || COLOR_META.C;
    return `<span class="pip" style="background:${meta.pip}">${tok}</span>`;
  }).join('');
}
function artSVG(color, seed){
  const rnd = (min,max)=> min + (seed%97)/97*(max-min);
  const hues = { W:['#eadfba','#c9b57a'], U:['#3a638f','#1c3a57'], B:['#2c2733','#100d14'], R:['#8f3a26','#4a190f'], G:['#3a6338','#173316'], M:['#8a6620','#4a3510'], C:['#7d7568','#413c34'], L:['#5b4a2c','#2c2313'] };
  const [top,bot] = hues[color] || hues.C;
  return `<svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%">
    <defs><linearGradient id="g${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs>
    <rect width="120" height="90" fill="url(#g${seed})"/>
    <circle cx="${18+rnd(0,10)}" cy="${20+rnd(0,8)}" r="${10+rnd(0,6)}" fill="rgba(255,255,255,0.12)"/>
    <path d="M0 68 L20 46 L34 60 L52 40 L70 62 L88 44 L104 60 L120 50 L120 90 L0 90 Z" fill="rgba(0,0,0,0.35)"/>
    <path d="M0 78 L24 60 L44 74 L64 54 L86 74 L104 58 L120 70 L120 90 L0 90 Z" fill="rgba(0,0,0,0.5)"/>
  </svg>`;
}
function cardFrontHTML(card, idx){
  const meta = COLOR_META[card.color] || COLOR_META.C;
  const rmeta = RARITY_META[card.rarity];
  const flavor = card.flavor ? `<span class="flavor">${card.flavor}</span>` : '';
  return `
    <div class="frame" style="background:${meta.bg}">
      <div class="namebar"><span class="nm">${card.name.split(' // ')[0]}</span><span class="cost">${pipHTML(card.cost)}</span></div>
      <div class="art">${artSVG(card.color, idx+7)}</div>
      <div class="typebar"><span>${card.type.split(' // ')[0]}</span><span class="rgem" style="color:${rmeta.color};background:${rmeta.color}"></span></div>
      <div class="textbox"><span class="rules">${card.rules || ''}</span>${flavor}</div>
      ${card.pt ? `<div class="ptbox">${card.pt}</div>` : ''}
      <div class="pricetag">${fmtBRL(card.price)}</div>
    </div>`;
}

/* ---------------- State machine ---------------- */
let booster = [];
let idx = 0; // current top-of-stack index, 0..14
let openCount = 0;
let revealed = []; // cards already flipped, for strip + summary

const stackZone = document.getElementById('stackZone');
const packZone = document.getElementById('packZone');
const revealZone = document.getElementById('revealZone');
const packEl = document.getElementById('packEl');
const openBtn = document.getElementById('openBtn');
const countNote = document.getElementById('countNote');
const progNote = document.getElementById('progNote');
const tapHint = document.getElementById('tapHint');
const detail = document.getElementById('detail');
const revealAllBtn = document.getElementById('revealAllBtn');
const againBtn = document.getElementById('againBtn');
const collectedWrap = document.getElementById('collectedWrap');
const strip = document.getElementById('strip');
const summary = document.getElementById('summary');
const totalPrice = document.getElementById('totalPrice');
const summarySub = document.getElementById('summarySub');
const stageEl = document.getElementById('stageEl');
const mythicFlash = document.getElementById('mythicFlash');
const collGrid = document.getElementById('collGrid');
const collCount = document.getElementById('collCount');
const clearCollBtn = document.getElementById('clearCollBtn');

function buildStack(){
  stackZone.innerHTML = '';
  booster.forEach((card, i) => {
    const off = i - idx; // 0 = top card
    const el = document.createElement('div');
    el.className = 'stack-card';
    el.style.zIndex = 100 - i;
    el.style.display = off < 0 ? 'none' : (off > 4 ? 'none' : 'block');
    const dx = Math.min(off,4) * 3;
    const dy = Math.min(off,4) * -4;
    const rot = (off===0) ? 0 : (i%2===0 ? 2 : -2) * Math.min(off,4)/2;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    el.innerHTML = `
      <div class="mcard flipped" data-i="${i}">
        <div class="mface mback"><span>HOB</span></div>
        <div class="mface mfront r-${card.rarity} ${card.isFoil?'is-foil':''}">
          ${card.isFoil ? '<div class="foil-badge">FOIL</div>' : ''}
          ${cardFrontHTML(card, i)}
        </div>
      </div>`;
    if(off === 0){
      const mcard = el.querySelector('.mcard');
      mcard.addEventListener('click', () => advance());
    }
    stackZone.appendChild(el);
  });
}

function updateTop(){
  buildStack();
  if(idx >= booster.length) return;
  const card = booster[idx];
  progNote.textContent = `carta ${idx+1} de 15`;
  tapHint.textContent = 'toque na carta pra ver a próxima';
  showDetail(card);
  if(card.rarity === 'mythic' && !card._mythicShown){
    card._mythicShown = true;
    const topMcard = stackZone.querySelector('.stack-card .mcard');
    setTimeout(() => triggerMythic(topMcard), 120);
  }
}

function triggerMythic(mcard){
  mcard.classList.add('mythic-pop');
  stageEl.classList.add('shake');
  mythicFlash.classList.add('go');
  spawnEmbers();
  setTimeout(()=> stageEl.classList.remove('shake'), 500);
  setTimeout(()=> mythicFlash.classList.remove('go'), 1000);
  setTimeout(()=> mcard.classList.remove('mythic-pop'), 1000);
}

function spawnEmbers(){
  for(let i=0;i<22;i++){
    const e = document.createElement('div');
    e.className = 'ember';
    const x = 20 + Math.random()*60;
    e.style.left = x + 'vw';
    document.body.appendChild(e);
    e.animate([
      { transform:'translateY(0) scale(1)', opacity:1 },
      { transform:`translateY(-${220+Math.random()*180}px) translateX(${(Math.random()-0.5)*80}px) scale(0.3)`, opacity:0 }
    ], { duration: 900+Math.random()*500, easing:'ease-out' });
    setTimeout(()=> e.remove(), 1500);
  }
}

function showDetail(card){
  const rmeta = RARITY_META[card.rarity];
  const cmeta = COLOR_META[card.color] || COLOR_META.C;
  detail.innerHTML = `
    <h3>${card.name}${card.isFoil ? ' ✦ (foil)' : ''}</h3>
    <p>${card.type} ${card.pt ? '· '+card.pt : ''} ${card.cost && card.cost!=='—' ? '· Custo: '+card.cost.replace(/\/\//g,'/') : ''}</p>
    <p>${card.rules || ''}</p>
    ${card.flavor ? `<p style="font-style:italic;color:#a7987a">${card.flavor}</p>` : ''}
    <span class="tag" style="background:${rmeta.color}22;color:${rmeta.color};border:1px solid ${rmeta.color}66">${rmeta.label}</span>
    <span class="tag" style="background:${cmeta.pip}22;color:${cmeta.pip};border:1px solid ${cmeta.pip}66">${cmeta.name}</span>
    <div class="price">${fmtBRL(card.price)} <span style="font-size:0.65em;color:#a7987a">(estimado${card.isFoil ? ', foil' : ''})</span></div>
  `;
  detail.classList.add('show');
}

function pushChip(card){
  const chip = document.createElement('div');
  chip.className = `chip r-${card.rarity} ${card.isFoil?'foil':''}`;
  const meta = COLOR_META[card.color] || COLOR_META.C;
  chip.style.background = meta.bg;
  chip.title = card.name + ' — ' + fmtBRL(card.price);
  strip.appendChild(chip);
}

function advance(){
  revealed.push(booster[idx]);
  pushChip(booster[idx]);
  addToCollection(booster[idx]);
  collectedWrap.style.display = 'block';
  idx += 1;
  if(idx >= booster.length){
    finishBooster();
    return;
  }
  updateTop();
}

function finishBooster(){
  progNote.textContent = `15 de 15 reveladas`;
  tapHint.textContent = 'booster completo';
  stackZone.innerHTML = '';
  detail.classList.remove('show');
  revealAllBtn.style.display = 'none';
  againBtn.style.display = 'inline-block';
  const total = booster.reduce((s,c)=> s+c.price, 0);
  const foilsCount = booster.filter(c=>c.isFoil).length;
  const rareOrBetter = booster.find(c => c.rarity==='rare' || c.rarity==='mythic');
  totalPrice.textContent = fmtBRL(total);
  summarySub.textContent = `${foilsCount} foil${foilsCount>1?'s':''} · carta de destaque: ${rareOrBetter.name}`;
  summary.style.display = 'block';
}

function revealAllInstant(){
  while(idx < booster.length){
    revealed.push(booster[idx]);
    pushChip(booster[idx]);
    addToCollection(booster[idx]);
    idx += 1;
  }
  collectedWrap.style.display = 'block';
  finishBooster();
}

/* ---------------- Pack open flow ---------------- */
function spawnBurst(){
  const burst = document.createElement('div');
  burst.className = 'burst';
  packEl.appendChild(burst);
  for(let i=0;i<18;i++){
    const m = document.createElement('div');
    m.className = 'mote';
    const angle = Math.random()*Math.PI*2;
    const dist = 60 + Math.random()*90;
    m.style.left = '50%'; m.style.top = '45%';
    m.animate([
      { transform:'translate(0,0) scale(1)', opacity:1 },
      { transform:`translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px) scale(0.3)`, opacity:0 }
    ], { duration: 650 + Math.random()*300, easing:'cubic-bezier(.2,.7,.3,1)' });
    burst.appendChild(m);
  }
  setTimeout(()=> burst.remove(), 1000);
}

function openPack(){
  openBtn.disabled = true;
  packEl.animate([
    { transform:'rotate(-2deg) scale(1)' },
    { transform:'rotate(-2deg) scale(1.06)' },
    { transform:'rotate(-2deg) scale(0.9)', opacity:0.3 }
  ], { duration:420, easing:'ease-in' });
  spawnBurst();

  setTimeout(() => {
    openCount += 1;
    countNote.textContent = `Boosters abertos nesta sessão: ${openCount}`;
    booster = generateBooster();
    idx = 0; revealed = [];
    strip.innerHTML = ''; collectedWrap.style.display = 'none';
    summary.style.display = 'none';
    revealAllBtn.style.display = 'inline-block';
    againBtn.style.display = 'none';
    packZone.style.display = 'none';
    revealZone.classList.add('show');
    updateTop();
    openBtn.disabled = false;
  }, 430);
}

openBtn.addEventListener('click', openPack);
packEl.addEventListener('click', openPack);
revealAllBtn.addEventListener('click', revealAllInstant);

againBtn.addEventListener('click', () => {
  revealZone.classList.remove('show');
  packZone.style.display = 'flex';
  packEl.style.opacity = 1;
  packEl.animate([
    { transform:'rotate(-2deg) scale(0.85)', opacity:0 },
    { transform:'rotate(-2deg) scale(1)', opacity:1 }
  ], { duration:350, easing:'ease-out' });
});

clearCollBtn.addEventListener('click', () => {
  if(confirm('Limpar toda a sua coleção salva neste navegador?')){
    saveCollection({});
    renderCollection();
  }
});

renderCollection();

})();
