"""Geracao de pontos a partir dos poligonos.

Tudo em decimilimetros (0.1 mm). Os valores padrao seguem pratica comum de
bordado em malha/algodao com linha 40: 0.40 mm entre carreiras de tatami,
ponto de no maximo 4 mm e no minimo 0.6 mm (ponto menor que isso e onde a
agulha fura o mesmo furo e arrebenta a linha).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from ..models import UNITS_PER_MM
from .vectorize import Shape

Run = list[tuple[float, float]]


@dataclass
class StitchOptions:
    row_spacing_mm: float = 0.40
    max_stitch_mm: float = 4.0
    min_stitch_mm: float = 0.6
    angle_deg: float = 45.0
    stagger: tuple[float, ...] = (0.0, 0.5, 0.25, 0.75)
    pull_compensation_mm: float = 0.15
    underlay: bool = True
    underlay_inset_mm: float = 0.7
    outline: bool = True
    outline_length_mm: float = 2.0
    satin_max_width_mm: float = 6.0
    satin_density_mm: float = 0.35
    satin_min_elongation: float = 2.5
    connect_max_mm: float = 6.0

    def units(self, value_mm: float) -> float:
        return value_mm * UNITS_PER_MM


def _rotation(angle_deg: float) -> np.ndarray:
    a = math.radians(angle_deg)
    return np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])


def _rotate(points: np.ndarray, angle_deg: float) -> np.ndarray:
    return points @ _rotation(angle_deg).T


def _row_intersections(rings: list[np.ndarray], y: float) -> list[float]:
    xs: list[float] = []
    for ring in rings:
        p = ring
        q = np.roll(ring, -1, axis=0)
        straddles = ((p[:, 1] > y) != (q[:, 1] > y))
        if not straddles.any():
            continue
        p, q = p[straddles], q[straddles]
        t = (y - p[:, 1]) / (q[:, 1] - p[:, 1])
        xs.extend((p[:, 0] + t * (q[:, 0] - p[:, 0])).tolist())
    xs.sort()
    return xs


def _inside(rings: list[np.ndarray], x: float, y: float) -> bool:
    """Par-impar sobre aneis ja rotacionados (externo + furos juntos)."""
    crossings = 0
    for ring in rings:
        p, q = ring, np.roll(ring, -1, axis=0)
        straddles = (p[:, 1] > y) != (q[:, 1] > y)
        if not straddles.any():
            continue
        ps, qs = p[straddles], q[straddles]
        t = (y - ps[:, 1]) / (qs[:, 1] - ps[:, 1])
        crossings += int(np.sum((ps[:, 0] + t * (qs[:, 0] - ps[:, 0])) > x))
    return crossings % 2 == 1


def _subdivide(
    start: tuple[float, float], end: tuple[float, float], max_len: float, offset: float
) -> Run:
    """Quebra um segmento em pontos, com deslocamento inicial (escalonamento).

    O offset e o que impede a "linha de emenda": sem ele, todas as carreiras
    terminam no mesmo x e aparece um vinco no bordado.
    """
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    if length == 0:
        return [start]
    ux, uy = dx / length, dy / length

    # Primeiro ponto deslocado (escalonamento), depois passo uniforme: dividir
    # o resto em partes iguais garante que NENHUM ponto passe do maximo e que
    # o ultimo nao fique curto demais (agulha no mesmo furo arrebenta a linha).
    head = offset * max_len
    if head <= 0 or head >= length:
        head = 0.0

    points: Run = [start]
    if head > 0:
        points.append((start[0] + ux * head, start[1] + uy * head))
    remaining = length - head
    count = max(1, math.ceil(remaining / max_len))
    step = remaining / count
    for index in range(1, count + 1):
        distance = head + step * index
        points.append((start[0] + ux * distance, start[1] + uy * distance))
    return points


def tatami_fill(shape: Shape, options: StitchOptions) -> list[Run]:
    """Preenchimento em carreiras paralelas com escalonamento."""
    angle = options.angle_deg
    rings = [_rotate(r, -angle) for r in shape.rings]
    all_points = np.vstack(rings)
    y_min, y_max = float(all_points[:, 1].min()), float(all_points[:, 1].max())

    spacing = options.units(options.row_spacing_mm)
    max_len = options.units(options.max_stitch_mm)
    min_len = options.units(options.min_stitch_mm)
    pull = options.units(options.pull_compensation_mm)
    connect_max = options.units(options.connect_max_mm)

    runs: list[Run] = []
    current: Run = []
    last_raw: tuple[float, float] = (0.0, 0.0)
    row_index = 0
    y = y_min + spacing / 2

    while y < y_max:
        xs = _row_intersections(rings, y)
        segments: list[tuple[float, float]] = []
        for i in range(0, len(xs) - 1, 2):
            if xs[i + 1] - xs[i] >= min_len:
                segments.append((xs[i], xs[i + 1]))

        if row_index % 2 == 1:
            segments = [(b, a) for a, b in reversed(segments)]

        offset = options.stagger[row_index % len(options.stagger)]
        for raw_start, raw_end in segments:
            direction = 1.0 if raw_end >= raw_start else -1.0
            start = (raw_start - direction * pull, y)
            end = (raw_end + direction * pull, y)
            if current:
                gap = math.hypot(raw_start - last_raw[0], y - last_raw[1])
                # Conector curto entre carreiras vizinhas e sempre valido; so
                # o conector longo precisa provar que nao atravessa um furo,
                # senao fica linha solta cruzando a peca.
                if gap > connect_max:
                    runs.append(current)
                    current = []
                elif gap > spacing * 3:
                    samples = [
                        (last_raw[0] + (raw_start - last_raw[0]) * t,
                         last_raw[1] + (y - last_raw[1]) * t)
                        for t in (0.3, 0.5, 0.7)
                    ]
                    if any(not _inside(rings, sx, sy) for sx, sy in samples):
                        runs.append(current)
                        current = []
            if current:
                # O proprio conector e um ponto: se for mais longo que o
                # maximo, a agulha nao da conta e a linha arrebenta.
                connector = _subdivide(current[-1], start, max_len, 0.0)
                current.extend(connector[1:])
            current.extend(_subdivide(start, end, max_len, offset))
            last_raw = (raw_end, y)
        row_index += 1
        y += spacing

    if current:
        runs.append(current)

    return [[tuple(p) for p in _rotate(np.array(run), angle)] for run in runs if len(run) > 1]


def running_stitch(ring: np.ndarray, options: StitchOptions, length_mm: float | None = None) -> Run:
    """Ponto corrido ao longo de um anel — usado em contorno e underlay."""
    step = options.units(length_mm if length_mm is not None else options.outline_length_mm)
    closed = np.vstack([ring, ring[:1]])
    out: Run = [tuple(closed[0])]
    carry = 0.0
    for start, end in zip(closed[:-1], closed[1:]):
        segment = float(np.linalg.norm(end - start))
        if segment == 0:
            continue
        direction = (end - start) / segment
        position = step - carry
        while position < segment:
            point = start + direction * position
            out.append((float(point[0]), float(point[1])))
            position += step
        carry = (carry + segment) % step
    out.append(tuple(closed[0]))
    return out


def _offset_ring(ring: np.ndarray, distance: float) -> np.ndarray:
    """Deslocamento aproximado do anel pela normal media de cada vertice."""
    previous = np.roll(ring, 1, axis=0)
    following = np.roll(ring, -1, axis=0)
    tangent = following - previous
    norm = np.linalg.norm(tangent, axis=1, keepdims=True)
    norm[norm == 0] = 1.0
    tangent = tangent / norm
    normal = np.stack([-tangent[:, 1], tangent[:, 0]], axis=1)

    # Orientacao: area assinada negativa => normal aponta para fora.
    x, y = ring[:, 0], ring[:, 1]
    signed = 0.5 * (np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
    if signed > 0:
        normal = -normal
    return ring + normal * distance


def elongation(ring: np.ndarray) -> float:
    """Razao comprimento/largura via PCA. Faixa de fita ~ alto; bolha ~ 1."""
    centered = ring - ring.mean(axis=0)
    if len(centered) < 3:
        return 1.0
    eigenvalues = np.linalg.eigvalsh(np.cov(centered.T))
    minor = max(float(eigenvalues.min()), 1e-9)
    return float((eigenvalues.max() / minor) ** 0.5)


def split_rails(ring: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Parte um contorno alongado nas duas pontas, devolvendo as margens.

    Satin nao se faz deslocando o contorno para fora e para dentro: num
    contorno fino esse deslocamento se auto-intersecta e o resultado vira
    espinho. As duas margens reais sao os dois lados do contorno entre as
    pontas — encontradas projetando na componente principal.
    """
    centered = ring - ring.mean(axis=0)
    _, _, components = np.linalg.svd(centered, full_matrices=False)
    projection = centered @ components[0]
    start, end = int(projection.argmin()), int(projection.argmax())
    if start > end:
        start, end = end, start
    rail_a = ring[start : end + 1]
    rail_b = np.vstack([ring[end:], ring[: start + 1]])[::-1]
    return rail_a, rail_b


