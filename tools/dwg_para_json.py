#!/usr/bin/env python3
"""
Extrai a geometria da planta (DXF convertido do DWG com libredwg) para o JSON usado pelo passeio 3D.

Uso:
  python3 tools/dwg_para_json.py planta.dxf src/casa.gerada.json [--debug pasta]

O DWG do projeto de aprovação contém três plantas lado a lado (subsolo, térreo, superior),
em centímetros. As paredes estão na layer "PAREDE GERAL" como pares de linhas paralelas
(as duas faces); as esquadrias na layer "ESQUADRIAS"; os rótulos de vãos na layer "TEXTO"
("largura x altura / peitoril") e os nomes dos ambientes na layer "TEXTO AREA".

Estratégia:
  1. Para cada pavimento, recolhe as linhas ortogonais de parede dentro da caixa da planta.
  2. Pareia faces paralelas a 8–30 cm de distância → eixo de parede com espessura.
  3. Funde segmentos colineares; os intervalos vazios entre segmentos colineares são vãos.
  4. Classifica cada vão pelo rótulo mais próximo (porta ou janela com peitoril).
  5. Rasteriza paredes + esquadrias e preenche a partir de cada rótulo de ambiente
     para obter o polígono de cada ambiente (contorno da região preenchida).
Requer: ezdxf, numpy, (matplotlib só para --debug).
"""
import json
import math
import re
import sys
from collections import defaultdict

import ezdxf
import numpy as np

# ------------------------------------------------------------------ configuração
# Caixas (em cm, coordenadas do DXF) de cada planta detalhada e níveis (m) de cada pavimento.
PAVIMENTOS = [
    {"id": "subsolo", "nome": "Subsolo", "caixa": (1250, 2500, 1850, 4200), "nivel": -1.05, "pe_direito": 2.40},
    {"id": "terreo", "nome": "Térreo", "caixa": (3550, 4900, 1850, 4200), "nivel": 1.50, "pe_direito": 2.82},
    {"id": "superior", "nome": "Pavimento Superior", "caixa": (5850, 7100, 1850, 4200), "nivel": 4.47, "pe_direito": 2.70},
]
ESP_MIN, ESP_MAX = 8, 32  # espessura de parede (cm)
VAO_MIN, VAO_MAX = 40, 420  # largura de vão (cm)
TOL = 1.0  # tolerância de colinearidade (cm)
RASTER = 2.5  # cm por pixel na rasterização dos ambientes

NOMES_IGNORAR = re.compile(
    r"MURO|PROJE|BEIRAL|CERVA|GUARDA|FACHADA|RUA |PLANTA|ESCALA|LIXEIRA|CAL[ÇC]ADA|ACESSO|MEIO-FIO|FAIXA|RAMPA|"
    r"PISO|SOBE|DESCE|ÁREA|AREA|TELHA|PAREDE|LAREIRA|PORTA|m²|^[0-9,.\- ]+m?$|^[A-Z]$",
    re.I,
)


# ------------------------------------------------------------------ utilidades
def linhas_ortogonais(msp, layer, caixa):
    """Devolve listas de segmentos horizontais e verticais ((x0,x1), y) / ((y0,y1), x)."""
    x0, x1, y0, y1 = caixa
    horiz, vert = [], []

    def dentro(p):
        return x0 <= p[0] <= x1 and y0 <= p[1] <= y1

    def add(a, b):
        if not (dentro(a) and dentro(b)):
            return
        if abs(a[1] - b[1]) < 0.3 and abs(a[0] - b[0]) > 0.5:
            horiz.append(((min(a[0], b[0]), max(a[0], b[0])), (a[1] + b[1]) / 2))
        elif abs(a[0] - b[0]) < 0.3 and abs(a[1] - b[1]) > 0.5:
            vert.append(((min(a[1], b[1]), max(a[1], b[1])), (a[0] + b[0]) / 2))

    for e in msp.query(f'*[layer=="{layer}"]'):
        t = e.dxftype()
        if t == "LINE":
            add((e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y))
        elif t == "LWPOLYLINE":
            pts = [(p[0], p[1]) for p in e.get_points()]
            if e.closed and pts:
                pts.append(pts[0])
            for a, b in zip(pts, pts[1:]):
                add(a, b)
    return horiz, vert


