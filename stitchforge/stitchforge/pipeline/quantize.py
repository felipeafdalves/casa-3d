"""Reducao para N cores de linha, em espaco perceptual."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from ..models import Thread
from .threads import CATALOG, match_palette, nearest_thread
from .preprocess import PreparedImage


@dataclass
class QuantizeOptions:
    colors: int = 6
    min_area_mm2: float = 4.0
    catalog: tuple[Thread, ...] = CATALOG
    merge_similar_delta_e: float = 6.0
    # Olho, nariz e contorno preto ocupam area minuscula: o k-means por area
    # simplesmente os apaga, e sem eles o personagem perde a expressao.
    # Esta camada extra e extraida antes da quantizacao e costurada por ultimo.
    preserve_dark_details: bool = True
    dark_lightness_max: int = 78
    dark_min_area_mm2: float = 0.8


@dataclass
class ColorLayer:
    thread: Thread
    mask: np.ndarray  # HxW uint8, 255 = costurar
    source_rgb: tuple[int, int, int]
    delta_e: float
    area_mm2: float

    @property
    def coverage(self) -> float:
        return float((self.mask > 0).mean())


def _kmeans_lab(rgb: np.ndarray, mask: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    pixels = lab[mask > 0].astype(np.float32)
    if len(pixels) == 0:
        raise ValueError("imagem sem area util — ajuste a remocao de fundo")
    k = max(1, min(k, len(np.unique(pixels, axis=0))))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    _, labels, centers = cv2.kmeans(
        pixels, k, None, criteria, 4, cv2.KMEANS_PP_CENTERS
    )
    full = np.full(mask.shape, -1, np.int32)
    full[mask > 0] = labels.flatten()
    centers_rgb = cv2.cvtColor(centers.astype(np.uint8)[None, :, :], cv2.COLOR_LAB2RGB)[0]
    return full, centers_rgb


def _clean(mask: np.ndarray, min_area_px: int) -> np.ndarray:
    """Tira ilhas e furos pequenos: cada um deles custa corte + arremate."""
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    out = np.zeros_like(mask)
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= min_area_px:
            out[labels == index] = 255

    # Mesmo criterio para os furos (componentes do negativo cercados).
    inverted = cv2.bitwise_not(out)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(inverted, 8)
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] < min_area_px:
            out[labels == index] = 255
    return out


def _dark_detail_mask(prepared: PreparedImage, options: QuantizeOptions) -> np.ndarray:
    lab = cv2.cvtColor(prepared.rgb, cv2.COLOR_RGB2LAB)
    dark = ((lab[:, :, 0] <= options.dark_lightness_max) & (prepared.alpha > 0))
    mask = (dark.astype(np.uint8)) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    min_area_px = max(1, int(options.dark_min_area_mm2 / (prepared.mm_per_px ** 2)))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    out = np.zeros_like(mask)
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= min_area_px:
            out[labels == index] = 255
    return out


def quantize(prepared: PreparedImage, options: QuantizeOptions) -> list[ColorLayer]:
    detail_mask = (
        _dark_detail_mask(prepared, options)
        if options.preserve_dark_details
        else np.zeros_like(prepared.alpha)
    )
    if detail_mask.any():
        # Tira o detalhe da conta do k-means para ele nao puxar as medias.
        prepared = PreparedImage(
            rgb=prepared.rgb,
            alpha=np.where(detail_mask > 0, 0, prepared.alpha).astype(np.uint8),
            mm_per_px=prepared.mm_per_px,
        )

    labels, centers = _kmeans_lab(prepared.rgb, prepared.alpha, options.colors)
    px_area_mm2 = prepared.mm_per_px ** 2
    min_area_px = max(1, int(options.min_area_mm2 / px_area_mm2))

    palette = [tuple(int(c) for c in centers[i]) for i in range(len(centers))]
    matched = match_palette(palette, options.catalog)

    layers: list[ColorLayer] = []
    for index, (thread, error) in enumerate(matched):
        mask = _clean(np.where(labels == index, 255, 0).astype(np.uint8), min_area_px)
        area = float((mask > 0).sum()) * px_area_mm2
        if area < options.min_area_mm2:
            continue
        layers.append(
            ColorLayer(
                thread=thread,
                mask=mask,
                source_rgb=palette[index],
                delta_e=error,
                area_mm2=area,
            )
        )

    # Maior area primeiro: fundo costura antes, detalhe por cima — ordem
    # classica de bordado, evita que o fundo "coma" o desenho.
    layers.sort(key=lambda layer: layer.area_mm2, reverse=True)

    if detail_mask.any():
        rgb = tuple(
            int(v) for v in np.median(prepared.rgb[detail_mask > 0].reshape(-1, 3), axis=0)
        )
        thread, error = nearest_thread(rgb, options.catalog)
        layers.append(  # por ultimo: detalhe sempre por cima
            ColorLayer(
                thread=thread,
                mask=detail_mask,
                source_rgb=rgb,
                delta_e=error,
                area_mm2=float((detail_mask > 0).sum()) * px_area_mm2,
            )
        )
    return layers


def preview_flat(prepared: PreparedImage, layers: list[ColorLayer]) -> np.ndarray:
    """Imagem achatada nas cores de linha — o que o bordado vai parecer."""
    out = np.full((*prepared.alpha.shape, 3), 255, np.uint8)
    for layer in reversed(layers):
        out[layer.mask > 0] = layer.thread.rgb
    return out
