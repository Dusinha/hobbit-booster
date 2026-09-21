(function(){

/* ================================================================
   MTG BOOSTER — Caixas de pacotinhos multi-edição
   Busca TODAS as cartas de cada edição configurada em SETS direto na
   Scryfall (busca paginada, unique=prints) e usa esse pool real pra
   sortear uma "caixa" de 30 pacotinhos, cada um com 14 cartas, seguindo
   as probabilidades OFICIAIS de um Play Booster publicadas em
   magic.wizards.com/en/news/feature/collecting-the-hobbit:
     7 comuns · 3 incomuns · 1 curinga (qualquer raridade, majoritariamente
     comum) · 1 rara/mítica garantida · 1 carta em foil tradicional
     (qualquer raridade) · 1 terreno básico (às vezes em foil)
   Cada carta guarda se saiu em foil (isFoil) pra mostrar o preço certo:
   preço foil quando `isFoil` é true, preço normal caso contrário.
   Doc da busca: https://scryfall.com/docs/api/cards/search

   A Loja mostra uma caixa por edição configurada em SETS (hoje: The
   Hobbit e Reality Fracture). Ao abrir uma caixa, os 30 pacotinhos vão
   pro ESTOQUE (não são revelados de uma vez), marcados com a edição de
   origem. O jogador abre um pacotinho por vez a partir do estoque, e as
   14 cartas são reveladas uma a uma numa janela de revelação; ao abrir
   um pacotinho, suas cartas entram direto na coleção (agrupada por
   edição na aba Coleção).

   Cada caixa custa 1 moeda. O jogador ganha 1 moeda por dia clicando em
   "Coletar moeda do dia" (reseta à meia-noite, um clique por dia).

   As moedas, o estoque, a coleção (cartas já encontradas) e a data da
   última coleta de moeda ficam salvos no localStorage do navegador —
   não há login/servidor.
   ================================================================ */

/* Edições disponíveis na Loja. Pra adicionar uma nova coleção, basta
   incluir mais uma entrada aqui com o código do set na Scryfall. */
const SETS = [
  { code:'hob', name:'The Hobbit', mark:'HOB', boxImage:'../imagens/HOB - BOX.png', packImage:'../imagens/HOB - BOOSTER.png' },
  { code:'fra', name:'Reality Fracture', mark:'FRA', boxImage:'../imagens/FRC - BOX.png', packImage:'../imagens/FRC - BOOSTER.png' }
];
const SET_BY_CODE = Object.fromEntries(SETS.map(s => [s.code, s]));

const RARITY_META = {
  common:{label:'Comum', color:'#b8ae9c'},
  uncommon:{label:'Incomum', color:'#b9c2c9'},
  rare:{label:'Rara', color:'#d8b84a'},
  mythic:{label:'Mítica', color:'#d4794a'},
  special:{label:'Especial', color:'#d8b84a'},
  bonus:{label:'Bônus', color:'#d4794a'}
};
const RARITY_ORDER = {mythic:0, rare:1, special:1, uncommon:2, common:3, bonus:3};

const SLOT_META = {
  common:'Comum',
  uncommon:'Incomum',
  rareMythic:'Rara/Mítica garantida',
  wildcard:'Curinga',
  foil:'Foil garantido',
  land:'Terreno básico'
};

/* Preço exibido é sempre o retornado pela Scryfall (campo prices.usd / prices.usd_foil). */
function fmtUSD(v){
  if(v == null) return 'preço indisponível';
  return '$' + Number(v).toFixed(2);
}

const PACKS_PER_BOX = 30;

/* Cache guarda um objeto { [setCode]: { timestamp, cards } } — assim cada
   edição tem sua própria janela de validade sem sobrescrever as outras. */
const LEGACY_SET_CACHE_KEY = 'hobbitBoosterSetCache';
const SET_CACHE_KEY = 'magicBoosterSetCache';
const SET_CACHE_TTL = 6 * 60 * 60 * 1000; // 6h — dá tempo dos preços da Scryfall atualizarem
/* Coleção e estoque continuam num único armazenamento global: os ids de
   carta da Scryfall são únicos entre edições, então não há risco de
   colisão mesmo guardando cartas de vários sets juntas — e assim a
   coleção/mochila já mostram tudo junto, agrupado por edição na hora de
   renderizar. */
const LEGACY_COLLECTION_KEY = 'hobbitBoosterCollection';
const COLLECTION_KEY = 'magicBoosterCollection';
const LEGACY_STOCK_KEY = 'hobbitBoosterStock'; // pacotinhos já recebidos mas ainda não abertos
const STOCK_KEY = 'magicBoosterStock';
const LEGACY_COIN_BALANCE_KEY = 'hobbitBoosterCoins';
const COIN_BALANCE_KEY = 'magicBoosterCoins';
const LEGACY_LAST_COIN_CLAIM_KEY = 'hobbitBoosterLastCoinClaim';
const LAST_COIN_CLAIM_KEY = 'magicBoosterLastCoinClaim';
const BOX_PRICE = 1; // em moedas

function migrateLegacyStorageKeys(){
  const migrations = [
    [LEGACY_SET_CACHE_KEY, SET_CACHE_KEY],
    [LEGACY_COLLECTION_KEY, COLLECTION_KEY],
    [LEGACY_STOCK_KEY, STOCK_KEY],
    [LEGACY_COIN_BALANCE_KEY, COIN_BALANCE_KEY],
    [LEGACY_LAST_COIN_CLAIM_KEY, LAST_COIN_CLAIM_KEY]
  ];

  for (const [legacyKey, currentKey] of migrations){
    try{
      const legacyValue = localStorage.getItem(legacyKey);
      if(legacyValue !== null && localStorage.getItem(currentKey) === null){
        localStorage.setItem(currentKey, legacyValue);
      }
    }catch(e){ /* localStorage indisponível ou bloqueado — ignora a migração */ }
  }
}

migrateLegacyStorageKeys();

/* ---------------- Busca na Scryfall ---------------- */

/* Busca TODAS as cartas do set na Scryfall, seguindo a paginação
   (has_more / next_page) até acabar. unique=prints traz toda impressão
   distinta (incluindo versões full art / showcase de terrenos básicos
   e cartas especiais), não só uma arte "canônica" por nome. */
async function fetchFullSet(setCode){
  let url = `https://api.scryfall.com/cards/search?q=set%3A${setCode}&unique=prints&order=set`;
  const cards = [];
  while(url){
    const response = await fetch(url, { headers:{ Accept:'application/json' } });
    if(response.status === 404){
      // Scryfall responde 404 quando a busca não encontra nada (não é um erro real).
      break;
    }
    if(!response.ok){
      throw new Error(`Falha ao buscar o set na Scryfall (${response.status}).`);
    }
    const data = await response.json();
    cards.push(...(data.data || []));
    url = data.has_more ? data.next_page : null;
  }
  return cards;
}

/* Normaliza a resposta da Scryfall pros campos que a página precisa exibir/sortear. */
function normalizeCard(apiCard){
  const face = apiCard.card_faces?.[0];
  return {
    id:apiCard.id,
    name:apiCard.name,
    setName:apiCard.set_name,
    setCode:apiCard.set,
    collectorNumber:apiCard.collector_number,
    cost:apiCard.mana_cost || face?.mana_cost || '',
    type:apiCard.type_line || face?.type_line || '',
    pt:apiCard.power && apiCard.toughness ? `${apiCard.power}/${apiCard.toughness}` : undefined,
    rules:apiCard.oracle_text || face?.oracle_text || '',
    flavor:apiCard.flavor_text || face?.flavor_text || '',
    rarity:apiCard.rarity in RARITY_META ? apiCard.rarity : 'common',
    priceUsd:apiCard.prices?.usd != null ? Number(apiCard.prices.usd) : null,
    priceFoil:apiCard.prices?.usd_foil != null ? Number(apiCard.prices.usd_foil) : null,
    /* Algumas versões (ex: "surge foil") só existem em foil — não há versão
       normal pra vender, então nem faz sentido mostrar dois preços. */
    isFoilOnly:Array.isArray(apiCard.finishes) && apiCard.finishes.includes('foil') && !apiCard.finishes.includes('nonfoil'),
    imageUri:apiCard.image_uris?.normal || face?.image_uris?.normal,
    scryfallUri:apiCard.scryfall_uri,
    isFullArt:!!apiCard.full_art,
    isBorderless:apiCard.border_color === 'borderless',
    isBasicLand:/Basic Land/.test(apiCard.type_line || face?.type_line || '')
  };
}

function loadSetCacheStore(){
  try{
    const store = JSON.parse(localStorage.getItem(SET_CACHE_KEY));
    return store && typeof store === 'object' ? store : {};
  }catch(e){ return {}; }
}
function saveSetCacheEntry(setCode, entry){
  try{
    const store = loadSetCacheStore();
    store[setCode] = entry;
    localStorage.setItem(SET_CACHE_KEY, JSON.stringify(store));
  }catch(e){ /* quota do localStorage estourada — sem cache, sem problema */ }
}

/* Busca o set (já normalizado) guardando em cache local por algumas horas,
   pra não ficar batendo na API toda hora que a página recarrega. Cada
   edição tem sua própria entrada de cache. */
async function loadNormalizedSet(setCode){
  try{
    const cached = loadSetCacheStore()[setCode];
    if(cached && (Date.now() - cached.timestamp) < SET_CACHE_TTL
       && Array.isArray(cached.cards) && cached.cards.length){
      return cached.cards;
    }
  }catch(e){ /* cache corrompido ou indisponível, ignora e busca de novo */ }

  const apiCards = await fetchFullSet(setCode);
  const normalized = apiCards.map(normalizeCard).filter(c => c.imageUri);
  saveSetCacheEntry(setCode, { timestamp:Date.now(), cards:normalized });
  return normalized;
}

/* ---------------- Sorteio do pacotinho ---------------- */

function pickRandom(list){
  return list[Math.floor(Math.random() * list.length)];
}

/* Agrupa o pool de cartas nas categorias usadas pra sortear cada pacotinho. */
function buildPools(cards){
  const commons = cards.filter(c => c.rarity === 'common' && !c.isBasicLand);
  const uncommons = cards.filter(c => c.rarity === 'uncommon');
  const rares = cards.filter(c => c.rarity === 'rare');
  const mythics = cards.filter(c => c.rarity === 'mythic');
  const basicLands = cards.filter(c => c.isBasicLand);
  return { commons, uncommons, rares, mythics, basicLands };
}

const RARITY_POOL_KEY = { common:'commons', uncommon:'uncommons', rare:'rares', mythic:'mythics' };

/* Sorteia uma raridade a partir de pesos (que não precisam somar exatamente
   1 — o roll é comparado contra o total acumulado) e devolve uma carta
   daquela raridade. Cai pra comuns se o pool da raridade sorteada estiver
   vazio (ex.: set sem míticas cadastradas ainda). */
function pickByRarityWeights(pools, weights){
  const total = Object.values(weights).reduce((a,b) => a+b, 0);
  let roll = Math.random() * total;
  for(const rarity of Object.keys(weights)){
    roll -= weights[rarity];
    if(roll <= 0){
      const pool = pools[RARITY_POOL_KEY[rarity]];
      return pickRandom(pool && pool.length ? pool : pools.commons);
    }
  }
  return pickRandom(pools.commons);
}

/* Pesos das raridades por slot, extraídos das odds oficiais publicadas em
   magic.wizards.com/en/news/feature/collecting-the-hobbit (Play Booster),
   renormalizados pra somar 100% já que o artigo também lista slots de
   cartas especiais (scene/dragon hoard/book cover) que não simulamos aqui. */
const WILDCARD_WEIGHTS = { common:74.17, uncommon:3.9, rare:17.3, mythic:2.3 };
const RARE_MYTHIC_WEIGHTS = { rare:82.9, mythic:11.1 };
const FOIL_WEIGHTS = { common:59.8, uncommon:29.3, rare:7.1, mythic:1.0 };
// Chance de o terreno do pacotinho sair em foil tradicional (soma das
// fatias foil do slot de terreno: default frame + full art + dual comum).
const LAND_FOIL_CHANCE = 0.20;

/* Monta um pacotinho de 14 cartas seguindo a distribuição real de um Play
   Booster: 7 comuns, 3 incomuns, 1 curinga (qualquer raridade), 1 rara ou
   mítica garantida, 1 carta em foil tradicional (qualquer raridade) e
   1 terreno básico (às vezes em foil). */
function generatePack(pools){
  const slots = [];
  for(let i=0;i<7;i++) slots.push({ slot:'common', card:pickRandom(pools.commons), isFoil:false });
  for(let i=0;i<3;i++) slots.push({ slot:'uncommon', card:pickRandom(pools.uncommons), isFoil:false });
  slots.push({ slot:'wildcard', card:pickByRarityWeights(pools, WILDCARD_WEIGHTS), isFoil:false });
  slots.push({ slot:'rareMythic', card:pickByRarityWeights(pools, RARE_MYTHIC_WEIGHTS), isFoil:false });
  slots.push({ slot:'foil', card:pickByRarityWeights(pools, FOIL_WEIGHTS), isFoil:true });
  slots.push({
    slot:'land',
    card:pickRandom(pools.basicLands.length ? pools.basicLands : pools.commons),
    isFoil:Math.random() < LAND_FOIL_CHANCE
  });
  return slots;
}

function generateBox(pools, packCount){
  return Array.from({ length:packCount }, () => generatePack(pools));
}

/* ---------------- Armazenamento local (coleção + moedas diárias) ---------------- */

function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function msUntilMidnight(){
  const now = new Date();
  const next = new Date(now);
  next.setHours(24,0,0,0);
  return next - now;
}

function loadCollection(){
  try{ return JSON.parse(localStorage.getItem(COLLECTION_KEY)) || {}; }
  catch(e){ return {}; }
}
function saveCollection(coll){
  try{ localStorage.setItem(COLLECTION_KEY, JSON.stringify(coll)); }
  catch(e){ /* localStorage indisponível — a coleção só não fica salva */ }
}
/* Registra as cartas de UM pacotinho já aberto na coleção (soma contagem,
   inclusive quantas dessas cópias saíram em foil). */
function recordPackInCollection(pack){
  const coll = loadCollection();
  pack.forEach(({ card, isFoil }) => {
    const entry = coll[card.id] || { count:0, foilCount:0 };
    entry.count += 1;
    if(isFoil) entry.foilCount = (entry.foilCount || 0) + 1;
    coll[card.id] = entry;
  });
  saveCollection(coll);
  return coll;
}

/* ---------------- Moedas ---------------- */

function loadCoins(){
  const n = Number(localStorage.getItem(COIN_BALANCE_KEY));
  return Number.isFinite(n) ? n : 0;
}
function saveCoins(n){
  try{ localStorage.setItem(COIN_BALANCE_KEY, String(Math.max(0, n))); }
  catch(e){ /* localStorage indisponível — o saldo só não fica salvo */ }
}
function loadLastCoinClaim(){
  return localStorage.getItem(LAST_COIN_CLAIM_KEY);
}
function saveLastCoinClaim(dateStr){
  try{ localStorage.setItem(LAST_COIN_CLAIM_KEY, dateStr); }
  catch(e){ /* localStorage indisponível — segue sem persistir a data */ }
}
function canClaimCoinToday(){
  return loadLastCoinClaim() !== todayStr();
}
function claimDailyCoin(){
  if(!canClaimCoinToday()) return loadCoins();
  const balance = loadCoins() + 1;
  saveCoins(balance);
  saveLastCoinClaim(todayStr());
  return balance;
}

/* ---------------- Estoque de pacotinhos (recebidos, ainda não abertos) ---------------- */

function genPackId(){
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}
function loadStock(){
  try{
    const stock = JSON.parse(localStorage.getItem(STOCK_KEY));
    return Array.isArray(stock) ? stock : [];
  }catch(e){ return []; }
}
function saveStock(stock){
  try{ localStorage.setItem(STOCK_KEY, JSON.stringify(stock)); }
  catch(e){ /* localStorage indisponível — o estoque só não fica salvo entre recargas */ }
}

/* ---------------- Rendering ---------------- */

const shopGrid = document.getElementById('shopGrid');
const coinBalanceEl = document.getElementById('coinBalance');
const collectCoinBtn = document.getElementById('collectCoinBtn');
const coinNote = document.getElementById('coinNote');
const mochilaBadge = document.getElementById('mochilaBadge');
const stockCount = document.getElementById('stockCount');
const stockGrid = document.getElementById('stockGrid');
const collectionCount = document.getElementById('collectionCount');
const collectionGrid = document.getElementById('collectionGrid');
const revealOverlay = document.getElementById('revealOverlay');
const revealProgress = document.getElementById('revealProgress');
const revealCardStage = document.getElementById('revealCardStage');
const revealNextBtn = document.getElementById('revealNextBtn');
const revealCloseBtn = document.getElementById('revealCloseBtn');

/* Monta a Loja com um item por edição configurada em SETS (arte real da
   caixa de booster, botão de compra e nota de status), cada um
   identificado por data-set-code pra saber de qual edição/pool puxar ao
   comprar. */
function shopItemHTML(set){
  return `
    <div class="shop-item" data-set-code="${set.code}">
      <div class="pack" aria-hidden="true">
        <img class="pack-art" src="${set.boxImage}" alt="Caixa ${set.name}">
      </div>
      <div class="pack-title">CAIXA ${set.name.toUpperCase()}<small>30 pacotinhos · 14 cartas cada</small></div>
      <button type="button" class="open-btn" data-set-code="${set.code}" disabled>Comprar por ${BOX_PRICE} 🪙</button>
      <p class="count-note" data-box-note="${set.code}">Carregando cartas da Scryfall…</p>
    </div>`;
}
function renderShopGrid(){
  shopGrid.innerHTML = SETS.map(shopItemHTML).join('');
}
renderShopGrid();

function pad2(n){ return String(n).padStart(2,'0'); }
function formatCountdown(ms){
  const total = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(total/3600), m = Math.floor((total%3600)/60), s = total%60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/* Atualiza saldo de moedas, botão "Coletar moeda do dia" (com contagem
   regressiva até a meia-noite) e o botão de compra de cada caixa da Loja
   (que depende do pool daquela edição já ter carregado E do jogador ter
   moeda suficiente). */
let coinCountdownTimer = null;
function updateShopUI(){
  coinBalanceEl.textContent = loadCoins();

  const claimable = canClaimCoinToday();
  collectCoinBtn.disabled = !claimable;

  const coins = loadCoins();
  SETS.forEach(set => {
    const ready = !!poolsBySet[set.code];
    const btn = shopGrid.querySelector(`.open-btn[data-set-code="${set.code}"]`);
    const note = shopGrid.querySelector(`[data-box-note="${set.code}"]`);
    if(!btn || !note) return;
    btn.disabled = !ready || coins < BOX_PRICE;
    note.textContent = ready
      ? (coins < BOX_PRICE ? 'Moedas insuficientes — colete sua moeda do dia.' : `Cada caixa custa ${BOX_PRICE} moeda e dá ${PACKS_PER_BOX} pacotinhos.`)
      : 'Carregando cartas da Scryfall…';
  });

  if(coinCountdownTimer){ clearInterval(coinCountdownTimer); coinCountdownTimer = null; }
  if(claimable){
    coinNote.textContent = 'Sua moeda do dia está disponível!';
    return;
  }
  const tick = () => {
    const ms = msUntilMidnight();
    if(ms <= 0){ clearInterval(coinCountdownTimer); updateShopUI(); return; }
    coinNote.textContent = `Você já coletou hoje. Próxima moeda em ${formatCountdown(ms)}.`;
  };
  tick();
  coinCountdownTimer = setInterval(tick, 1000);
}

function badgesHTML(entrySlot, card, isFoil){
  const badges = [];
  if(entrySlot) badges.push(`<span class="slot-badge">${SLOT_META[entrySlot] || ''}</span>`);
  if(isFoil || card.isFoilOnly) badges.push('<span class="foil-badge">FOIL</span>');
  if(card.isFullArt) badges.push('<span class="fullart-badge">FULL ART</span>');
  return badges.length ? `<div class="art-badges">${badges.join('')}</div>` : '';
}

/* Preço exibido: quando a função recebe `isFoil` (cartas de um pacotinho
   específico, seja na revelação ou no estoque), mostra só o preço da
   versão que realmente saiu (foil ou normal). Na coleção (visão agregada,
   sem `isFoil`), mostra os dois preços quando existirem, com a contagem
   de quantas cópias foram foil. Cartas "foil only" (ex: surge foil) não
   têm versão normal pra vender, então mostram sempre um único preço. */
function cardInfoHTML(card, { isFoil, count, foilCount } = {}){
  const rmeta = RARITY_META[card.rarity] || RARITY_META.common;
  let priceLine;
  if(card.isFoilOnly){
    priceLine = fmtUSD(card.priceFoil ?? card.priceUsd);
  }else if(isFoil !== undefined){
    priceLine = isFoil
      ? `foil ${fmtUSD(card.priceFoil ?? card.priceUsd)}`
      : fmtUSD(card.priceUsd);
  }else{
    priceLine = card.priceFoil != null
      ? `${fmtUSD(card.priceUsd)} · foil ${fmtUSD(card.priceFoil)}`
      : fmtUSD(card.priceUsd);
    if(count != null){
      const foils = foilCount || 0;
      const normais = count - foils;
      const parts = [];
      if(normais > 0) parts.push(`${normais} ${normais > 1 ? 'normais' : 'normal'}`);
      if(foils > 0) parts.push(`${foils} foil${foils > 1 ? 's' : ''}`);
      if(parts.length) priceLine += ` · ${parts.join(' · ')}`;
    }
  }
  return `
      <div class="gallery-info">
        <span class="gallery-name">${card.name.split(' // ')[0]}</span>
        <span class="gallery-type">${card.type.split(' // ')[0]}</span>
        <span class="gallery-tag" style="color:${rmeta.color}">${rmeta.label}${card.setName ? ' · '+card.setName : ''}</span>
        <span class="gallery-price">${priceLine}</span>
      </div>`;
}

/* Número de coleção formatado tipo álbum de figurinhas: "001", "113" etc. */
function formatCollectorNumber(n){
  const num = parseInt(n, 10);
  return Number.isNaN(num) ? (n || '') : String(num).padStart(3, '0');
}

function cardTileHTML(card, { slot, count, foilCount } = {}){
  return `
    <a class="gallery-card r-${card.rarity}" href="${card.scryfallUri || '#'}" target="_blank" rel="noopener">
      <div class="gallery-art">
        ${badgesHTML(slot, card)}
        ${count > 1 ? `<span class="count-badge">x${count}</span>` : ''}
        <span class="coll-number-badge">Nº ${formatCollectorNumber(card.collectorNumber)}</span>
        <img src="${card.imageUri}" alt="${card.name}" loading="lazy">
      </div>
      ${cardInfoHTML(card, { count, foilCount })}
    </a>`;
}

/* Espaço "vazio" do álbum de figurinhas — carta que ainda não foi
   descoberta: fundo cinza, "?" no lugar da arte e só o número da coleção. */
function lockedCardTileHTML(card){
  return `
    <div class="gallery-card gallery-card-locked">
      <div class="gallery-art gallery-art-locked">
        <span class="locked-question">?</span>
        <span class="coll-number-badge">Nº ${formatCollectorNumber(card.collectorNumber)}</span>
      </div>
      <div class="gallery-info">
        <span class="gallery-name gallery-name-locked">???</span>
        <span class="gallery-type">Carta não descoberta</span>
      </div>
    </div>`;
}

/* Cartão exibido dentro da janela de revelação: sem link "clicável" pra
   navegar (o clique no cartão avança pra próxima carta), com um link
   discreto separado pra abrir a página da carta na Scryfall. */
function revealCardHTML(card, slot, isFoil){
  return `
    <div class="reveal-card r-${card.rarity}">
      <div class="gallery-art">
        ${badgesHTML(slot, card, isFoil)}
        <img src="${card.imageUri}" alt="${card.name}" loading="lazy">
      </div>
      ${cardInfoHTML(card, { isFoil })}
      <a class="reveal-scryfall-link" href="${card.scryfallUri || '#'}" target="_blank" rel="noopener">Ver na Scryfall ↗</a>
    </div>`;
}

/* Mostra o estoque na mochila: um "pacotinho fechado" clicável por pacote
   ainda não aberto, com uma marca (HOB/FRA...) indicando de qual edição
   ele veio. Clicar em um remove ele da mochila, manda as cartas pra
   coleção e abre a janela de revelação carta-a-carta. */
function renderStock(){
  const stock = loadStock();
  stockCount.textContent = stock.length
    ? `${stock.length} pacotinho${stock.length > 1 ? 's' : ''} aguardando abertura`
    : 'Nenhum pacotinho ainda';
  mochilaBadge.hidden = stock.length === 0;
  mochilaBadge.textContent = stock.length;

  if(stock.length === 0){
    stockGrid.innerHTML = '<p class="coll-empty">Compre uma caixa na Loja pra receber 30 pacotinhos na mochila.</p>';
    return;
  }
  // Agrupa os pacotinhos por edição: um card por set mostrando a arte e
  // quantos restam; abrir sempre consome o mais antigo daquele grupo.
  const groups = [];
  const groupByCode = {};
  stock.forEach((pack, i) => {
    let group = groupByCode[pack.setCode];
    if(!group){
      group = { setCode:pack.setCode, indexes:[] };
      groupByCode[pack.setCode] = group;
      groups.push(group);
    }
    group.indexes.push(i);
  });

  stockGrid.innerHTML = groups.map(group => {
    const set = SET_BY_CODE[group.setCode] || SET_BY_CODE.hob;
    const firstIndex = group.indexes[0];
    const count = group.indexes.length;
    return `
    <button type="button" class="stock-pack" data-index="${firstIndex}" aria-label="Abrir pacotinho (${set.name}), ${count} restante${count > 1 ? 's' : ''}">
      <span class="stock-pack-face"><img class="stock-pack-img" src="${set.packImage}" alt="Pacotinho ${set.name}"></span>
      <span class="stock-pack-count">x${count}</span>
      <span class="stock-pack-label">${set.name} · Abrir</span>
    </button>
  `;
  }).join('');
}

/* Resolve um pacotinho do estoque (ids salvos) pras cartas reais atuais. */
function resolveStockPack(pack){
  return pack.slots
    .map(({ id, slot, foil }) => ({ slot, card:fullSetById[id], isFoil:!!foil }))
    .filter(entry => entry.card);
}

function openStockPack(index){
  const stock = loadStock();
  const pack = stock[index];
  if(!pack) return;
  const resolved = resolveStockPack(pack);

  // Remove já do estoque e registra na coleção antes de começar a revelar,
  // assim a carta conta como "encontrada" mesmo se a janela for fechada no meio.
  stock.splice(index, 1);
  saveStock(stock);
  recordPackInCollection(resolved);
  renderStock();
  renderCollection(fullSetById);

  if(resolved.length) startReveal(resolved);
}

stockGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.stock-pack');
  if(!btn) return;
  openStockPack(Number(btn.dataset.index));
});

/* ---------------- Janela de revelação carta-a-carta ---------------- */

let revealQueue = [];
let revealIndex = 0;

function showRevealCard(){
  const total = revealQueue.length;
  const { slot, card, isFoil } = revealQueue[revealIndex];
  revealProgress.textContent = `Carta ${revealIndex + 1} / ${total}`;
  revealCardStage.innerHTML = revealCardHTML(card, slot, isFoil);
  revealNextBtn.textContent = revealIndex === total - 1 ? 'Concluir' : 'Próxima carta →';
}

function startReveal(slots){
  revealQueue = slots;
  revealIndex = 0;
  revealOverlay.style.display = 'flex';
  showRevealCard();
}

function advanceReveal(){
  if(revealOverlay.style.display === 'none') return;
  revealIndex += 1;
  if(revealIndex >= revealQueue.length){
    closeReveal();
    return;
  }
  showRevealCard();
}

function closeReveal(){
  revealOverlay.style.display = 'none';
  revealQueue = [];
  revealIndex = 0;
}

revealNextBtn.addEventListener('click', advanceReveal);
revealCloseBtn.addEventListener('click', closeReveal);
revealCardStage.addEventListener('click', (e) => {
  if(e.target.closest('.reveal-scryfall-link')) return;
  advanceReveal();
});
// Clicar no fundo escuro (fora do modal) também fecha a revelação.
revealOverlay.addEventListener('click', (e) => {
  if(e.target === revealOverlay) closeReveal();
});

/* Álbum de figurinhas: uma seção por edição (hoje só "The Hobbit"),
   cartas ordenadas pelo número de coleção (001, 002...). Cartas ainda não
   descobertas aparecem como espaço vazio cinza com "?" no lugar da arte. */
/* Guarda quais seções (por setCode) estão minimizadas na Coleção. */
const COLLAPSE_KEY = 'magicBoosterCollapsedSets';
function loadCollapsedSets(){
  try{ return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; }catch(e){ return {}; }
}
function saveCollapsedSets(state){ localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); }

