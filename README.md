# Muralha TD

Tower defense em **TypeScript + Canvas 2D**, sem engine e sem nenhum arquivo de imagem ou som:
tudo é desenhado e sintetizado em código. Nasceu de um jogo de 4,8 KB escondido numa URL
(`siddubey.com/q#...`), que está decodificado e reescrito em `original/`.

## Rodar

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento com recarga instantânea |
| `npm run build` | checa tipos e gera `dist/` (site estático, roda offline) |
| `npm test` | testes de regras + simulação completa com bot nos 5 mapas |
| `npm run balance` | só a simulação com bot (use `LOG=1` para ver onda a onda) |
| `npm run decode -- "<url>" saida.js` | decodifica qualquer link no formato `siddubey.com/q#...` |

No VS Code: **F5** abre o jogo no Edge com depurador (breakpoints direto no `.ts`).
Em modo dev, `window.app` no console do navegador dá acesso ao estado (ex.: `app.world.cash = 99999`).

## O jogo

- **8 torres**, cada uma com **2 caminhos de upgrade × 4 níveis** (um caminho vai ao nível 4, o outro só até o 2):
  Arqueiro, Morteiro, Torre de Gelo, Bobina Tesla, Atirador, Prisma, Mina de Ouro e Totem de Guerra.
- **14 tipos de inimigo** com mecânicas próprias: blindados (armadura), furtivos (exigem detecção),
  regeneração, cura em área, divisão ao morrer, invocação e **3 chefes** (ondas 10, 20, 30, 40...).
- Sinergias: o pulso de gelo **revela furtivos** para as outras torres; o Totem acelera, fortalece
  e dá detecção; a Mina dá renda, bônus por abate e desconto em upgrades.
- **5 mapas**, incluindo um com duas entradas e um procedural que usa o gerador de caminho do jogo original.
- **4 dificuldades** (30 a 50 ondas) + modo livre infinito depois da vitória.
- Prioridade de alvo por torre, velocidade 1x/2x/3x, início automático de ondas, prévia da próxima onda,
  recordes e medalhas salvos no navegador.

### Atalhos

`1`–`8` escolher torre · `Shift`+clique constrói várias · `Z`/`X` upgrade · `Tab` trocar alvo ·
`Delete` vender · `Espaço` iniciar onda · `F` velocidade · `P` pausar · `Esc` cancelar/menu.

## Arquitetura

```
src/
  engine/   rng (Park-Miller, igual ao original), matemática, áudio sintetizado, save
  game/     SIMULAÇÃO PURA, sem DOM: torres, inimigos, ondas, mapas, World
  render/   desenho procedural (sprites), fundo pré-renderizado, efeitos/partículas
  ui/       HUD, loja, inspetor de torre, telas e modais (DOM puro, sem framework)
  app.ts    loop com passo fixo de 60 ticks/s, entrada, fluxo de telas
original/   o jogo de 4,8 KB: payload, JS decodificado, versão legível e decodificador
tests/      regras + bot que joga partidas inteiras sem navegador
```

A simulação (`src/game/world.ts`) roda com passo fixo e RNG com semente, então é
**determinística** e testável sem navegador. É assim que o bot de `tests/simulation.test.ts`
joga 40 ondas em cada mapa para pegar bugs e calibrar o balanceamento.

### Onde mexer

- **Nova torre:** adicione em `TOWERS` (`src/game/towers.ts`), com os 2 caminhos, e o desenho em `src/render/sprites.ts`.
  Se for um tipo de ataque novo, trate o `kind` em `World.attack`.
- **Novo inimigo:** `ENEMIES` em `src/game/enemies.ts` (o gerador de ondas usa `threat` e `unlock`).
- **Novo mapa:** `MAPS` em `src/game/maps.ts` (caminho em coordenadas de 1024×640).
- **Balanceamento:** preços e upgrades em `towers.ts`, vida/velocidade em `enemies.ts`, curva de ondas em `waves.ts`.
  Rode `LOG=1 npm run balance` depois de mudar.

## Para levar além

- **APK Android:** `npm run build` + Capacitor (`npx cap add android`), o mesmo fluxo do app da feira.
- **Desktop:** empacotar `dist/` com Tauri ou Electron.
- **Arte:** trocar o desenho procedural de `sprites.ts` por spritesheets mantendo a mesma interface `drawTower`/`drawEnemy`.
