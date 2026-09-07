# Casa Verônica e Felipe · Passeio 3D

Passeio interativo em primeira pessoa pela casa, gerado a partir da **planta de aprovação em DWG** e
com acabamentos baseados no **projeto de interiores** (Bruna Varhau, REV01). Corre no navegador
(Three.js + Vite), sem plugins, e funciona em qualquer PC com placa gráfica integrada.

## O que já faz

- **Geometria real da planta**: paredes, espessuras, portas, janelas (com altura e peitoril), divisórias de vidro
  e guarda-corpos são extraídos automaticamente do DWG (`tools/dwg_para_json.py`).
- **Três pavimentos alinhados**: subsolo (garagem e bar, −1,05 m), térreo (+1,50 m) e superior (+4,47 m),
  com as duas escadas em "U" (17 e 14 degraus, conforme o DWG), o vazio do mezanino (pé-direito duplo
  sobre estar, jantar e cozinha), varandas, sacada, rampa da garagem e escada de entrada.
- **Acabamentos do projeto de interiores** por ambiente: piso de madeira escura, lambri branco no hall,
  sala e circulação, cozinha e lavanderia com azulejo "subway", escritório verde, suíte do filho azul,
  lareira em pedra que sobe pelo pé-direito duplo, garagem com tijolo aparente e bar.
- **Janelas e portas com caixilho preto quadriculado**, portas que abrem (tecla E), porta de correr da varanda.
- **Mobiliário paramétrico** desenhado sobre as referências: lareira de pedra até ao teto com bancos de janela e TV,
  estantes em arco com fundo ripado, sofá em L de linho com almofadas, mesa "live edge", lustre de roda duplo,
  cozinha shaker com portas de vidro, coifa e cuba de avental, ilha com tampo de madeira e pernas torneadas,
  mesa de fazenda com cadeiras de bouclé e lustre de velas, cristaleira, lavanderia com vigas e armário de madeira,
  banheiros com bancada sálvia, mármore e box em espinha de peixe, escritório com estante embutida e sofá de veludo,
  camas de nogueira com colunas e mesas de cabeceira, cama-baú infantil, garagem com dois carros, portão preto estilo
  celeiro, chesterfield de couro, painel de TV, bar e adega em grelha metálica.
- **Iluminação física**: sol com sombras, céu e ambiente em **HDR real** (campo ao nascer do sol; noite sem lua),
  reflexos PBR, luminárias com luz própria (lustre de roda, lanternas, arandelas, lareira), modo dia/noite (tecla L).
- **Pós-processamento**: oclusão ambiente (GTAO) e anti-aliasing (SMAA), com 3 níveis de qualidade (tecla Q ou `?qualidade=0|1|2` no URL).
- **Acabamentos "modern farmhouse"** a partir das imagens de referência: piso de madeira fotográfico, rodapés, sancas,
  lambris com almofadas (hall, sala, circulação), lambri ripado azul (quarto do filho), lambri sálvia com papel floral
  (quartos de hóspedes), boiserie no escritório verde, cortinas de voil com varão preto em todas as janelas,
  siding branco na fachada, colunas com base de pedra e guarda branca na varanda, bloco de concreto na garagem.
- **Mobiliário posicionado pela planta humanizada do PDF**: sofá de canto em L com consola atrás, mesa de centro
  e lustre de roda alinhados com a lareira, estantes em arco na parede sul da sala com as poltronas, mesa de jantar e
  ilha nas posições do projeto, camas com a cabeceira na parede indicada, roupeiro corrido da suíte master, lounge da
  garagem na faixa leste com bar e adega no nicho.
- **Modo foto com path tracing (tecla F)**: a vista atual é recalculada por *path tracing* na GPU
  (three-gpu-pathtracer): luz indireta real, sombras suaves, reflexos e vidros físicos, com o HDR do céu e as
  luminárias da casa como fontes de luz. A imagem converge amostra a amostra (a granulação desaparece em segundos
  numa placa dedicada, em minutos numa integrada); "Guardar PNG" descarrega a fotografia. Qualquer movimento sai do modo.
- **Física simples**: gravidade, colisão com paredes, móveis e guardas, subida e descida de escadas e rampas.
- **HUD**: nome do ambiente atual, mini-mapa do pavimento, lista de teleporte (tecla T), 3 níveis de qualidade (Q).

## Como correr

```bash
cd casa-3d
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/ (site estático)
```

Controlos: **W A S D** andar · **rato** olhar · **Shift** correr · **E** abrir/fechar portas ·
**T** teleporte · **M** mapa · **L** dia/noite · **Q** qualidade · **F** modo foto (path tracing) · **Esc** solta o rato.