function renderCollection(fullSetById){
  const coll = loadCollection();
  const allCards = Object.values(fullSetById);
  const totalKnown = allCards.length;
  const ownedCount = Object.keys(coll).length;
  collectionCount.textContent = `${ownedCount} / ${totalKnown} cartas descobertas`;

  if(totalKnown === 0){
    collectionGrid.innerHTML = '<p class="coll-empty">Abra sua primeira caixa pra começar a coleção.</p>';
    return;
  }

  const bySet = {};
  allCards.forEach(card => {
    const key = card.setCode || 'set';
    if(!bySet[key]) bySet[key] = { setName:card.setName || (SET_BY_CODE[key] && SET_BY_CODE[key].name) || key, cards:[] };
    bySet[key].cards.push(card);
  });

  const collapsed = loadCollapsedSets();

  collectionGrid.innerHTML = Object.entries(bySet).map(([setCode, group]) => {
    const sorted = group.cards.slice().sort((a,b) => {
      const na = parseInt(a.collectorNumber, 10);
      const nb = parseInt(b.collectorNumber, 10);
      if(!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return String(a.collectorNumber || '').localeCompare(String(b.collectorNumber || ''), undefined, {numeric:true});
    });
    const ownedInGroup = sorted.filter(c => coll[c.id]).length;
    const isCollapsed = !!collapsed[setCode];
    const tiles = sorted.map(card => {
      const owned = coll[card.id];
      return owned
        ? cardTileHTML(card, { count:owned.count, foilCount:owned.foilCount })
        : lockedCardTileHTML(card);
    }).join('');
    return `
      <div class="set-section${isCollapsed ? ' is-collapsed' : ''}" data-set-code="${setCode}">
        <button type="button" class="set-section-toggle" data-set-code="${setCode}" aria-expanded="${!isCollapsed}">
          <span class="set-section-chevron">▾</span>
          <h3 class="set-section-title">${group.setName} <span>${ownedInGroup} / ${sorted.length}</span></h3>
        </button>
        <div class="gallery-grid">${tiles}</div>
      </div>`;
  }).join('');
}

collectionGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.set-section-toggle');
  if(!btn) return;
  const setCode = btn.dataset.setCode;
  const collapsed = loadCollapsedSets();
  collapsed[setCode] = !collapsed[setCode];
  saveCollapsedSets(collapsed);
  const section = btn.closest('.set-section');
  if(section){
    section.classList.toggle('is-collapsed', collapsed[setCode]);
    btn.setAttribute('aria-expanded', String(!collapsed[setCode]));
  }
});