def _resample(points: np.ndarray, count: int) -> np.ndarray:
    """Reamostra por comprimento de arco — passo constante ao longo da margem."""
    if len(points) < 2:
        return np.repeat(points, count, axis=0)[:count]
    steps = np.linalg.norm(np.diff(points, axis=0), axis=1)
    distance = np.concatenate([[0.0], np.cumsum(steps)])
    total = distance[-1]
    if total == 0:
        return np.repeat(points[:1], count, axis=0)
    targets = np.linspace(0, total, count)
    return np.stack(
        [np.interp(targets, distance, points[:, axis]) for axis in (0, 1)], axis=1
    )


def satin_column(ring: np.ndarray, options: StitchOptions) -> Run:
    """Zigue-zague entre as duas margens de uma forma alongada."""
    rail_a, rail_b = split_rails(ring)
    length = max(
        float(np.linalg.norm(np.diff(rail_a, axis=0), axis=1).sum()),
        float(np.linalg.norm(np.diff(rail_b, axis=0), axis=1).sum()),
    )
    count = max(4, int(length / options.units(options.satin_density_mm)))
    left, right = _resample(rail_a, count), _resample(rail_b, count)
    out: Run = []
    for index in range(count):
        source = left if index % 2 == 0 else right
        out.append((float(source[index, 0]), float(source[index, 1])))
    return out


