"""Modelo de dados do desenho de bordado.

Unidade interna: *decimilimetro* (0.1 mm), a mesma do formato Tajima DST.
Todo o pipeline trabalha em inteiros nessa unidade para evitar erro de
arredondamento acumulado na hora de exportar.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable, Iterator

UNITS_PER_MM = 10.0


class StitchKind(str, Enum):
    NORMAL = "normal"
    JUMP = "jump"
    TRIM = "trim"
    COLOR_CHANGE = "color_change"


@dataclass(frozen=True)
class Thread:
    """Uma linha de bordado de um catalogo comercial."""

    code: str
    name: str
    rgb: tuple[int, int, int]
    brand: str = "generic"

    @property
    def hex(self) -> str:
        return "#%02x%02x%02x" % self.rgb


@dataclass
class Stitch:
    x: int
    y: int
    kind: StitchKind = StitchKind.NORMAL


@dataclass
class Block:
    """Sequencia continua de pontos costurada com uma unica linha."""

    thread: Thread
    stitches: list[Stitch] = field(default_factory=list)
    label: str = ""

    def add(self, x: float, y: float, kind: StitchKind = StitchKind.NORMAL) -> None:
        self.stitches.append(Stitch(int(round(x)), int(round(y)), kind))

    @property
    def stitch_count(self) -> int:
        return sum(1 for s in self.stitches if s.kind is StitchKind.NORMAL)

    def __bool__(self) -> bool:
        return bool(self.stitches)


@dataclass
class Design:
    blocks: list[Block] = field(default_factory=list)
    name: str = "stitchforge"

    def iter_stitches(self) -> Iterator[tuple[Stitch, Thread]]:
        for block in self.blocks:
            for stitch in block.stitches:
                yield stitch, block.thread

    @property
    def stitch_count(self) -> int:
        return sum(b.stitch_count for b in self.blocks)

    @property
    def color_count(self) -> int:
        """Numero de trocas de linha (cores consecutivas iguais nao contam)."""
        count = 0
        last: Thread | None = None
        for block in self.blocks:
            if block.thread != last:
                count += 1
                last = block.thread
        return count

    def bounds(self) -> tuple[int, int, int, int]:
        xs = [s.x for s, _ in self.iter_stitches()]
        ys = [s.y for s, _ in self.iter_stitches()]
        if not xs:
            return (0, 0, 0, 0)
        return (min(xs), min(ys), max(xs), max(ys))

    def size_mm(self) -> tuple[float, float]:
        x0, y0, x1, y1 = self.bounds()
        return ((x1 - x0) / UNITS_PER_MM, (y1 - y0) / UNITS_PER_MM)

    def translate(self, dx: int, dy: int) -> None:
        for stitch, _ in self.iter_stitches():
            stitch.x += dx
            stitch.y += dy

    def center(self) -> None:
        """Centraliza no (0,0) — a maioria das maquinas espera origem central."""
        x0, y0, x1, y1 = self.bounds()
        self.translate(-(x0 + x1) // 2, -(y0 + y1) // 2)

    def threads(self) -> list[Thread]:
        out: list[Thread] = []
        for block in self.blocks:
            if not out or out[-1] != block.thread:
                out.append(block.thread)
        return out

    def stats(self) -> dict:
        w, h = self.size_mm()
        jumps = sum(
            1 for s, _ in self.iter_stitches() if s.kind is StitchKind.JUMP
        )
        trims = sum(
            1 for s, _ in self.iter_stitches() if s.kind is StitchKind.TRIM
        )
        return {
            "stitches": self.stitch_count,
            "jumps": jumps,
            "trims": trims,
            "colors": self.color_count,
            "width_mm": round(w, 1),
            "height_mm": round(h, 1),
            "blocks": len(self.blocks),
        }


def flatten(blocks: Iterable[Block]) -> Design:
    return Design(blocks=[b for b in blocks if b])