/* ---------------- Boot ---------------- */

let poolsBySet = {};
let fullSetById = {};

/* Busca todas as edições configuradas em SETS em paralelo, mescla os
   pools/cartas de cada uma (os ids da Scryfall são únicos entre sets,
   então dá pra juntar tudo num único fullSetById) e destrava a Loja
   edição por edição conforme cada busca termina. */
async function init(){
  const results = await Promise.allSettled(SETS.map(async set => {
    const normalized = await loadNormalizedSet(set.code);
    return { set, normalized };
  }));

  results.forEach((result, i) => {
    const set = SETS[i];
    if(result.status !== 'fulfilled'){
      console.error(result.reason);
      const note = shopGrid.querySelector(`[data-box-note="${set.code}"]`);
      if(note) note.textContent = 'Não foi possível carregar as cartas agora. Tente recarregar a página.';
      return;
    }
    const { normalized } = result.value;
    if(normalized.length === 0){
      const note = shopGrid.querySelector(`[data-box-note="${set.code}"]`);
      if(note) note.textContent = 'Nenhuma carta foi encontrada na Scryfall.';
      return;
    }
    normalized.forEach(card => { fullSetById[card.id] = card; });
    poolsBySet[set.code] = buildPools(normalized);
  });

  // Remove do estoque qualquer pacotinho com carta que não exista mais
  // nos sets carregados (ex.: cache antigo/corrompido), pra não quebrar a UI.
  const stock = loadStock().filter(pack => resolveStockPack(pack).length === pack.slots.length);
  saveStock(stock);

  updateShopUI();
  renderStock();
  renderCollection(fullSetById);
}

collectCoinBtn.addEventListener('click', () => {
  if(!canClaimCoinToday()) return;
  claimDailyCoin();
  updateShopUI();
});

/* Comprar uma caixa: delegação de clique em qualquer botão da Loja
   (um por edição), identificado por data-set-code. */
shopGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.open-btn');
  if(!btn || btn.disabled) return;
  const setCode = btn.dataset.setCode;
  const pools = poolsBySet[setCode];
  if(!pools || loadCoins() < BOX_PRICE) return;
  saveCoins(loadCoins() - BOX_PRICE);
  const box = generateBox(pools, PACKS_PER_BOX);
  const newPacks = box.map(pack => ({
    pid:genPackId(),
    setCode,
    slots:pack.map(({ slot, card, isFoil }) => ({ id:card.id, slot, foil:!!isFoil }))
  }));
  saveStock(loadStock().concat(newPacks));
  renderStock();
  updateShopUI();
  switchTab('mochila');
});

/* ---------------- Abas ---------------- */

const tabBar = document.getElementById('tabBar');
function switchTab(name){
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('is-active', panel.dataset.tabPanel === name));
}
tabBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if(!btn) return;
  switchTab(btn.dataset.tab);
});

init();

})();
