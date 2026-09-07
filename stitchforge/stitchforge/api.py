"""API HTTP: sobe imagem, revisa a previa, baixa o arquivo da maquina."""

from __future__ import annotations

import io
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .formats.writer import available_formats, write
from .models import Design
from .pipeline.builder import BuildOptions, build_design
from .pipeline.preprocess import PreprocessOptions, prepare
from .pipeline.preview import color_sheet, design_to_png, design_to_svg
from .pipeline.quantize import QuantizeOptions, quantize
from .pipeline.stitches import StitchOptions
from .pipeline.threads import CATALOG

STATIC_DIR = Path(__file__).parent / "static"
WORK_DIR = Path(__file__).parent.parent / ".jobs"
WORK_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_BYTES = 20 * 1024 * 1024

app = FastAPI(title="StitchForge", version="0.1.0")


@dataclass
class Job:
    design: Design
    sheet: list[dict]
    warnings: list[str]


JOBS: dict[str, Job] = {}


def _decode(data: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise HTTPException(400, "nao consegui ler a imagem (use png, jpg ou webp)")
    return image


def _warnings(design: Design, layers) -> list[str]:
    out: list[str] = []
    for layer in layers:
        if layer.delta_e > 10:
            out.append(
                f"A cor {layer.source_rgb} ficou distante da linha "
                f"{layer.thread.code} ({layer.thread.name}), dE={layer.delta_e:.0f}. "
                "Considere trocar a linha na ficha ou usar um catalogo maior."
            )
    stats = design.stats()
    if stats["stitches"] > 40000:
        out.append(
            f"{stats['stitches']} pontos e muito para peca pequena: o tecido enruga. "
            "Reduza cores ou aumente o espacamento das carreiras."
        )
    if stats["trims"] > 60:
        out.append(
            f"{stats['trims']} cortes de linha. Cada corte e parada de maquina — "
            "aumente a area minima para eliminar respingos de cor."
        )
    if max(stats["width_mm"], stats["height_mm"]) > 360:
        out.append("Maior que qualquer bastidor comum (36 cm). Reduza o tamanho final.")
    return out


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return HTMLResponse((STATIC_DIR / "index.html").read_text(encoding="utf-8"))


@app.get("/api/info")
def info() -> dict:
    return {
        "formats": available_formats(),
        "catalog_size": len(CATALOG),
        "defaults": {
            "width_mm": 100,
            "colors": 6,
            "row_spacing_mm": StitchOptions().row_spacing_mm,
        },
    }


@app.post("/api/digitize")
async def digitize(
    file: UploadFile = File(...),
    width_mm: float = Form(100.0),
    colors: int = Form(6),
    row_spacing_mm: float = Form(0.40),
    min_area_mm2: float = Form(4.0),
    remove_background: bool = Form(True),
    preserve_dark_details: bool = Form(True),
    outline: bool = Form(True),
    underlay: bool = Form(True),
    name: str = Form("stitchforge"),
) -> JSONResponse:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "imagem maior que 20 MB")
    if not 10 <= width_mm <= 400:
        raise HTTPException(400, "largura final deve ficar entre 10 e 400 mm")
    if not 1 <= colors <= 16:
        raise HTTPException(400, "use de 1 a 16 cores")

    prepared = prepare(
        _decode(data),
        PreprocessOptions(target_width_mm=width_mm, remove_background=remove_background),
    )
    layers = quantize(
        prepared,
        QuantizeOptions(
            colors=colors,
            min_area_mm2=min_area_mm2,
            preserve_dark_details=preserve_dark_details,
        ),
    )
    if not layers:
        raise HTTPException(422, "nada sobrou depois da limpeza — revise o fundo da imagem")

    design = build_design(
        prepared,
        layers,
        BuildOptions(
            stitch=StitchOptions(
                row_spacing_mm=row_spacing_mm, outline=outline, underlay=underlay
            ),
            min_area_mm2=min_area_mm2,
        ),
        name=name or "stitchforge",
    )

    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = Job(design=design, sheet=color_sheet(design), warnings=_warnings(design, layers))
    return JSONResponse(
        {
            "job": job_id,
            "stats": design.stats(),
            "threads": JOBS[job_id].sheet,
            "warnings": JOBS[job_id].warnings,
            "formats": available_formats(),
        }
    )


def _job(job_id: str) -> Job:
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(404, "job expirado — envie a imagem de novo")
    return job


@app.get("/api/preview/{job_id}.svg")
def preview_svg(job_id: str, jumps: bool = True) -> Response:
    svg = design_to_svg(_job(job_id).design, show_jumps=jumps)
    return Response(svg, media_type="image/svg+xml")


@app.get("/api/preview/{job_id}.png")
def preview_png(job_id: str, px_per_mm: float = 5.0, jumps: bool = False) -> Response:
    canvas = design_to_png(_job(job_id).design, px_per_mm=px_per_mm, show_jumps=jumps)
    ok, buffer = cv2.imencode(".png", canvas)
    if not ok:  # pragma: no cover
        raise HTTPException(500, "falha ao gerar a previa")
    return Response(io.BytesIO(buffer.tobytes()).getvalue(), media_type="image/png")


@app.get("/api/download/{job_id}.{fmt}")
def download(job_id: str, fmt: str) -> FileResponse:
    job = _job(job_id)
    if fmt.lower() not in available_formats():
        raise HTTPException(400, f"formato indisponivel. Use: {', '.join(available_formats())}")
    path = WORK_DIR / f"{job_id}.{fmt.lower()}"
    write(job.design, path, fmt.lower())
    return FileResponse(
        path, filename=f"{job.design.name}.{fmt.lower()}", media_type="application/octet-stream"
    )


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