def agrupar_por_coordenada(segs, tol=TOL):
    """Agrupa segmentos pela coordenada perpendicular (y para horizontais)."""
    segs = sorted(segs, key=lambda s: s[1])
    grupos = []
    for (iv, c) in segs:
        if grupos and abs(grupos[-1][0] - c) <= tol:
            grupos[-1][1].append(iv)
        else:
            grupos.append([c, [iv]])
    # funde intervalos de cada grupo
    out = []
    for c, ivs in grupos:
        ivs.sort()
        fund = []
        for a, b in ivs:
            if fund and a <= fund[-1][1] + 0.5:
                fund[-1][1] = max(fund[-1][1], b)
            else:
                fund.append([a, b])
        out.append((c, fund))
    return out


def parear_faces(grupos):
    """Pareia faces paralelas próximas → eixos de parede: (coord_centro, espessura, [intervalos])."""
    eixos = []
    for i in range(len(grupos)):
        c1, ivs1 = grupos[i]
        for j in range(i + 1, len(grupos)):
            c2, ivs2 = grupos[j]
            d = c2 - c1
            if d < ESP_MIN:
                continue
            if d > ESP_MAX:
                break
            for a1, b1 in ivs1:
                for a2, b2 in ivs2:
                    a, b = max(a1, a2), min(b1, b2)
                    if b - a >= 12:
                        eixos.append(((c1 + c2) / 2, d, a, b))
    return eixos


def fundir_eixos(eixos):
    """Funde eixos colineares que se tocam; devolve dict coord->(esp, [[a,b],...])."""
    por_coord = defaultdict(list)
    for c, d, a, b in eixos:
        chave = round(c * 2) / 2
        por_coord[chave].append((d, a, b))
    out = {}
    for c, lst in por_coord.items():
        lst.sort(key=lambda t: t[1])
        fund = []
        for d, a, b in lst:
            if fund and a <= fund[-1][2] + 1.0 and abs(fund[-1][0] - d) < 6:
                fund[-1][2] = max(fund[-1][2], b)
            else:
                fund.append([d, a, b])
        out[c] = fund
    return out


def remover_eixos_falsos(eixos_h, eixos_v):
    """Um par de faces pode ser na verdade duas paredes finas distintas coladas a uma
    parede perpendicular (ex.: topo de parede a 15 cm de outra). Mantém só eixos com
    comprimento >= 20 cm. Eixos muito curtos são geralmente cantos."""
    def filtra(eixos):
        return {c: [s for s in segs if s[2] - s[1] >= 20] for c, segs in eixos.items()}
    return filtra(eixos_h), filtra(eixos_v)


# ------------------------------------------------------------------ vãos
ROTULO = re.compile(r"^\s*([0-9]+[.,][0-9]+)\s*[xX]\s*([0-9]+[.,][0-9]+)\s*(?:/\s*([0-9]+[.,][0-9]+))?\s*$")


def ler_rotulos(msp, caixa):
    x0, x1, y0, y1 = caixa
    rot = []
    for e in msp.query('TEXT MTEXT[layer=="TEXTO"]'):
        t = e.plain_text() if e.dxftype() == "MTEXT" else e.dxf.text
        t = re.sub(r"\s+", " ", t).strip()
        m = ROTULO.match(t)
        p = e.dxf.insert
        if m and x0 <= p.x <= x1 and y0 <= p.y <= y1:
            larg = float(m.group(1).replace(",", "."))
            alt = float(m.group(2).replace(",", "."))
            peit = float(m.group(3).replace(",", ".")) if m.group(3) else None
            rot.append({"x": p.x, "y": p.y, "largura": larg, "altura": alt, "peitoril": peit})
    return rot


