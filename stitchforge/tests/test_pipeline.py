"""Testes do pipeline geometrico — as regras que protegem a maquina."""

import numpy as np
import pytest

from stitchforge.models import UNITS_PER_MM, StitchKind
from stitchforge.pipeline.builder import BuildOptions, order_runs
from stitchforge.pipeline.preprocess import PreprocessOptions, prepare
from stitchforge.pipeline.quantize import QuantizeOptions, quantize
from stitchforge.pipeline.stitches import (
    StitchOptions,
    elongation,
    plan_shape,
    running_stitch,
    satin_column,
    split_rails,
    tatami_fill,
)
from stitchforge.pipeline.threads import delta_e, nearest_thread
from stitchforge.pipeline.vectorize import Shape, mask_to_shapes


def square(size=200.0) -> Shape:
    return Shape(np.array([[0, 0], [size, 0], [size, size], [0, size]], float))


def test_area_discounts_holes():
    shape = Shape(
        square().outer,
        [np.array([[80, 80], [120, 80], [120, 120], [80, 120]], float)],
    )
    assert shape.area() == pytest.approx(200 * 200 - 40 * 40)


def test_fill_respects_max_stitch_length():
    options = StitchOptions(max_stitch_mm=3.0)
    runs = tatami_fill(square(), options)
    limit = options.max_stitch_mm * UNITS_PER_MM * 1.05
    for run in runs:
        points = np.array(run)
        lengths = np.linalg.norm(np.diff(points, axis=0), axis=1)
        # Ignora o salto entre carreiras (perpendicular, curto por construcao).
        assert lengths.max() <= max(limit, options.row_spacing_mm * UNITS_PER_MM * 2)


def test_fill_density_scales_with_spacing():
    dense = sum(len(r) for r in tatami_fill(square(), StitchOptions(row_spacing_mm=0.3)))
    sparse = sum(len(r) for r in tatami_fill(square(), StitchOptions(row_spacing_mm=0.9)))
    assert dense > sparse * 2


def test_fill_stays_inside_shape():
    runs = tatami_fill(square(), StitchOptions(pull_compensation_mm=0.0))
    points = np.vstack([np.array(r) for r in runs])
    assert points.min() >= -1.0 and points.max() <= 201.0


def test_hole_breaks_the_fill_into_runs():
    solid = tatami_fill(square(), StitchOptions())
    holed = tatami_fill(
        Shape(square().outer, [np.array([[80, 80], [120, 80], [120, 120], [80, 120]], float)]),
        StitchOptions(),
    )
    assert len(solid) == 1  # nada quebra um quadrado cheio
    assert len(holed) > 1  # o furo obriga a cortar e recomecar


def test_thin_elongated_uses_satin_and_blob_uses_tatami():
    ribbon = Shape(np.array([[0, 0], [400, 0], [400, 25], [0, 25]], float))
    blob = square(60.0)
    assert plan_shape(ribbon, StitchOptions()).technique == "satin"
    assert plan_shape(blob, StitchOptions()).technique == "tatami"


def test_split_rails_returns_two_sides():
    ribbon = np.array([[0, 0], [200, 0], [400, 0], [400, 25], [200, 25], [0, 25]], float)
    left, right = split_rails(ribbon)
    assert len(left) >= 2 and len(right) >= 2
    # Cada margem fica de um lado do eixo longo.
    assert abs(left[:, 1].mean() - right[:, 1].mean()) > 10


def test_satin_alternates_between_rails():
    ribbon = np.array([[0, 0], [400, 0], [400, 25], [0, 25]], float)
    run = np.array(satin_column(ribbon, StitchOptions()))
    even, odd = run[0::2, 1].mean(), run[1::2, 1].mean()
    assert abs(even - odd) > 5  # zigue-zague de verdade, nao linha reta


def test_elongation_distinguishes_ribbon_from_blob():
    assert elongation(np.array([[0, 0], [400, 0], [400, 20], [0, 20]], float)) > 5
    assert elongation(square().outer) < 1.5


def test_running_stitch_closes_the_ring():
    run = running_stitch(square().outer, StitchOptions())
    assert run[0] == run[-1]
    assert len(run) > 4


def test_order_runs_reduces_travel():
    runs = [
        [(0.0, 0.0), (10.0, 0.0)],
        [(1000.0, 1000.0), (1010.0, 1000.0)],
        [(20.0, 0.0), (30.0, 0.0)],
    ]
    ordered = order_runs(runs, (0.0, 0.0))
    assert ordered[0][0] == (0.0, 0.0)
    assert ordered[-1][0] == (1000.0, 1000.0)  # o distante fica por ultimo


