"""Simulacao visual do arquivo de bordado.

A previa e desenhada a partir dos PONTOS gerados, nunca da imagem original.
E proposital: e a unica forma do operador ver o que a maquina vai fazer —
inclusive os saltos e a densidade — antes de gastar linha e tecido.
"""

from __future__ import annotations

from xml.sax.saxutils import escape

from ..models import Design, StitchKind, UNITS_PER_MM


def design_to_svg(
    design: Design,
    show_jumps: bool = True,
    stitch_width_mm: float = 0.32,
    background: str = "#f4f1ea",
) -> str:
    x0, y0, x1, y1 = design.bounds()
    pad = int(2 * UNITS_PER_MM)
    width, height = (x1 - x0) + 2 * pad, (y1 - y0) + 2 * pad

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0 - pad} {y0 - pad} {width} {height}" '
        f'width="{width / UNITS_PER_MM:.1f}mm" height="{height / UNITS_PER_MM:.1f}mm">',
        f'<rect x="{x0 - pad}" y="{y0 - pad}" width="{width}" height="{height}" fill="{background}"/>',
    ]

    stroke = stitch_width_mm * UNITS_PER_MM
    jumps: list[str] = []
    cursor: tuple[int, int] | None = None

    for block in design.blocks:
        path: list[str] = []
        pen_down = False
        for stitch in block.stitches:
            if stitch.kind in (StitchKind.JUMP, StitchKind.TRIM):
                if cursor is not None and show_jumps:
                    jumps.append(f"M{cursor[0]},{cursor[1]} L{stitch.x},{stitch.y}")
                pen_down = False
            else:
                if not pen_down:
                    path.append(f"M{stitch.x},{stitch.y}")
                    pen_down = True
                else:
                    path.append(f"L{stitch.x},{stitch.y}")
            cursor = (stitch.x, stitch.y)
        if path:
            parts.append(
                f'<path d="{" ".join(path)}" fill="none" stroke="{block.thread.hex}" '
                f'stroke-width="{stroke:.1f}" stroke-linecap="round" stroke-linejoin="round" '
                f'opacity="0.95"><title>{escape(block.label)}</title></path>'
            )

    if jumps and show_jumps:
        parts.append(
            f'<path d="{" ".join(jumps)}" fill="none" stroke="#d02020" stroke-width="{stroke * 0.6:.1f}" '
            f'stroke-dasharray="12,12" opacity="0.55"/>'
        )

    parts.append("</svg>")
    return "\n".join(parts)


def color_sheet(design: Design, with_machine_display: bool = False) -> list[dict]:
    """Ficha de linhas: o que o operador coloca na maquina, em ordem.

    Com `with_machine_display`, cada linha traz tambem o nome que a Brother
    vai mostrar no visor — util para o operador nao achar que trocou o cone
    errado quando o visor disser "Khaki" e o cone for "Bege medio".
    """
    display = None
    if with_machine_display:
        from ..formats.brother import machine_display_color

        display = machine_display_color

    sheet: list[dict] = []
    for order, block in enumerate(design.blocks, start=1):
        row = {
            "order": order,
            "code": block.thread.code,
            "name": block.thread.name,
            "brand": block.thread.brand,
            "hex": block.thread.hex,
            "stitches": block.stitch_count,
            "label": block.label,
        }
        if display is not None:
            shown = display(block.thread.rgb)
            if shown is not None:
                row["machine_display"] = f"{shown.code} {shown.name}"
                row["machine_hex"] = shown.hex
        sheet.append(row)
    return sheet


def design_to_png(design: Design, px_per_mm: float = 4.0, show_jumps: bool = False):
    """Rasteriza a previa (BGR, pronto para cv2.imwrite / png em memoria)."""
    import cv2
    import numpy as np

    x0, y0, x1, y1 = design.bounds()
    scale = px_per_mm / UNITS_PER_MM
    pad = int(3 * px_per_mm)
    width = int((x1 - x0) * scale) + 2 * pad
    height = int((y1 - y0) * scale) + 2 * pad
    canvas = np.full((max(height, 1), max(width, 1), 3), 244, np.uint8)

    def to_px(stitch) -> tuple[int, int]:
        return (int((stitch.x - x0) * scale) + pad, int((stitch.y - y0) * scale) + pad)

    thickness = max(1, int(round(0.32 * px_per_mm)))
    previous = None
    for block in design.blocks:
        bgr = tuple(reversed(block.thread.rgb))
        for stitch in block.stitches:
            point = to_px(stitch)
            if previous is not None:
                if stitch.kind in (StitchKind.JUMP, StitchKind.TRIM):
                    if show_jumps:
                        cv2.line(canvas, previous, point, (40, 40, 210), 1, cv2.LINE_AA)
                else:
                    cv2.line(canvas, previous, point, bgr, thickness, cv2.LINE_AA)
            previous = point
    return canvas