def ler_ambientes(msp, caixa):
    x0, x1, y0, y1 = caixa
    out = []
    areas = []
    for e in msp.query('TEXT MTEXT[layer=="TEXTO AREA"]'):
        t = e.plain_text() if e.dxftype() == "MTEXT" else e.dxf.text
        t = re.sub(r"\s+", " ", t).strip()
        p = e.dxf.insert
        if not (x0 <= p.x <= x1 and y0 <= p.y <= y1):
            continue
        m = re.fullmatch(r"(?:ÁREA:\s*)?([0-9]+[.,][0-9]+)\s*m²", t, re.I)
        if m:
            areas.append((p.x, p.y, float(m.group(1).replace(",", "."))))
            continue
        if not t or NOMES_IGNORAR.search(t):
            continue
        out.append({"nome": t.title().replace("Estaar", "Estar"), "x": p.x, "y": p.y})
    for amb in out:
        cand = [(math.hypot(ax - amb["x"], ay - amb["y"]), a) for ax, ay, a in areas if abs(ax - amb["x"]) < 80 and -40 < amb["y"] - ay < 60]
        amb["area_projeto"] = min(cand)[1] if cand else None
    # remove duplicados (mesmo nome a < 40 cm)
    unicos = []
    for a in out:
        if not any(a["nome"] == b["nome"] and math.hypot(a["x"] - b["x"], a["y"] - b["y"]) < 40 for b in unicos):
            unicos.append(a)
    return unicos


def detectar_vaos(eixos, rotulos, esquadrias, horizontal):
    """Para cada coordenada de eixo, os intervalos vazios entre segmentos colineares são vãos.
    Só aceita se houver uma linha de esquadria no intervalo (evita esquinas/cantos)."""
    vaos = []
    for c, segs in eixos.items():
        segs = sorted(segs, key=lambda s: s[1])
        for s1, s2 in zip(segs, segs[1:]):
            a, b = s1[2], s2[1]
            larg = b - a
            if not (VAO_MIN <= larg <= VAO_MAX):
                continue
            esp = (s1[0] + s2[0]) / 2
            # há esquadria a cruzar o vão?
            tem = False
            for (iv, cc) in esquadrias:
                if abs(cc - c) <= esp and iv[0] <= b - 5 and iv[1] >= a + 5:
                    tem = True
                    break
            centro = (a + b) / 2
            if horizontal:
                cx, cy = centro, c
            else:
                cx, cy = c, centro
            # rótulo mais próximo (até 120 cm)
            melhor, dist = None, 1e9
            for r in rotulos:
                d = math.hypot(r["x"] - cx, r["y"] - cy)
                if d < dist:
                    melhor, dist = r, d
            rot = melhor if dist <= 120 else None
            if not tem and not rot:
                continue
            if rot:
                tipo = "janela" if rot["peitoril"] is not None else "porta"
                alt = rot["altura"]
                peit = rot["peitoril"] or 0
                # portas de correr / vãos altos
                if tipo == "porta" and alt < 1.9 and larg > 150:
                    tipo = "janela"
                    peit = 0.0
            else:
                tipo = "janela" if larg < 130 else "porta"
                alt = 1.45 if tipo == "janela" else 2.10
                peit = 0.8 if tipo == "janela" else 0
            vaos.append({
                "coord": c, "esp": esp, "a": a, "b": b, "horizontal": horizontal,
                "tipo": tipo, "altura": alt, "peitoril": peit,
                "largura_rotulo": rot["largura"] if rot else None,
            })
    return vaos


def ler_guarda_corpos(msp, caixa):
    x0, x1, y0, y1 = caixa
    out = []
    for e in msp.query('TEXT MTEXT[layer=="TEXTO AREA"]'):
        t = e.plain_text() if e.dxftype() == "MTEXT" else e.dxf.text
        m = re.search(r"guarda\s*corpo\s*h\s*=\s*([0-9]+[.,][0-9]+)", t, re.I)
        p = e.dxf.insert
        if m and x0 <= p.x <= x1 and y0 <= p.y <= y1:
            out.append({"x": p.x, "y": p.y, "altura": float(m.group(1).replace(",", "."))})
    return out


