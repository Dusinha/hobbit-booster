# Magic Booster — Simulador de Booster

Projeto separado em 3 arquivos, pronto pra abrir no VS Code:

- `index.html` — estrutura da página
- `style.css` — todo o visual (tema parchment/Terra-média, galeria de cartas)
- `main.js` — lógica: busca em lote na Scryfall e renderização da galeria da coleção

## Rodar localmente

Não precisa de build nem de servidor — é só abrir o `index.html` direto no navegador,
ou, se quiser live-reload, usar a extensão **Live Server** do VS Code (clique direito
no `index.html` → "Open with Live Server").

## Dados reais via API (Scryfall)

Ao carregar a página, `main.js` busca **o set completo "The Hobbit" (HOB)** direto
na Scryfall, usando a busca paginada:

```
GET https://api.scryfall.com/cards/search?q=set:hob&unique=prints&order=set
```

Essa busca retorna até 175 cartas por página; `fetchFullSet` segue automaticamente
o campo `has_more`/`next_page` da resposta até trazer todas as **321 impressões**
do set (`unique=prints`), sem precisar manter uma lista de nomes escrita à mão.

Usar `unique=prints` (em vez de `unique=cards`) é o que garante que as **versões
full art** também apareçam — terrenos básicos com arte estendida (Plains, Island,
Swamp, Mountain, Forest) e a versão full art mítica de "Smaug the Magnificent".
Essas cartas ganham um selo "FULL ART" no canto da arte (`card.isFullArt`, vindo
do campo `full_art` da Scryfall).

Todo o conteúdo exibido (imagem, custo de mana, tipo, raridade e preço em USD/foil)
vem direto da resposta da API — nada é inventado localmente. A Scryfall libera CORS,
então o `fetch` funciona direto do navegador, sem backend.

## Como funciona o jogo

A página tem 3 abas:

- **Loja** — onde você coleta sua moeda diária e compra caixas de booster.
- **Mochila** — todos os pacotinhos que você já comprou e ainda não abriu.
- **Coleção** — todas as cartas diferentes que você já descobriu (com contagem
  de repetidas).

### Moedas

Clicando em **"Coletar moeda do dia"** você ganha **1 moeda**. O botão fica
desabilitado depois do clique e volta a liberar automaticamente à meia-noite
(horário local do navegador), com uma contagem regressiva exibida embaixo dele.

### Caixas e pacotinhos

Cada **caixa** custa **1 moeda** e, ao ser comprada, gera **30 pacotinhos** que
vão direto pra sua **mochila** (nenhum é revelado na hora). Cada pacotinho tem
14 cartas sorteadas do set completo `HOB`, seguindo as chances **oficiais**
de um Play Booster publicadas pela Wizards em
[magic.wizards.com/en/news/feature/collecting-the-hobbit](https://magic.wizards.com/en/news/feature/collecting-the-hobbit):

- **7 comuns**
- **3 incomuns**
- **1 curinga** (qualquer raridade — chance ponderada: ~74% comum, ~4% incomum,
  ~17% rara, ~2% mítica)
- **1 rara ou mítica garantida** (~83% rara, ~11% mítica)
- **1 foil garantido** (qualquer raridade — chance ponderada: ~60% comum, ~29%
  incomum, ~7% rara, ~1% mítica)
- **1 terreno básico** (com ~20% de chance de sair em foil)

A carta do slot "foil garantido" sempre sai em foil; o terreno básico às vezes
também. Quando uma carta sai em foil, o preço mostrado na revelação e na
coleção é o **preço foil** (`prices.usd_foil`) em vez do normal — com um selo
"FOIL" na carta.

Na mochila, você abre os pacotinhos **um de cada vez**: ao clicar num
pacotinho fechado, uma janela mostra as 14 cartas **uma a uma** (clique na
carta ou no botão "Próxima carta" pra avançar); assim que o pacotinho é
aberto, suas cartas já entram na sua coleção.

### Persistência

Moedas, data da última coleta, pacotinhos na mochila e coleção descoberta
ficam salvos no `localStorage` do navegador — não há login nem servidor, então
tudo é por navegador/dispositivo.

Pra resetar tudo (útil em testes), no console do navegador:

```js
localStorage.clear(); location.reload();
```

Ou só resetar a coleta diária de moeda:

```js
localStorage.removeItem('magicBoosterLastCoinClaim'); location.reload();
```

Os nomes salvos no `localStorage` foram ajustados de `hobbitBooster*` para `magicBooster*`; se houver dados antigos, a migração acontece automaticamente ao carregar a página.

## Deploy

Funciona em qualquer hospedagem estática: GitHub Pages, Vercel, Netlify, Cloudflare
Pages. Basta subir esses 3 arquivos (não precisa de build).