## Publicar na Vercel

Crie um projeto novo na Vercel apontando para este repositório com **Root Directory = `casa-3d`**.
A Vercel detecta o Vite (build `npm run build`, output `dist`). O painel financeiro continua no
projeto existente (raiz do repositório), sem interferência.

## Pipeline da planta (DWG → JSON)

1. Converter o DWG para DXF (o ficheiro de aprovação está em centímetros):
   `dwg2dxf -o planta.dxf planta.dwg` (LibreDWG) ou ODA File Converter.
   Se o DXF tiver textos com quebras de linha, o `tools/dwg_para_json.py` explica como reparar.
2. Gerar a geometria: `python3 tools/dwg_para_json.py planta.dxf src/casa.gerada.json --debug pasta/`
   (requer `ezdxf`, `numpy`; `matplotlib` só para as imagens de depuração).
   O script pareia as duas faces de cada parede (layer `PAREDE GERAL`), detecta vãos entre segmentos
   colineares e classifica-os pelos rótulos "largura x altura / peitoril" (layer `TEXTO`), lê os nomes e
   áreas dos ambientes (`TEXTO AREA`), as esquadrias (`ESQUADRIAS`) e valida os polígonos dos ambientes
   pela área que o próprio projeto rotula.
3. Tudo o que o DWG não descreve com precisão (escadas, deslocamento entre as três plantas, lareira, materiais,
   mobiliário, luzes) está em **`src/casa.ajustes.js`**, em metros, com comentários. É aí que se afinam
   posições e acabamentos, sem tocar no código do motor.

Ficheiros: `src/modelo.js` (junta geometria + ajustes), `src/construtor.js` (paredes, vãos, pisos, tetos,
escadas, exterior), `src/mobiliario.js` (kit de peças), `src/materiais.js` (texturas procedurais PBR),
`src/jogador.js` (câmara e colisões), `src/iluminacao.js`, `src/interface.js`.

## Créditos de texturas e HDR

- Fotos de madeira, tijolo e relva: exemplos do three.js (licença MIT), descarregadas para `public/texturas/`.
- Ambientes HDR `spruit_sunrise_1k` e `moonless_golf_1k`: Poly Haven (CC0), distribuídos com o three.js, em `public/hdr/`.
- Todos os outros materiais (papéis de parede, azulejos, pedra, siding, ripados) são gerados por código em `src/materiais.js`.

## Verificação automática

`npm run capturas` (depois de `npm run build`) abre a app num Chromium sem GPU (Playwright, WebGL por software),
tira capturas de 20 pontos da casa, gera **plantas de topo de cada pavimento** (para auditar as divisões contra o DWG
e o PDF) e corre testes de movimento: subir a escada até ao patamar, bater na parede do hall, ser bloqueado pela porta
fechada e passar com ela aberta, descer para o subsolo. No fim corre uma **auditoria do mobiliário**: cada peça é
testada contra as paredes (atravessa?), contra o polígono do ambiente (invade a divisão ao lado?) e contra as outras
peças (sobreposição) — o objetivo é sair sempre com `0 problema(s)`. Variáveis úteis: `QUALIDADE=2` (com oclusão ambiente),
`VISTAS=sala-estar,cozinha` (só algumas vistas), `SO_VISTAS=1` (sem plantas nem testes), `CHROME_PATH`.
`node tools/teste_foto.mjs` testa o modo foto no mesmo Chromium por software (entra, espera por `AMOSTRAS`, guarda
`capturas/modo-foto.png`); sem GPU cada amostra demora vários segundos, por isso usa `LARGURA=640` por defeito.

## Próximos passos para chegar ao fotorrealismo

O motor já aceita um modelo externo: coloque um **glTF/GLB** em `public/modelos/casa.glb` e ele é carregado
por cima da geometria procedural. O caminho profissional é:

1. **Pedir à designer o ficheiro SketchUp (.skp)** do projeto de interiores (os renders do PDF são SketchUp)
   e exportar para glTF com texturas — é o mesmo modelo, com o mobiliário real, já posicionado.
2. Substituir o mobiliário paramétrico pelo glTF e manter a geometria da planta para colisões.
3. Luz "baked" (Blender) ou oclusão ambiente em tempo real para o salto final de realismo.
4. Alternativa de alto nível: importar a planta e o glTF no **Unreal Engine 5** (Lumen) para renders
   fotorrealistas em tempo real; este projeto web continua útil para partilhar por link com a família e a obra.
