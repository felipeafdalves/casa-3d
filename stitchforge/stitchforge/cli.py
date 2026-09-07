"""Uso em lote pela linha de comando."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2

from .formats.writer import available_formats, write
from .pipeline.builder import BuildOptions, build_design
from .pipeline.preprocess import PreprocessOptions, prepare
from .pipeline.preview import color_sheet, design_to_png, design_to_svg
from .pipeline.quantize import QuantizeOptions, quantize
from .pipeline.stitches import StitchOptions


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="stitchforge", description="Imagem -> arquivo de bordado")
    parser.add_argument("image", type=Path)
    parser.add_argument("-o", "--out", type=Path, default=None, help="arquivo de saida")
    parser.add_argument("-f", "--format", default="dst", choices=available_formats())
    parser.add_argument("-w", "--width-mm", type=float, default=100.0)
    parser.add_argument("-c", "--colors", type=int, default=6)
    parser.add_argument("--spacing-mm", type=float, default=0.40)
    parser.add_argument("--min-area-mm2", type=float, default=4.0)
    parser.add_argument("--keep-background", action="store_true")
    parser.add_argument("--no-outline", action="store_true")
    parser.add_argument("--preview", type=Path, help="grava previa .png ou .svg")
    args = parser.parse_args(argv)

    image = cv2.imread(str(args.image), cv2.IMREAD_UNCHANGED)
    if image is None:
        parser.error(f"nao consegui ler {args.image}")

    prepared = prepare(
        image,
        PreprocessOptions(
            target_width_mm=args.width_mm, remove_background=not args.keep_background
        ),
    )
    layers = quantize(
        prepared, QuantizeOptions(colors=args.colors, min_area_mm2=args.min_area_mm2)
    )
    design = build_design(
        prepared,
        layers,
        BuildOptions(
            stitch=StitchOptions(row_spacing_mm=args.spacing_mm, outline=not args.no_outline),
            min_area_mm2=args.min_area_mm2,
        ),
        name=args.image.stem,
    )

    out = args.out or args.image.with_suffix(f".{args.format}")
    write(design, out, args.format)

    if args.preview:
        if args.preview.suffix.lower() == ".svg":
            args.preview.write_text(design_to_svg(design), encoding="utf-8")
        else:
            cv2.imwrite(str(args.preview), design_to_png(design))

    stats = design.stats()
    print(f"{out}  {stats['stitches']} pontos  {stats['width_mm']}x{stats['height_mm']} mm")
    for row in color_sheet(design):
        print(f"  {row['order']:2d}. {row['code']:8} {row['name']:20} {row['stitches']:6d} pontos")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
