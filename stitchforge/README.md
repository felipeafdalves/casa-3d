# StitchForge

Converte imagens em arquivos de bordado **`.PES` para maquinas Brother** (e tambem `.dst`,
`.jef`, `.exp`, `.vp3`, `.xxx`, `.u01`, `.pec`), com previa dos pontos, validacao de bastidor
e ficha de linhas antes do download.

Projeto independente, com pipeline proprio: quantizacao de cor perceptual,
vetorizacao, geracao de pontos (tatami / satin / underlay) e escrita nativa do
formato Tajima DST.

---

## Leia isto antes de usar

**Nenhum conversor automatico produz um arquivo "perfeito" sozinho — inclusive este.**
Bordado nao e impressao: cada ponto e uma agulha furando tecido, com tensao, densidade e
ordem que dependem do material. O que este sistema entrega e um **primeiro arquivo bom**,
que economiza a maior parte do trabalho de digitalizacao — e uma previa para voce julgar
antes de gastar linha.

O que ele faz bem:

- arte chapada, com poucas cores e contorno definido (personagens, molduras, logotipos, letras solidas);
- pecas de 5 a 30 cm, que e a faixa de bastidor comum;
- reduzir a arte a um numero controlado de linhas comerciais.

O que ele **nao** faz:

- fotografia e degrade fotografico (o resultado vira mancha);
- textura de aquarela, respingo e borda difusa — sao achatados de proposito;
- decidir estabilizador, tensao ou tipo de agulha: isso e do operador;
- substituir o teste em uma amostra do tecido real.

Aquarela como as artes de moldura infantil funciona, **desde que voce aceite** que o
resultado e uma versao chapada dela, com 6 a 10 cores — nao a aquarela.

---

## Alvo: Brother / PES

O formato padrao e **PES versao 1** — toda Brother que le PES abre v1. A v6 guarda nome de
linha e miniatura, mas maquina mais antiga recusa o arquivo; so use v6 se a sua abrir.

**Bastidor.** A Brother nao "corta" o que passa do bastidor: ela recusa o arquivo. O sistema
calcula o menor bastidor que serve e avisa antes do download.

| Bastidor | Area util (com folga do pe calcador) |
| --- | --- |
| 4x4 | 100 x 100 mm |
| 5x7 | 130 x 180 mm |
| 8x8 | 200 x 200 mm |
| 6x10 | 160 x 260 mm |
| 9.5x14 | 240 x 360 mm |

**Cor no visor x cor no cone.** O PES guarda indices da carta fixa de 64 cores da Brother.
Se a linha escolhida nao esta na carta, a maquina exibe a mais proxima — **isso muda so a
tela**: a linha fisica continua sendo a que voce colocou. Por isso a quantizacao usa, por
padrao, o catalogo de linhas reais (`--palette fidelity`), que rende cor bem melhor em arte
pastel; a ficha mostra ao lado o que vai aparecer no visor.

Nas artes de aquarela infantil a diferenca medida foi grande: **dE medio ~7 no modo
Fidelidade contra ~16 restringindo a carta Brother** — a carta de 64 cores nao tem tons
pasteis. Use `--palette brother` apenas quando quiser que a previa case exatamente com o
visor da maquina.

## Instalacao

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[formats,dev]"
```

`formats` instala o `pyembroidery`, usado apenas para os formatos alem do DST.
Sem ele o sistema continua funcionando e exporta DST (nativo, sem dependencia).

## Uso

### Interface web

```bash
uvicorn stitchforge.api:app --reload
# abre em http://127.0.0.1:8000
```

Sobe a imagem, ajusta os parametros, **confere a previa**, baixa o formato da sua maquina.

### Linha de comando

```bash
stitchforge arte.png -w 120 -c 8 --hoop "5x7 (13x18 cm)" --preview previa.png
# grava arte.pes (PES v1, Brother) e imprime a ficha de linhas com a cor do visor
```

| opcao | efeito |
| --- | --- |
| `-w, --width-mm` | largura do desenho no bastidor (nao da imagem) |
| `-c, --colors` | numero de linhas; mais cores = mais fiel e mais parada de maquina |
| `--spacing-mm` | distancia entre carreiras do preenchimento (0.40 e o padrao para linha 40) |
| `--min-area-mm2` | descarta respingos menores que isso; sobe para eliminar cortes |
| `--keep-background` | nao tenta remover o fundo |
| `-f, --format` | `pes` (padrao) ou qualquer um que o `pyembroidery` grave |
| `--pes-version` | `1` (padrao, universal) ou `6` |
| `--hoop` | valida se cabe no bastidor Brother escolhido |
| `--palette` | `fidelity` (padrao) ou `brother` (restringe a carta do visor) |

### Como biblioteca

```python
import cv2
from stitchforge.pipeline.preprocess import prepare, PreprocessOptions
from stitchforge.pipeline.quantize import quantize, QuantizeOptions
from stitchforge.pipeline.builder import build_design
from stitchforge.formats.writer import write

