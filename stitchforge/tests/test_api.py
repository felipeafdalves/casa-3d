"""Testes da API — o contrato que a interface consome."""

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from stitchforge.api import app

client = TestClient(app)


def _png_bytes() -> bytes:
    image = np.full((300, 300, 3), 255, np.uint8)
    cv2.circle(image, (110, 150), 70, (40, 40, 200), -1)
    cv2.rectangle(image, (180, 90), (280, 210), (200, 90, 40), -1)
    return cv2.imencode(".png", image)[1].tobytes()


def _digitize(**form):
    return client.post(
        "/api/digitize",
        files={"file": ("teste.png", _png_bytes(), "image/png")},
        data={"width_mm": 80, "colors": 3, **form},
    )


def test_info_lists_dst():
    body = client.get("/api/info").json()
    assert "dst" in body["formats"]
    assert body["catalog_size"] > 20


def test_index_serves_ui():
    response = client.get("/")
    assert response.status_code == 200
    assert "StitchForge" in response.text


def test_digitize_returns_stats_and_thread_sheet():
    response = _digitize()
    assert response.status_code == 200
    body = response.json()
    assert body["stats"]["stitches"] > 200
    assert 60 < body["stats"]["width_mm"] <= 82
    assert len(body["threads"]) >= 2
    assert all(t["hex"].startswith("#") for t in body["threads"])


def test_preview_and_download_round_trip():
    job = _digitize().json()["job"]

    png = client.get(f"/api/preview/{job}.png")
    assert png.status_code == 200 and png.content[:4] == b"\x89PNG"

    svg = client.get(f"/api/preview/{job}.svg")
    assert svg.status_code == 200 and svg.text.startswith("<svg")

    dst = client.get(f"/api/download/{job}.dst")
    assert dst.status_code == 200
    assert len(dst.content) > 512
    assert dst.content.endswith(b"\x00\x00\xf3")
    assert dst.content[:3] == b"LA:"


@pytest.mark.parametrize(
    "form,status",
    [({"width_mm": 5}, 400), ({"width_mm": 900}, 400), ({"colors": 0}, 400), ({"colors": 99}, 400)],
)
def test_invalid_parameters_are_rejected(form, status):
    assert _digitize(**form).status_code == status


def test_unknown_job_is_404():
    assert client.get("/api/preview/naoexiste.png").status_code == 404
    assert client.get("/api/download/naoexiste.dst").status_code == 404


def test_broken_upload_is_rejected():
    response = client.post(
        "/api/digitize",
        files={"file": ("x.png", b"isso nao e imagem", "image/png")},
        data={"width_mm": 80, "colors": 3},
    )
    assert response.status_code == 400