def underlay_runs(shape: Shape, options: StitchOptions) -> list[Run]:
    """Base que segura o tecido e evita que o preenchimento afunde."""
    inset = options.units(options.underlay_inset_mm)
    runs: list[Run] = []
    for ring in shape.rings:
        if len(ring) < 3:
            continue
        inner = _offset_ring(ring, -inset)
        runs.append(running_stitch(inner, options, options.max_stitch_mm * 0.6))
    return runs


@dataclass
class ShapePlan:
    """Como uma forma sera costurada — decidido pela geometria, nao pelo chute."""

    shape: Shape
    technique: str  # "satin" | "tatami"
    runs: list[Run] = field(default_factory=list)


def plan_shape(shape: Shape, options: StitchOptions) -> ShapePlan:
    """Escolhe a tecnica pela geometria da forma.

    Satin so entra em faixa fina E alongada (fita, galho, contorno). Bolha
    pequena e redonda em satin fica com ponto atravessado; area grande em
    satin solta no primeiro uso. Nos dois casos o certo e tatami.
    """
    thickness_mm = shape.thickness_estimate() / UNITS_PER_MM
    is_thin = thickness_mm <= options.satin_max_width_mm
    is_elongated = elongation(shape.outer) >= options.satin_min_elongation
    if is_thin and is_elongated and not shape.holes and len(shape.outer) >= 4:
        return ShapePlan(shape=shape, technique="satin", runs=[satin_column(shape.outer, options)])

    runs = []
    if options.underlay:
        runs.extend(underlay_runs(shape, options))
    runs.extend(tatami_fill(shape, options))
    if options.outline:
        runs.extend(running_stitch(r, options) for r in shape.rings)
    return ShapePlan(shape=shape, technique="tatami", runs=runs)