def detectar_vidros(esq_h, esq_v, eixos_h, eixos_v, vaos, guardas):
    """Linhas de esquadria que não estão dentro de uma parede nem de um vão:
    divisórias de vidro (altura total) ou guarda-corpos (com rótulo de altura próximo)."""
    out = []
    for horizontal, grupos, eixos in ((True, agrupar_por_coordenada(esq_h, 2.0), eixos_h), (False, agrupar_por_coordenada(esq_v, 2.0), eixos_v)):
        for c, ivs in grupos:
            for a, b in ivs:
                if b - a < 100:
                    continue
                # dentro de parede?
                dentro = False
                for cc, segs in eixos.items():
                    for d, sa, sb in segs:
                        if abs(cc - c) <= d / 2 + 1 and min(b, sb) - max(a, sa) > (b - a) * 0.5:
                            dentro = True
                if dentro:
                    continue
                # dentro de vão?
                em_vao = any(v["horizontal"] == horizontal and abs(v["coord"] - c) <= v["esp"] and min(b, v["b"]) - max(a, v["a"]) > (b - a) * 0.5 for v in vaos)
                if em_vao:
                    continue
                cx, cy = ((a + b) / 2, c) if horizontal else (c, (a + b) / 2)
                g = min(guardas, key=lambda g: math.hypot(g["x"] - cx, g["y"] - cy), default=None)
                if g and math.hypot(g["x"] - cx, g["y"] - cy) < 200:
                    out.append({"tipo": "guarda_corpo", "altura": g["altura"], "coord": c, "a": a, "b": b, "horizontal": horizontal})
                else:
                    out.append({"tipo": "divisoria_vidro", "altura": None, "coord": c, "a": a, "b": b, "horizontal": horizontal})
    return out


# ------------------------------------------------------------------ ambientes por raster
def barreiras_extra(msp, caixa):
    """Arcos de portas (folha + arco fecham o vão) e linhas ortogonais da layer 0 / PAREDE-VISTA
    (lareira, muretas). Devolve lista de polilinhas em cm."""
    x0, x1, y0, y1 = caixa
    out = []
    for e in msp.query('ARC LINE'):
        if e.dxf.layer not in ("0", "PAREDE GERAL", "ESQUADRIAS", "PAREDE-VISTA"):
            continue
        if e.dxftype() == "ARC":
            c, r = e.dxf.center, e.dxf.radius
            if not (x0 <= c.x <= x1 and y0 <= c.y <= y1) or r > 300:
                continue
            a0, a1 = e.dxf.start_angle, e.dxf.end_angle
            if a1 < a0:
                a1 += 360
            ang = np.radians(np.linspace(a0, a1, 32))
            out.append(list(zip(c.x + r * np.cos(ang), c.y + r * np.sin(ang))))
            # raio inicial = folha da porta
            out.append([(c.x, c.y), (c.x + r * math.cos(math.radians(a0)), c.y + r * math.sin(math.radians(a0)))])
            out.append([(c.x, c.y), (c.x + r * math.cos(math.radians(a1)), c.y + r * math.sin(math.radians(a1)))])
        else:
            a, b = e.dxf.start, e.dxf.end
            if not (x0 <= a.x <= x1 and y0 <= a.y <= y1 and x0 <= b.x <= x1 and y0 <= b.y <= y1):
                continue
            if math.hypot(a.x - b.x, a.y - b.y) < 20:
                continue
            out.append([(a.x, a.y), (b.x, b.y)])
    return out