def test_mask_to_shapes_finds_hole():
    mask = np.zeros((200, 200), np.uint8)
    mask[40:160, 40:160] = 255
    mask[90:110, 90:110] = 0
    shapes = mask_to_shapes(mask, mm_per_px=0.5, min_area_mm2=1.0)
    assert len(shapes) == 1
    assert len(shapes[0].holes) == 1


def test_nearest_thread_is_perceptual():
    thread, error = nearest_thread((255, 255, 255))
    assert thread.name == "Branco" and error < 1
    assert delta_e((0, 0, 0), (255, 255, 255)) > 50


def _synthetic_image() -> np.ndarray:
    """Circulo vermelho e quadrado azul sobre fundo branco (BGR)."""
    image = np.full((300, 300, 3), 255, np.uint8)
    import cv2

    cv2.circle(image, (100, 150), 60, (40, 40, 200), -1)
    cv2.rectangle(image, (170, 90), (270, 210), (200, 90, 40), -1)
    return image


def test_end_to_end_produces_stitches_and_layers():
    prepared = prepare(_synthetic_image(), PreprocessOptions(target_width_mm=80))
    layers = quantize(prepared, QuantizeOptions(colors=3))
    assert len(layers) >= 2

    from stitchforge.pipeline.builder import build_design

    design = build_design(prepared, layers, BuildOptions())
    assert design.stitch_count > 200
    width, height = design.size_mm()
    assert 60 < width <= 82  # respeita a largura pedida
    x0, y0, x1, y1 = design.bounds()
    assert abs(x0 + x1) <= 1 and abs(y0 + y1) <= 1  # centrado na origem


def test_every_run_starts_with_a_jump_and_ties():
    prepared = prepare(_synthetic_image(), PreprocessOptions(target_width_mm=80))
    layers = quantize(prepared, QuantizeOptions(colors=3))
    from stitchforge.pipeline.builder import build_design

    design = build_design(prepared, layers, BuildOptions())
    for block in design.blocks:
        assert block.stitches[0].kind is StitchKind.JUMP
        assert block.stitch_count > 0


def _textured_art(gap_px: int = 3) -> np.ndarray:
    """Figura clara com textura de linhas — como FOTO de um bordado pronto.

    E o caso que quebrava: o fundo entra pelas frestas da textura, e um
    fechamento morfologico na mascara de fundo soldava tudo por cima da
    figura, apagando o desenho inteiro e deixando so as areas densas.
    """
    import cv2

    image = np.full((400, 400, 3), 255, np.uint8)
    body = np.zeros((400, 400), np.uint8)
    cv2.circle(body, (150, 220), 90, 255, -1)
    for y in range(0, 400, 7):
        cv2.line(body, (0, y), (400, y), 0, gap_px)  # fresta clara
    image[body > 0] = (176, 196, 222)
    leaf = np.zeros((400, 400), np.uint8)
    cv2.ellipse(leaf, (310, 110), (60, 26), 30, 0, 360, 255, -1)
    image[leaf > 0] = (40, 90, 50)
    return image


@pytest.mark.parametrize("gap_px", [1, 2, 3, 4])
def test_texture_survives_background_removal(gap_px):
    prepared = prepare(_textured_art(gap_px), PreprocessOptions(target_width_mm=100))
    kept = (prepared.alpha > 0)
    # A figura clara fica na metade esquerda; a folha densa, no alto a direita.
    body_region = kept[130:310, 60:240]
    assert body_region.mean() > 0.6, "a figura texturizada foi apagada pelo fundo"
    assert kept[84:136, 250:370].mean() > 0.3, "a folha densa sumiu"


def test_flat_art_background_still_removed():
    """A correcao nao pode fazer o fundo liso deixar de ser removido."""
    import cv2

    image = np.full((300, 300, 3), 255, np.uint8)
    cv2.circle(image, (150, 150), 70, (40, 40, 200), -1)
    prepared = prepare(image, PreprocessOptions(target_width_mm=80))
    assert (prepared.alpha > 0).mean() < 0.30  # so o circulo, nao a folha toda
    assert prepared.alpha[150, 150] > 0        # e o circulo continua inteiro


def test_background_bridge_can_be_disabled():
    prepared = prepare(
        _textured_art(4), PreprocessOptions(target_width_mm=100, background_bridge_mm=0)
    )
    with_bridge = prepare(_textured_art(4), PreprocessOptions(target_width_mm=100))
    assert (with_bridge.alpha > 0).sum() > (prepared.alpha > 0).sum()
