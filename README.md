# The Hobbit — Simulador de Booster

Projeto separado em 3 arquivos, pronto pra abrir no VS Code:

- `index.html` — estrutura da página
- `style.css` — todo o visual (tema parchment/Terra-média, cartas, animações)
- `main.js` — lógica: geração do booster, foils, animação de mítica, coleção salva no navegador (localStorage)

## Rodar localmente

Não precisa de build nem de servidor — é só abrir o `index.html` direto no navegador,
ou, se quiser live-reload, usar a extensão **Live Server** do VS Code (clique direito
no `index.html` → "Open with Live Server").

## Próximo passo: dados reais via API

Hoje o pool de cartas está hardcoded no topo do `main.js`, no objeto `POOL` (e nos
arrays `LANDS_BASIC` / `LANDS_SPECIAL`). Pra trocar por dados reais da Scryfall:

```js
async function fetchSetCards(setCode) {
  const res = await fetch(`https://api.scryfall.com/cards/search?q=set:${setCode}&order=set`);
  const data = await res.json();
  return data.data; // array de cartas com name, mana_cost, type_line, rarity, image_uris, etc.
}
```

A Scryfall libera CORS, então esse fetch funciona direto do navegador, sem backend.
Só troque o preenchimento de `POOL` por esses dados (separando por `rarity`), e no
`art` de cada carta você pode usar `card.image_uris.normal` numa `<img>` em vez do
SVG gerado — já que fora do ambiente do Claude não existe a restrição de CSP que
bloqueia imagens externas.

## Deploy

Funciona em qualquer hospedagem estática: GitHub Pages, Vercel, Netlify, Cloudflare
Pages. Basta subir esses 3 arquivos (não precisa de build).
