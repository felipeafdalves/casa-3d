"""Catalogo de linhas e casamento de cor perceptual.

IMPORTANTE: os valores RGB abaixo sao uma aproximacao dos cartoes de cor
Madeira Polyneon / Isacord, suficientes para prototipo e para a previa na
tela. Eles NAO substituem o cartao fisico: monitor, tecido e brilho da
linha mudam a percepcao. Antes de producao, calibre `CATALOG` medindo as
linhas reais (ou importe o csv do fornecedor via `load_catalog_csv`).
"""

from __future__ import annotations

import csv
from pathlib import Path

from ..models import Thread

# Subconjunto util para arte infantil/aquarela: neutros, peles, pasteis,
# verdes de folhagem, marrons de madeira e os basicos saturados.
_RAW: tuple[tuple[str, str, tuple[int, int, int]], ...] = (
    ("1001", "Branco", (255, 255, 255)),
    ("1002", "Off-white", (246, 243, 236)),
    ("1071", "Creme", (242, 231, 205)),
    ("1055", "Areia", (226, 209, 178)),
    ("1155", "Bege claro", (233, 214, 188)),
    ("1057", "Bege medio", (206, 178, 141)),
    ("1058", "Caramelo", (186, 142, 92)),
    ("1157", "Mel", (206, 156, 88)),
    ("1058b", "Bronze", (160, 116, 70)),
    ("1157b", "Castanho claro", (150, 110, 74)),
    ("1058c", "Marrom madeira", (124, 88, 58)),
    ("1159", "Marrom medio", (104, 72, 47)),
    ("1160", "Marrom escuro", (74, 50, 33)),
    ("1161", "Chocolate", (58, 38, 26)),
    ("1000", "Preto", (24, 24, 26)),
    ("1005", "Cinza chumbo", (78, 82, 88)),
    ("1011", "Cinza medio", (140, 145, 152)),
    ("1012", "Cinza claro", (190, 194, 199)),
    ("1042", "Azul bebe", (176, 205, 231)),
    ("1076", "Azul claro", (146, 185, 220)),
    ("1043", "Azul ceu", (108, 156, 205)),
    ("1166", "Azul medio", (62, 108, 172)),
    ("1042b", "Azul royal", (36, 72, 145)),
    ("1043b", "Azul marinho", (26, 44, 84)),
    ("1078", "Azul acinzentado", (146, 166, 186)),
    ("1079", "Azul elefante", (158, 178, 196)),
    ("1147", "Vermelho", (198, 40, 44)),
    ("1147b", "Vermelho escuro", (150, 28, 34)),
    ("1121", "Coral", (232, 122, 106)),
    ("1116", "Rosa bebe", (245, 202, 205)),
    ("1117", "Rosa claro", (240, 176, 186)),
    ("1118", "Rosa medio", (226, 133, 156)),
    ("1119", "Rosa pink", (208, 84, 128)),
    ("1120", "Bochecha", (243, 188, 184)),
    ("1065", "Amarelo bebe", (250, 232, 168)),
    ("1067", "Amarelo", (247, 214, 96)),
    ("1024", "Amarelo ouro", (240, 187, 47)),
    ("1025", "Mostarda", (214, 158, 40)),
    ("1078b", "Laranja claro", (247, 176, 96)),
    ("1078c", "Laranja", (238, 138, 52)),
    ("1102", "Verde claro", (186, 208, 168)),
    ("1103", "Verde sage", (156, 178, 140)),
    ("1101", "Verde folha", (118, 148, 106)),
    ("1104", "Verde musgo", (92, 118, 82)),
    ("1105", "Verde escuro", (58, 82, 56)),
    ("1049", "Verde oliva", (128, 132, 82)),
    ("1108", "Verde menta", (198, 222, 208)),
    ("1109", "Verde agua", (160, 205, 196)),
    ("1112", "Lilas", (196, 186, 214)),
    ("1113", "Lavanda", (172, 158, 196)),
    ("1114", "Roxo", (118, 92, 148)),
    ("1115", "Cinza lilas", (176, 168, 182)),
    ("1122", "Terracota", (186, 106, 82)),
    ("1123", "Pele clara", (248, 216, 194)),
    ("1124", "Pele media", (226, 180, 148)),
)

CATALOG: tuple[Thread, ...] = tuple(
    Thread(code=code, name=name, rgb=rgb, brand="madeira-aprox") for code, name, rgb in _RAW
)


def load_catalog_csv(path: str | Path, brand: str = "custom") -> tuple[Thread, ...]:
    """Carrega um catalogo do fornecedor: colunas code,name,r,g,b (ou hex)."""
    threads: list[Thread] = []
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if "hex" in row and row.get("hex"):
                value = row["hex"].lstrip("#")
                rgb = tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))
            else:
                rgb = (int(row["r"]), int(row["g"]), int(row["b"]))
            threads.append(
                Thread(code=row["code"], name=row.get("name", row["code"]), rgb=rgb, brand=brand)
            )
    if not threads:
        raise ValueError(f"catalogo vazio: {path}")
    return tuple(threads)


def _srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def rgb_to_lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    """sRGB (0-255) -> CIE L*a*b* com iluminante D65."""
    r, g, b = (_srgb_to_linear(c / 255.0) for c in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 1.00000
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else (7.787 * t) + (16 / 116)

    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    """Distancia perceptual CIE76 — boa o bastante para escolher linha."""
    la, aa, ba = rgb_to_lab(a)
    lb, ab, bb = rgb_to_lab(b)
    return ((la - lb) ** 2 + (aa - ab) ** 2 + (ba - bb) ** 2) ** 0.5


def nearest_thread(
    rgb: tuple[int, int, int], catalog: tuple[Thread, ...] = CATALOG
) -> tuple[Thread, float]:
    """Linha mais proxima e o erro perceptual (deltaE) do casamento.

    deltaE < 2: imperceptivel. 2-5: aceitavel. > 10: escolha outra linha
    ou aumente o catalogo — vale avisar o operador na interface.
    """
    best = min(catalog, key=lambda t: delta_e(rgb, t.rgb))
    return best, delta_e(rgb, best.rgb)


def match_palette(
    colors: list[tuple[int, int, int]], catalog: tuple[Thread, ...] = CATALOG
) -> list[tuple[Thread, float]]:
    """Casa uma paleta inteira evitando repetir a mesma linha em duas cores."""
    used: set[str] = set()
    out: list[tuple[Thread, float]] = []
    for rgb in colors:
        ranked = sorted(catalog, key=lambda t: delta_e(rgb, t.rgb))
        pick = next((t for t in ranked if t.code not in used), ranked[0])
        used.add(pick.code)
        out.append((pick, delta_e(rgb, pick.rgb)))
    return out
