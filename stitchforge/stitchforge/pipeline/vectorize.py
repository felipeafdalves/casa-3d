"""Mascara de bits -> poligonos em decimilimetros."""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np

from ..models import UNITS_PER_MM


@dataclass
class Shape:
    """Um poligono com furos, em unidades de 0.1 mm."""

    outer: np.ndarray  # Nx2 float
    holes: list[np.ndarray] = field(default_factory=list)

    @property
    def rings(self) -> list[np.ndarray]:
        return [self.outer, *self.holes]

    def area(self) -> float:
        def ring_area(ring: np.ndarray) -> float:
            x, y = ring[:, 0], ring[:, 1]
            return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

        return ring_area(self.outer) - sum(ring_area(h) for h in self.holes)

    def bounds(self) -> tuple[float, float, float, float]:
        return (
            float(self.outer[:, 0].min()),
            float(self.outer[:, 1].min()),
            float(self.outer[:, 0].max()),
            float(self.outer[:, 1].max()),
        )

    def thickness_estimate(self) -> float:
        """Largura tipica da forma (2*area/perimetro).

        Serve para decidir entre satin (faixa fina, tipo galho e contorno) e
        tatami (area cheia). Bordar area grande em satin solta o ponto; bordar
        faixa fina em tatami fica ralo e sem brilho.
        """
        perimeter = sum(
            float(np.linalg.norm(np.diff(np.vstack([r, r[:1]]), axis=0), axis=1).sum())
            for r in self.rings
        )
        return 0.0 if perimeter == 0 else 4.0 * self.area() / perimeter


def _simplify(contour: np.ndarray, epsilon: float) -> np.ndarray:
    approx = cv2.approxPolyDP(contour, epsilon, True)
    return approx.reshape(-1, 2).astype(np.float64)


def mask_to_shapes(
    mask: np.ndarray,
    mm_per_px: float,
    simplify_mm: float = 0.25,
    min_area_mm2: float = 4.0,
) -> list[Shape]:
    """Contornos externos + furos, ja simplificados e em decimilimetros."""
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return []

    scale = mm_per_px * UNITS_PER_MM  # px -> 0.1 mm
    epsilon_px = max(simplify_mm / mm_per_px, 0.5)
    min_area_units = min_area_mm2 * (UNITS_PER_MM ** 2)

    hierarchy = hierarchy[0]
    shapes: list[Shape] = []
    for index, contour in enumerate(contours):
        if hierarchy[index][3] != -1:  # tem pai => e furo, tratado abaixo
            continue
        if len(contour) < 4:
            continue
        outer = _simplify(contour, epsilon_px) * scale
        if len(outer) < 3:
            continue

        holes: list[np.ndarray] = []
        child = hierarchy[index][2]
        while child != -1:
            if len(contours[child]) >= 4:
                hole = _simplify(contours[child], epsilon_px) * scale
                if len(hole) >= 3:
                    holes.append(hole)
            child = hierarchy[child][0]

        shape = Shape(outer=outer, holes=holes)
        if shape.area() >= min_area_units:
            shapes.append(shape)

    shapes.sort(key=lambda s: s.area(), reverse=True)
    return shapes


def point_inside(shape: Shape, x: float, y: float) -> bool:
    """Par-impar considerando furos."""
    inside = False
    for ring in shape.rings:
        crossings = 0
        px, py = ring[:, 0], ring[:, 1]
        qx, qy = np.roll(px, -1), np.roll(py, -1)
        straddles = (py > y) != (qy > y)
        with np.errstate(divide="ignore", invalid="ignore"):
            xs = px + (y - py) * (qx - px) / np.where(qy - py == 0, np.nan, qy - py)
        crossings = int(np.sum(straddles & (xs > x)))
        inside ^= bool(crossings % 2)
    return inside
