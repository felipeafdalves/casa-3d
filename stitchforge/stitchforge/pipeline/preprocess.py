"""Preparo da imagem antes de virar ponto.

Esta e a etapa que mais determina a qualidade final. Aquarela tem gradiente,
textura de papel e borda difusa; bordado nao tem nada disso. Aqui a imagem e
deliberadamente *achatada* — quem espera fidelidade fotografica vai se
frustrar, e o certo e frustrar cedo, na previa, e nao na maquina.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class PreprocessOptions:
    target_width_mm: float = 100.0  # largura do desenho no bastidor
    max_pixels: int = 900_000
    remove_background: bool = True
    background_tolerance: int = 18
    # Regiao da cor do fundo, fechada dentro do desenho e maior que isto
    # (em % da area da imagem), tambem vira fundo: e o "miolo" de uma
    # moldura, nao um detalhe. Brilhos pequenos continuam sendo costurados.
    enclosed_background_pct: float = 3.0
    # Largura maxima de "fresta" pela qual o fundo pode entrar na arte antes de
    # ser considerado invasao, e nao fundo. Foto de bordado, hachura e meio tom
    # tem textura clara ligada ao fundo: sem isto, o fundo entra pela textura e
    # a figura inteira e apagada. Em arte chapada nao faz diferenca.
    background_bridge_mm: float = 1.5
    smooth: int = 5  # 0 desliga; valores altos comem detalhe fino
    boost_saturation: float = 1.15


@dataclass
class PreparedImage:
    rgb: np.ndarray  # HxWx3 uint8
    alpha: np.ndarray  # HxW uint8 (255 = costurar aqui)
    mm_per_px: float

    @property
    def size_mm(self) -> tuple[float, float]:
        h, w = self.alpha.shape
        return (w * self.mm_per_px, h * self.mm_per_px)


def _fit(image: np.ndarray, max_pixels: int) -> np.ndarray:
    h, w = image.shape[:2]
    if h * w <= max_pixels:
        return image
    scale = (max_pixels / (h * w)) ** 0.5
    return cv2.resize(
        image, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA
    )


def _fill_small_holes(mask: np.ndarray, max_area: int) -> np.ndarray:
    """Preenche buracos da mascara menores que `max_area` pixels."""
    inverted = cv2.bitwise_not(mask)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(inverted, 8)
    out = mask.copy()
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] <= max_area:
            out[labels == index] = 255
    return out


def _background_mask(rgb: np.ndarray, tolerance: int, bridge_px: int = 0) -> np.ndarray:
    """Fundo = regiao conectada as bordas com cor parecida com os cantos.

    Usa floodFill a partir dos 4 cantos em vez de "tudo que e claro":
    branco *dentro* do desenho (a barriga do ursinho, o miolo do quadro)
    precisa continuar sendo costurado.
    """
    h, w = rgb.shape[:2]
    filled = rgb.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    lo = up = (tolerance,) * 3
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        cv2.floodFill(
            filled, mask, seed, (0, 0, 0), lo, up,
            cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8),
        )
    background = mask[1:-1, 1:-1]
    # Tapa APENAS furinhos do fundo, por area. Um fechamento morfologico faria
    # o mesmo em aparencia, mas solda o fundo por cima de qualquer traco mais
    # fino que o nucleo: em arte com textura (foto de bordado, hachura, meio
    # tom), o fundo entra pelas frestas e o fechamento engole a figura inteira.
    if bridge_px >= 3:
        # Abertura: apaga fiapos de fundo mais finos que `bridge_px` sem soldar
        # nada. Um fechamento faria o inverso — grudaria o fundo por cima de
        # qualquer traco fino da arte, apagando a figura.
        background = cv2.morphologyEx(
            background, cv2.MORPH_OPEN, np.ones((bridge_px, bridge_px), np.uint8)
        )
    # Tapa APENAS furinhos do fundo, por area.
    return _fill_small_holes(background, max_area=max(24, int(rgb[:, :, 0].size * 2e-5)))


def _enclosed_background(rgb: np.ndarray, background: np.ndarray, tolerance: int,
                         min_area_px: int) -> np.ndarray:
    """Areas fechadas com a cor do fundo e grandes o bastante para serem vazio.

    Sem isso, o miolo branco de uma moldura vira 30% da peca em linha branca:
    caro, pesado e por cima do lugar onde entra a foto ou o nome.
    """
    if background.any():
        reference = np.median(rgb[background > 0].reshape(-1, 3), axis=0)
    else:
        corners = np.concatenate([rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]])
        reference = np.median(corners.reshape(-1, 3), axis=0)

    distance = np.linalg.norm(rgb.astype(np.int16) - reference.astype(np.int16), axis=2)
    # Mesma tolerancia da inundacao, e nao uma frouxa: "fechado e da cor do
    # fundo" tem que significar a cor do fundo mesmo. Com tolerancia frouxa um
    # elemento palido colado no miolo (o aro claro de uma moldura) e engolido
    # junto — falha silenciosa, o elemento simplesmente some do bordado. Deixar
    # miolo branco a mais, ao contrario, aparece na previa e o operador corrige.
    similar = ((distance <= tolerance) & (background == 0)).astype(np.uint8) * 255
    similar = cv2.morphologyEx(similar, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))

    count, labels, stats, _ = cv2.connectedComponentsWithStats(similar, 8)
    out = np.zeros_like(similar)
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= min_area_px:
            out[labels == index] = 255
    return out


def prepare(image_bgr_or_bgra: np.ndarray, options: PreprocessOptions) -> PreparedImage:
    image = _fit(image_bgr_or_bgra, options.max_pixels)

    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    if image.shape[2] == 4:
        alpha = image[:, :, 3].copy()
        rgb = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2RGB)
        # Fundo transparente: o alfa ja e a mascara, nao precisa adivinhar.
        alpha = np.where(alpha > 127, 255, 0).astype(np.uint8)
    else:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        alpha = np.full(rgb.shape[:2], 255, np.uint8)

    if options.smooth > 0:
        # Bilateral preserva a borda enquanto mata a textura do papel —
        # blur gaussiano aqui borraria justamente o que vira contorno.
        rgb = cv2.bilateralFilter(rgb, options.smooth * 2 + 1, 45, 45)

    if options.boost_saturation != 1.0:
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * options.boost_saturation, 0, 255)
        rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)

    if options.remove_background and image.shape[2] != 4:
        # Escala provisoria pela largura da imagem — basta para dimensionar a
        # abertura em milimetros antes de saber o recorte final do desenho.
        provisional_mm_per_px = options.target_width_mm / max(rgb.shape[1], 1)
        bridge_px = int(round(options.background_bridge_mm / provisional_mm_per_px))
        bridge_px = max(0, min(bridge_px | 1, 21))  # impar, e com teto
        background = _background_mask(rgb, options.background_tolerance, bridge_px)
        alpha[background > 0] = 0
        if options.enclosed_background_pct > 0:
            min_area_px = int(alpha.size * options.enclosed_background_pct / 100.0)
            enclosed = _enclosed_background(
                rgb, background, options.background_tolerance, min_area_px
            )
            alpha[enclosed > 0] = 0

    # Come 1px da borda: pixel de transicao vira ponto solto no tecido.
    alpha = cv2.erode(alpha, np.ones((3, 3), np.uint8), iterations=1)

    # A escala e calculada sobre o DESENHO, nao sobre a imagem: quem pede
    # 90 mm quer a peca com 90 mm no bastidor, e nao a folha em branco em
    # volta dela com 90 mm.
    columns = np.where(alpha.any(axis=0))[0]
    subject_width_px = int(columns[-1] - columns[0] + 1) if len(columns) else alpha.shape[1]
    mm_per_px = options.target_width_mm / max(subject_width_px, 1)
    return PreparedImage(rgb=rgb, alpha=alpha, mm_per_px=mm_per_px)
