"""Monta o Design final: ordem de costura, saltos, cortes e arremates."""

from __future__ import annotations

import math
from dataclasses import dataclass

from ..models import Block, Design, StitchKind, UNITS_PER_MM
from .quantize import ColorLayer
from .preprocess import PreparedImage
from .stitches import Run, StitchOptions, plan_shape
from .vectorize import mask_to_shapes


@dataclass
class BuildOptions:
    stitch: StitchOptions = None
    simplify_mm: float = 0.25
    min_area_mm2: float = 4.0
    trim_distance_mm: float = 8.0
    tie_stitch_mm: float = 0.8
    tie_count: int = 3
    # Angulo diferente por cor evita que duas cores vizinhas "somem" entre si
    # e reparte a tensao do tecido em direcoes diferentes.
    angle_step_deg: float = 17.0

    def __post_init__(self) -> None:
        if self.stitch is None:
            self.stitch = StitchOptions()


def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def order_runs(runs: list[Run], start: tuple[float, float] = (0.0, 0.0)) -> list[Run]:
    """Vizinho mais proximo: cada milimetro de salto e tempo de maquina.

    Tambem inverte o run quando o fim dele estiver mais perto que o inicio —
    a direcao de um preenchimento nao importa para o resultado visual.
    """
    remaining = list(runs)
    ordered: list[Run] = []
    cursor = start
    while remaining:
        best_index = 0
        best_cost = float("inf")
        best_reversed = False
        for index, run in enumerate(remaining):
            head = _distance(cursor, run[0])
            tail = _distance(cursor, run[-1])
            cost, flipped = (head, False) if head <= tail else (tail, True)
            if cost < best_cost:
                best_index, best_cost, best_reversed = index, cost, flipped
        run = remaining.pop(best_index)
        if best_reversed:
            run = list(reversed(run))
        ordered.append(run)
        cursor = run[-1]
    return ordered


def _add_ties(block: Block, run: Run, options: BuildOptions, closing: bool) -> None:
    """Arremate: pontos curtos que travam a linha antes do corte.

    Sem isso o bordado desfia na primeira lavagem — e o defeito mais comum
    de arquivo gerado automaticamente.
    """
    length = options.tie_stitch_mm * UNITS_PER_MM
    anchor = run[-1] if closing else run[0]
    neighbor = run[-2] if closing and len(run) > 1 else (run[1] if len(run) > 1 else run[0])
    dx, dy = neighbor[0] - anchor[0], neighbor[1] - anchor[1]
    norm = math.hypot(dx, dy) or 1.0
    ux, uy = dx / norm * length, dy / norm * length
    for index in range(options.tie_count):
        target = anchor if index % 2 else (anchor[0] + ux, anchor[1] + uy)
        block.add(target[0], target[1])


def build_layer_block(
    layer: ColorLayer,
    prepared: PreparedImage,
    options: BuildOptions,
    angle_deg: float,
    cursor: tuple[float, float],
) -> tuple[Block, tuple[float, float]]:
    stitch_options = StitchOptions(**{**options.stitch.__dict__, "angle_deg": angle_deg})
    shapes = mask_to_shapes(
        layer.mask, prepared.mm_per_px, options.simplify_mm, options.min_area_mm2
    )

    runs: list[Run] = []
    techniques: list[str] = []
    for shape in shapes:
        plan = plan_shape(shape, stitch_options)
        techniques.append(plan.technique)
        runs.extend(r for r in plan.runs if len(r) > 1)

    block = Block(thread=layer.thread, label=f"{layer.thread.code} {layer.thread.name}")
    if not runs:
        return block, cursor

    trim_distance = options.trim_distance_mm * UNITS_PER_MM
    for run in order_runs(runs, cursor):
        gap = _distance(cursor, run[0])
        if block.stitches:
            kind = StitchKind.TRIM if gap > trim_distance else StitchKind.JUMP
            block.add(run[0][0], run[0][1], kind)
        else:
            block.add(run[0][0], run[0][1], StitchKind.JUMP)
        _add_ties(block, run, options, closing=False)
        for x, y in run:
            block.add(x, y)
        _add_ties(block, run, options, closing=True)
        cursor = run[-1]

    block.label += f" [{'/'.join(sorted(set(techniques)))}]"
    return block, cursor


def build_design(
    prepared: PreparedImage,
    layers: list[ColorLayer],
    options: BuildOptions | None = None,
    name: str = "stitchforge",
) -> Design:
    options = options or BuildOptions()
    design = Design(name=name)
    cursor = (0.0, 0.0)
    for index, layer in enumerate(layers):
        angle = (options.stitch.angle_deg + index * options.angle_step_deg) % 180
        block, cursor = build_layer_block(layer, prepared, options, angle, cursor)
        if block:
            design.blocks.append(block)
    design.center()
    return design