def rasterizar(caixa, eixos_h, eixos_v, esquadrias_h, esquadrias_v, vaos=(), faces=((), ()), extras=()):
    x0, x1, y0, y1 = caixa
    W = int((x1 - x0) / RASTER) + 1
    H = int((y1 - y0) / RASTER) + 1
    grade = np.zeros((H, W), dtype=np.uint8)

    def px(x):
        return int(round((x - x0) / RASTER))

    def py(y):
        return int(round((y - y0) / RASTER))

    for c, segs in eixos_h.items():
        for d, a, b in segs:
            grade[max(0, py(c - d / 2)):py(c + d / 2) + 1, max(0, px(a)):px(b) + 1] = 1
    for c, segs in eixos_v.items():
        for d, a, b in segs:
            grade[max(0, py(a)):py(b) + 1, max(0, px(c - d / 2)):px(c + d / 2) + 1] = 1
    # esquadrias como barreiras finas (portas, janelas, guarda-corpos)
    for (iv, c) in esquadrias_h:
        grade[py(c), max(0, px(iv[0])):px(iv[1]) + 1] = 1
    for (iv, c) in esquadrias_v:
        grade[max(0, py(iv[0])):py(iv[1]) + 1, px(c)] = 1
    # faces de parede tal como desenhadas (fecham cantos que o pareamento não apanhou)
    for (iv, c) in faces[0]:
        grade[py(c), max(0, px(iv[0])):px(iv[1]) + 1] = 1
    for (iv, c) in faces[1]:
        grade[max(0, py(iv[0])):py(iv[1]) + 1, px(c)] = 1
    for poli in extras:
        for (ax_, ay_), (bx_, by_) in zip(poli, poli[1:]):
            n = int(max(abs(bx_ - ax_), abs(by_ - ay_)) / RASTER) + 2
            for t in np.linspace(0, 1, n):
                xx, yy = px(ax_ + (bx_ - ax_) * t), py(ay_ + (by_ - ay_) * t)
                if 0 <= xx < W and 0 <= yy < H:
                    grade[yy, xx] = 1
    # fecha os vãos (portas/janelas) para separar os ambientes
    for v in vaos:
        if v["horizontal"]:
            grade[py(v["coord"]) - 1:py(v["coord"]) + 2, max(0, px(v["a"])):px(v["b"]) + 1] = 1
        else:
            grade[max(0, py(v["a"])):py(v["b"]) + 1, px(v["coord"]) - 1:px(v["coord"]) + 2] = 1
    return grade, px, py


def preencher(grade, sx, sy, limite=None):
    if limite is None:
        limite = int(grade.size * 0.45)
    H, W = grade.shape
    if grade[sy, sx]:
        # procura o pixel livre mais próximo
        for r in range(1, 20):
            achou = False
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    yy, xx = sy + dy, sx + dx
                    if 0 <= yy < H and 0 <= xx < W and not grade[yy, xx]:
                        sx, sy, achou = xx, yy, True
                        break
                if achou:
                    break
            if achou:
                break
    mascara = np.zeros_like(grade, dtype=bool)
    pilha = [(sx, sy)]
    n = 0
    while pilha:
        x, y = pilha.pop()
        if x < 0 or y < 0 or x >= W or y >= H or grade[y, x] or mascara[y, x]:
            continue
        mascara[y, x] = True
        n += 1
        if n > limite:
            return None  # vazou para o exterior
        pilha.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return mascara


def fechar(mascara, raio):
    """Fecho morfológico (dilatação + erosão) com elemento quadrado, só com numpy."""
    def dilatar(m, r):
        out = m.copy()
        for eixo in (0, 1):
            acc = out.copy()
            for k in range(1, r + 1):
                acc |= np.roll(out, k, axis=eixo) | np.roll(out, -k, axis=eixo)
            out = acc
        return out
    return ~dilatar(~dilatar(mascara, raio), raio)