prepared = prepare(cv2.imread("arte.png", cv2.IMREAD_UNCHANGED),
                   PreprocessOptions(target_width_mm=120))
layers = quantize(prepared, QuantizeOptions(colors=8))
design = build_design(prepared, layers, name="arte")
write(design, "arte.pes", pes_version=1)
print(design.stats())
```

---

## Como funciona

```
imagem
  │
  ├─ preprocess ─ redimensiona, tira textura (filtro bilateral), remove fundo
  │               por floodFill nas bordas + areas fechadas grandes da cor do fundo
  │               (o "miolo" de uma moldura nao deve ser costurado)
  │
  ├─ quantize ──  k-means em CIE-Lab -> N cores, casadas com o catalogo de linhas
  │               por deltaE; camada extra para detalhe escuro (olho, nariz),
  │               que o k-means por area apagaria
  │
  ├─ vectorize ─  mascaras -> contornos com furos, simplificados, em 0.1 mm
  │
  ├─ stitches ──  satin em faixa fina E alongada (duas margens obtidas por PCA);
  │               tatami escalonado no resto; underlay; contorno; compensacao de puxada
  │
  ├─ builder ───  ordem por vizinho mais proximo, saltos, cortes, arremates,
  │               angulo diferente por cor, desenho centrado na origem
  │
  └─ formats ───  PES v1 (Brother) via pyembroidery, com validacao de bastidor e
                  mapeamento da cor exibida no visor; DST nativo (ternario
                  balanceado, cabecalho de 512 bytes) sem dependencia externa
```

### Decisoes tecnicas que valem explicacao

- **Unidade interna 0.1 mm inteira.** E a unidade do DST. Trabalhar em float e converter
  no fim acumula erro que aparece como ponto fora de lugar.
- **Ternario balanceado no DST.** O alcance do formato (±121) e exatamente (3⁵−1)/2, entao
  a decomposicao em pesos 1/3/9/27/81 e exata por construcao — sem heuristica gulosa.
- **Satin so em forma fina *e* alongada.** Satin em bolha redonda fica com ponto atravessado;
  em area grande, solta no primeiro uso. A razao comprimento/largura vem de PCA.
- **Conector de carreira testado contra furos.** Sem esse teste, o preenchimento cruza um
  furo e deixa linha atravessada na peca.
- **Arremate em todo inicio e fim de trecho.** E o defeito mais comum de arquivo gerado
  automaticamente: sem trava, o bordado desfia na primeira lavagem.
- **Carta Brother nao vira camisa de forca.** Restringir a arte as 64 cores do visor piora a
  cor sem ganho fisico algum — a linha do cone e a que o operador comprou. A carta e
  informada, nao imposta.
- **Angulo diferente por cor.** Duas cores vizinhas na mesma direcao "somem" entre si e
  concentram a tensao no tecido em um unico sentido.

---

## Catalogo de linhas

`stitchforge/pipeline/threads.py` traz um catalogo **aproximado** (~55 cores) no perfil
Madeira/Isacord. Ele serve para prototipo e para a previa na tela; **nao substitui o cartao
fisico**. Para producao, carregue o catalogo do seu fornecedor:

```python
from stitchforge.pipeline.threads import load_catalog_csv
catalog = load_catalog_csv("madeira.csv", brand="madeira")  # code,name,r,g,b  ou  code,name,hex
```

## Testes

```bash
pytest -q     # 88 testes: codec DST, geometria dos pontos, API e alvo Brother/PES
```

O codec DST tem teste de ida e volta bit a bit. Os PES gerados sao relidos e conferidos:
assinatura (`#PES0001`), dimensoes em milimetros, numero de trocas de cor e — no modo carta
Brother — que nenhuma cor sofreu substituicao.

## Limites conhecidos (roadmap honesto)

1. Sem *skeleton* real: satin usa PCA para achar as margens, o que erra em forma em "S"
   muito curvada. Um algoritmo de eixo medio resolveria.
2. Sem compensacao de tecido por material (malha estica mais que sarja).
3. Sem edicao manual da previa — hoje o ajuste e refazer com outros parametros.
4. Quantizacao nao respeita "esta cor tem que existir": nao da para fixar uma linha.
5. Bastidores cadastrados sao os Brother comuns; bastidor especial (borda, bone) nao esta na
   tabela e precisa ser conferido a mao.
6. Underlay unico (contorno interno). Falta zigue-zague e underlay cruzado para area grande.
