"""Exportacao. DST e nativo; os demais formatos usam pyembroidery."""

from __future__ import annotations

from pathlib import Path

from ..models import Design, StitchKind
from .brother import DEFAULT_PES_VERSION, PES_VERSIONS
from .dst import write_dst

NATIVE_FORMATS = ("dst",)
# Formatos delegados ao pyembroidery (opcional). Cobrem as domesticas mais
# comuns: Brother/Babylock (pes), Janome (jef), Melco (exp), Pfaff (vp3),
# Singer (xxx) e Husqvarna (hus).
# Formatos que interessam a maquinas domesticas/industriais comuns:
# Brother/Babylock (pes), Janome (jef), Melco (exp), Pfaff (vp3),
# Singer (xxx), Bernina (exp/pes), Husqvarna (vp3), Barudan (u01).
PREFERRED_OPTIONAL = ("pes", "jef", "exp", "vp3", "xxx", "u01", "pec", "csd")


class FormatUnavailable(RuntimeError):
    pass


def optional_formats() -> tuple[str, ...]:
    """Formatos que o pyembroidery instalado realmente sabe GRAVAR.

    Consultado em tempo de execucao: varias extensoes (hus, por exemplo)
    so tem leitor na biblioteca, e uma lista fixa mentiria para a interface.
    """
    try:
        import pyembroidery
    except ImportError:
        return ()
    writable = {
        entry["extension"].lower()
        for entry in pyembroidery.supported_formats()
        if entry.get("writer")
    }
    return tuple(fmt for fmt in PREFERRED_OPTIONAL if fmt in writable)


def available_formats() -> list[str]:
    return list(NATIVE_FORMATS) + list(optional_formats())


def to_pyembroidery(design: Design):
    import pyembroidery

    pattern = pyembroidery.EmbPattern()
    last_thread = None
    for block in design.blocks:
        if block.thread != last_thread:
            thread = pyembroidery.EmbThread()
            thread.set_color(*block.thread.rgb)
            thread.description = block.thread.name
            thread.catalog_number = block.thread.code
            pattern.add_thread(thread)
            if last_thread is not None:
                pattern.color_change()
            last_thread = block.thread
        for stitch in block.stitches:
            if stitch.kind is StitchKind.TRIM:
                pattern.trim()
                pattern.move_abs(stitch.x, stitch.y)
            elif stitch.kind is StitchKind.JUMP:
                pattern.move_abs(stitch.x, stitch.y)
            else:
                pattern.stitch_abs(stitch.x, stitch.y)
    pattern.end()
    return pattern


def write(
    design: Design,
    path: str | Path,
    fmt: str | None = None,
    pes_version: int = DEFAULT_PES_VERSION,
) -> Path:
    """Grava o desenho. `pes_version` so vale para PES (1 = universal, 6 = novo).

    PES v1 e o padrao porque toda Brother que le PES abre v1; v6 guarda nome
    de linha e miniatura, mas maquina antiga recusa o arquivo.
    """
    path = Path(path)
    fmt = (fmt or path.suffix.lstrip(".")).lower()

    if fmt in NATIVE_FORMATS:
        write_dst(design, path, label=design.name)
        return path

    if fmt not in optional_formats():
        raise FormatUnavailable(
            f"formato '{fmt}' nao suportado. Disponiveis: {', '.join(available_formats())}"
        )
    try:
        import pyembroidery
    except ImportError as exc:  # pragma: no cover
        raise FormatUnavailable(
            f"'{fmt}' precisa do pacote pyembroidery (pip install pyembroidery)"
        ) from exc

    settings = {}
    if fmt == "pes":
        if pes_version not in PES_VERSIONS:
            raise ValueError(f"versao de PES invalida: {pes_version}. Use {PES_VERSIONS}")
        settings["version"] = pes_version
    pyembroidery.write(to_pyembroidery(design), str(path), settings or None)
    return path