def contorno_da_casa(caixa, eixos_h, eixos_v):
    """Polígono exterior da casa: paredes rasterizadas, fechadas com raio grande (enche os
    ambientes) e depois o contorno da região resultante."""
    grade, px, py = rasterizar(caixa, eixos_h, eixos_v, [], [])
    m = fechar(grade.astype(bool), int(260 / RASTER))
    # fica só com a maior componente ligada
    H, W = m.shape
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return []
    visto = np.zeros_like(m)
    melhor = None
    for sy, sx in zip(ys[::50], xs[::50]):
        if visto[sy, sx]:
            continue
        comp = preencher(~m, sx, sy, limite=10**9)
        if comp is None:
            continue
        visto |= comp
        if melhor is None or comp.sum() > melhor.sum():
            melhor = comp
    return contorno(melhor, caixa) if melhor is not None else []


def contorno(mascara, caixa):
    """Polígono (em cm) do contorno exterior da máscara, por marching squares simplificado
    em grelha ortogonal: extrai as arestas de fronteira e encadeia-as."""
    H, W = mascara.shape
    x0, _, y0, _ = caixa
    arestas = {}
    # cada pixel ocupado contribui com arestas onde o vizinho está vazio
    ys, xs = np.nonzero(mascara)
    for y, x in zip(ys, xs):
        if y == 0 or not mascara[y - 1, x]:
            arestas[((x, y), (x + 1, y))] = True
        if y == H - 1 or not mascara[y + 1, x]:
            arestas[((x + 1, y + 1), (x, y + 1))] = True
        if x == 0 or not mascara[y, x - 1]:
            arestas[((x, y + 1), (x, y))] = True
        if x == W - 1 or not mascara[y, x + 1]:
            arestas[((x + 1, y), (x + 1, y + 1))] = True
    saida = defaultdict(list)
    for (a, b) in arestas:
        saida[a].append(b)
    # escolhe o ciclo mais longo
    visitadas = set()
    melhor = []
    for inicio in list(saida):
        if inicio in visitadas:
            continue
        cadeia = [inicio]
        atual = inicio
        while True:
            visitadas.add(atual)
            prox = None
            for cand in saida[atual]:
                if cand not in visitadas or cand == inicio:
                    prox = cand
                    break
            if prox is None or prox == inicio:
                break
            cadeia.append(prox)
            atual = prox
        if len(cadeia) > len(melhor):
            melhor = cadeia
    # simplifica: remove pontos colineares
    pts = [(x0 + x * RASTER, y0 + y * RASTER) for x, y in melhor]
    simp = []
    for i, p in enumerate(pts):
        a, b = pts[i - 1], pts[(i + 1) % len(pts)]
        if (a[0] == p[0] == b[0]) or (a[1] == p[1] == b[1]):
            continue
        simp.append(p)
    return simp


# ------------------------------------------------------------------ principal
def processar(doc, pav, debug_dir=None):
    msp = doc.modelspace()
    caixa = pav["caixa"]
    h, v = linhas_ortogonais(msp, "PAREDE GERAL", caixa)
    eh, ev = linhas_ortogonais(msp, "ESQUADRIAS", caixa)
    gh, gv = agrupar_por_coordenada(h), agrupar_por_coordenada(v)
    eixos_h = fundir_eixos(parear_faces(gh))
    eixos_v = fundir_eixos(parear_faces(gv))
    eixos_h, eixos_v = remover_eixos_falsos(eixos_h, eixos_v)
    rotulos = ler_rotulos(msp, caixa)
    ambientes = ler_ambientes(msp, caixa)
    vaos = detectar_vaos(eixos_h, rotulos, eh, True) + detectar_vaos(eixos_v, rotulos, ev, False)
    vidros = detectar_vidros(eh, ev, eixos_h, eixos_v, vaos, ler_guarda_corpos(msp, caixa))

    grade, px, py = rasterizar(caixa, eixos_h, eixos_v, eh, ev, vaos, (h, v), barreiras_extra(msp, caixa))
    regioes = []
    for amb in ambientes:
        m = preencher(grade, px(amb["x"]), py(amb["y"]))
        if m is None:
            amb["poligono"] = None
            continue
        # regiões iguais (ex.: cozinha/jantar/estar) partilham polígono
        repetida = next((r for r in regioes if r["mascara"][py(amb["y"]), px(amb["x"])]), None)
        if repetida:
            amb["poligono"] = repetida["poligono"]
            amb["regiao"] = repetida["id"]
        else:
            area = round(float(m.sum()) * RASTER * RASTER / 1e4, 2)
            ref = amb.get("area_projeto")
            if ref and area > ref * 1.6 + 2:
                amb["poligono"] = None  # vazou para outro espaço
                amb["area_m2"] = area
                continue
            poly = contorno(m, caixa)
            rid = len(regioes)
            regioes.append({"id": rid, "mascara": m, "poligono": poly})
            amb["poligono"] = poly
            amb["regiao"] = rid
            amb["area_m2"] = area
    contorno_casa = contorno_da_casa(caixa, eixos_h, eixos_v)

    return {
        "eixos_h": eixos_h, "eixos_v": eixos_v, "vaos": vaos, "ambientes": ambientes, "vidros": vidros, "contorno": contorno_casa,
        "esquadrias": (eh, ev), "faces": (h, v),
    }


