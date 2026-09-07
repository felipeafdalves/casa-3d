"""Testes do alvo Brother/PES — o formato que vai para a maquina."""

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from stitchforge.api import app
from stitchforge.formats.brother import (
    DEFAULT_PES_VERSION,
    HOOPS,
    brother_catalog,
    hoop_by_name,
    smallest_hoop,
)
from stitchforge.formats.writer import write
from stitchforge.pipeline.builder import build_design
from stitchforge.pipeline.preprocess import PreprocessOptions, prepare
from stitchforge.pipeline.quantize import QuantizeOptions, quantize

pyembroidery = pytest.importorskip("pyembroidery")
client = TestClient(app)


def _art() -> np.ndarray:
    image = np.full((300, 300, 3), 255, np.uint8)
    cv2.circle(image, (110, 150), 70, (40, 40, 200), -1)
    cv2.rectangle(image, (180, 90), (280, 210), (200, 90, 40), -1)
    return image


def _design(colors=4, width_mm=80, catalog=None):
    prepared = prepare(_art(), PreprocessOptions(target_width_mm=width_mm))
    options = QuantizeOptions(colors=colors)
    if catalog is not None:
        options.catalog = catalog
    return build_design(prepared, quantize(prepared, options), name="teste")


def test_brother_palette_has_64_colors():
    catalog = brother_catalog()
    assert len(catalog) == 64
    assert all(thread.brand == "brother" for thread in catalog)
    assert all(0 <= channel <= 255 for thread in catalog for channel in thread.rgb)


def test_default_pes_version_is_the_universal_one():
    assert DEFAULT_PES_VERSION == 1


@pytest.mark.parametrize("version,signature", [(1, b"#PES0001"), (6, b"#PES0060")])
def test_pes_signature_matches_requested_version(tmp_path, version, signature):
    path = write(_design(), tmp_path / "d.pes", "pes", pes_version=version)
    assert path.read_bytes()[:8] == signature


def test_invalid_pes_version_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        write(_design(), tmp_path / "d.pes", "pes", pes_version=3)


def test_pes_preserves_size_and_colors(tmp_path):
    design = _design(catalog=brother_catalog())
    path = write(design, tmp_path / "d.pes", "pes")
    pattern = pyembroidery.read(str(path))

    xs = [s[0] for s in pattern.stitches]
    ys = [s[1] for s in pattern.stitches]
    assert (max(xs) - min(xs)) / 10 == pytest.approx(design.stats()["width_mm"], abs=0.5)
    assert (max(ys) - min(ys)) / 10 == pytest.approx(design.stats()["height_mm"], abs=0.5)
    assert pattern.count_color_changes() + 1 == design.color_count


def test_brother_palette_survives_without_substitution(tmp_path):
    """Cor fora da paleta e trocada pela maquina sem avisar; dentro dela, nao."""
    design = _design(catalog=brother_catalog())
    path = write(design, tmp_path / "d.pes", "pes")
    pattern = pyembroidery.read(str(path))

    written = [(t.get_red(), t.get_green(), t.get_blue()) for t in pattern.threadlist]
    expected = [block.thread.rgb for block in design.blocks]
    assert written == expected


def test_hoops_are_ordered_from_smallest():
    areas = [hoop.width_mm * hoop.height_mm for hoop in HOOPS]
    assert areas == sorted(areas)


@pytest.mark.parametrize(
    "size,expected",
    [
        ((90.0, 90.0), "4x4 (10x10 cm)"),
        ((120.0, 170.0), "5x7 (13x18 cm)"),
        ((150.0, 250.0), "6x10 (16x26 cm)"),
        ((400.0, 400.0), None),
    ],
)
def test_smallest_hoop_selection(size, expected):
    hoop = smallest_hoop(*size)
    assert (hoop.name if hoop else None) == expected


def test_hoop_allows_rotation_but_respects_margin():
    hoop = hoop_by_name("5x7")
    assert hoop.fits(120.0, 170.0)  # de pe
    assert hoop.fits(170.0, 120.0)  # deitado
    assert not hoop.fits(129.0, 179.0)  # sem folga para o pe calcador


def _digitize(**form):
    png = cv2.imencode(".png", _art())[1].tobytes()
    return client.post(
        "/api/digitize",
        files={"file": ("t.png", png, "image/png")},
        data={"width_mm": 80, "colors": 4, **form},
    )


def test_api_defaults_to_pes_and_fidelity_palette():
    defaults = client.get("/api/info").json()["defaults"]
    assert defaults["format"] == "pes"
    # Fidelidade e o padrao: restringir a arte a carta de 64 cores piora a cor
    # sem ganho fisico — a carta e so o visor, o cone e do operador.
    assert defaults["palette"] == "fidelity"
    assert client.get("/api/info").json()["pes_versions"] == [1, 6]


def _pastel_art() -> np.ndarray:
    """Aquarela infantil: pasteis suaves, que e onde a carta Brother sofre."""
    image = np.full((300, 300, 3), 255, np.uint8)
    cv2.circle(image, (110, 150), 70, (231, 205, 176), -1)      # azul bebe (BGR)
    cv2.circle(image, (200, 150), 60, (205, 202, 245), -1)      # rosa bebe
    cv2.rectangle(image, (60, 220), (240, 270), (168, 208, 186), -1)  # verde claro
    return image


def test_fidelity_palette_beats_brother_chart_on_pastels():
    from stitchforge.pipeline.threads import CATALOG

    prepared = prepare(_pastel_art(), PreprocessOptions(target_width_mm=80))
    fidelity = quantize(prepared, QuantizeOptions(colors=4, catalog=CATALOG))
    charted = quantize(prepared, QuantizeOptions(colors=4, catalog=brother_catalog()))
    # A carta de 64 cores nao tem tons pasteis; o catalogo de linhas reais tem.
    assert np.mean([layer.delta_e for layer in fidelity]) < np.mean(
        [layer.delta_e for layer in charted]
    )


def test_thread_sheet_reports_what_the_machine_shows():
    body = _digitize().json()
    assert body["hoop"] is not None
    brother_codes = {thread.code for thread in brother_catalog()}
    for row in body["threads"]:
        assert "machine_display" in row
        assert row["machine_display"].split()[0] in brother_codes
        assert row["machine_hex"].startswith("#")


def test_brother_palette_mode_restricts_codes():
    body = _digitize(palette="brother").json()
    codes = {thread["code"] for thread in body["threads"]}
    assert codes <= {thread.code for thread in brother_catalog()}


def test_api_warns_when_design_exceeds_selected_hoop():
    body = _digitize(width_mm=200, hoop="4x4 (10x10 cm)").json()
    assert any("nao cabe no bastidor" in w for w in body["warnings"])


def test_api_explains_machine_display_substitution():
    body = _digitize().json()
    assert any("visor" in w for w in body["warnings"])


def test_api_warns_when_brother_chart_restricts_color():
    body = _digitize(palette="brother").json()
    assert any("fidelidade de cor cai" in w for w in body["warnings"])


def test_api_rejects_bad_pes_version():
    assert _digitize(pes_version=9).status_code == 400


def test_api_download_pes_is_valid():
    job = _digitize().json()["job"]
    response = client.get(f"/api/download/{job}.pes")
    assert response.status_code == 200
    assert response.content[:8] == b"#PES0001"