def para_json(res, pav, origem):
    ox, oy = origem
    cm = lambda x: round(x / 100, 3)
    paredes = []
    for c, segs in res["eixos_h"].items():
        for d, a, b in segs:
            paredes.append({"a": [cm(a - ox), cm(c - oy)], "b": [cm(b - ox), cm(c - oy)], "esp": cm(d)})
    for c, segs in res["eixos_v"].items():
        for d, a, b in segs:
            paredes.append({"a": [cm(c - ox), cm(a - oy)], "b": [cm(c - ox), cm(b - oy)], "esp": cm(d)})
    vaos = []
    for vv in res["vaos"]:
        if vv["horizontal"]:
            a, b = [cm(vv["a"] - ox), cm(vv["coord"] - oy)], [cm(vv["b"] - ox), cm(vv["coord"] - oy)]
        else:
            a, b = [cm(vv["coord"] - ox), cm(vv["a"] - oy)], [cm(vv["coord"] - ox), cm(vv["b"] - oy)]
        vaos.append({"tipo": vv["tipo"], "a": a, "b": b, "esp": cm(vv["esp"]), "altura": vv["altura"], "peitoril": vv["peitoril"]})
    vidros = []
    for vv in res["vidros"]:
        if vv["horizontal"]:
            a, b = [cm(vv["a"] - ox), cm(vv["coord"] - oy)], [cm(vv["b"] - ox), cm(vv["coord"] - oy)]
        else:
            a, b = [cm(vv["coord"] - ox), cm(vv["a"] - oy)], [cm(vv["coord"] - ox), cm(vv["b"] - oy)]
        vidros.append({"tipo": vv["tipo"], "a": a, "b": b, "altura": vv["altura"]})
    ambientes = []
    for amb in res["ambientes"]:
        ambientes.append({
            "nome": amb["nome"], "seed": [cm(amb["x"] - ox), cm(amb["y"] - oy)],
            "regiao": amb.get("regiao"), "area_m2": amb.get("area_m2"), "areaProjeto": amb.get("area_projeto"),
            "poligono": [[cm(x - ox), cm(y - oy)] for x, y in amb["poligono"]] if amb.get("poligono") else None,
        })
    contorno_json = [[cm(x - ox), cm(y - oy)] for x, y in res["contorno"]]
    return {
        "id": pav["id"], "nome": pav["nome"], "nivel": pav["nivel"], "peDireito": pav["pe_direito"],
        "contorno": contorno_json,
        "paredes": paredes, "vaos": vaos, "vidros": vidros, "ambientes": ambientes,
    }


def origem_do_pavimento(res):
    """Canto inferior-esquerdo da casa (menor x de eixo vertical longo, menor y de eixo horizontal longo)."""
    xs = [c for c, segs in res["eixos_v"].items() if any(b - a > 200 for _, a, b in segs)]
    ys = [c for c, segs in res["eixos_h"].items() if any(b - a > 200 for _, a, b in segs)]
    return min(xs), min(ys)


def desenhar_debug(res, pav, caminho):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.collections import LineCollection
    x0, x1, y0, y1 = pav["caixa"]
    fig = plt.figure(figsize=(16, 16 * (y1 - y0) / (x1 - x0)), dpi=70)
    ax = fig.add_axes([0, 0, 1, 1])
    h, v = res["faces"]
    ax.add_collection(LineCollection([[(a, c), (b, c)] for (a, b), c in h] + [[(c, a), (c, b)] for (a, b), c in v], colors="#cccccc", linewidths=0.6))
    for c, segs in res["eixos_h"].items():
        for d, a, b in segs:
            ax.add_patch(plt.Rectangle((a, c - d / 2), b - a, d, color="black"))
    for c, segs in res["eixos_v"].items():
        for d, a, b in segs:
            ax.add_patch(plt.Rectangle((c - d / 2, a), d, b - a, color="black"))
    for vv in res["vaos"]:
        cor = "tab:blue" if vv["tipo"] == "janela" else "tab:red"
        if vv["horizontal"]:
            ax.plot([vv["a"], vv["b"]], [vv["coord"], vv["coord"]], color=cor, linewidth=3)
        else:
            ax.plot([vv["coord"], vv["coord"]], [vv["a"], vv["b"]], color=cor, linewidth=3)
    if res["contorno"]:
        xs, ys = zip(*(res["contorno"] + [res["contorno"][0]]))
        ax.plot(xs, ys, color="orange", linewidth=2)
    for vv in res["vidros"]:
        cor = "tab:purple" if vv["tipo"] == "guarda_corpo" else "tab:cyan"
        if vv["horizontal"]:
            ax.plot([vv["a"], vv["b"]], [vv["coord"], vv["coord"]], color=cor, linewidth=2, linestyle="--")
        else:
            ax.plot([vv["coord"], vv["coord"]], [vv["a"], vv["b"]], color=cor, linewidth=2, linestyle="--")
    for amb in res["ambientes"]:
        if amb.get("poligono"):
            xs, ys = zip(*(amb["poligono"] + [amb["poligono"][0]]))
            ax.fill(xs, ys, alpha=0.12, color="tab:green")
        ax.text(amb["x"], amb["y"], f'{amb["nome"]}\n{amb.get("area_m2", "?")} m²', fontsize=7, color="darkgreen")
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect("equal")
    fig.savefig(caminho, facecolor="white")
    plt.close(fig)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    entrada, saida = sys.argv[1], sys.argv[2]
    debug_dir = sys.argv[sys.argv.index("--debug") + 1] if "--debug" in sys.argv else None
    doc = ezdxf.readfile(entrada)
    resultados = [(pav, processar(doc, pav)) for pav in PAVIMENTOS]
    # alinha os pavimentos pela origem de cada planta (todas são cópias deslocadas em x)
    pavimentos = []
    for pav, res in resultados:
        origem = origem_do_pavimento(res)
        print(f'{pav["id"]}: origem {origem}, paredes h={sum(len(s) for s in res["eixos_h"].values())} '
              f'v={sum(len(s) for s in res["eixos_v"].values())}, vãos={len(res["vaos"])}, ambientes={len(res["ambientes"])}')
        for amb in res["ambientes"]:
            print(f'   - {amb["nome"]:28s} projeto={amb.get("area_projeto")} fill={amb.get("area_m2")} regiao={amb.get("regiao")} {"OK" if amb.get("poligono") else "--"}')
        print(f'   contorno da casa: {len(res["contorno"])} vértices')
        pavimentos.append(para_json(res, pav, origem))
        if debug_dir:
            desenhar_debug(res, pav, f'{debug_dir}/debug_{pav["id"]}.png')
    with open(saida, "w", encoding="utf-8") as f:
        json.dump({"unidade": "m", "origem": "canto sudoeste da casa", "pavimentos": pavimentos}, f, ensure_ascii=False, indent=1)
    print("gravado", saida)


if __name__ == "__main__":
    main()
