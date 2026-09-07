"""Gera uma imagem de exemplo (nao usamos arte de terceiros no repositorio).

    python samples/make_sample.py && stitchforge samples/exemplo.png --preview samples/exemplo.svg
"""

from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).parent


def main() -> None:
    canvas = np.full((640, 640, 3), 255, np.uint8)
    cv2.circle(canvas, (320, 360), 150, (150, 190, 215), -1)      # corpo
    cv2.circle(canvas, (320, 210), 95, (150, 190, 215), -1)       # cabeca
    cv2.circle(canvas, (245, 145), 42, (150, 190, 215), -1)       # orelha
    cv2.circle(canvas, (395, 145), 42, (150, 190, 215), -1)
    cv2.circle(canvas, (245, 145), 22, (185, 205, 230), -1)
    cv2.circle(canvas, (395, 145), 22, (185, 205, 230), -1)
    cv2.ellipse(canvas, (320, 235), (55, 40), 0, 0, 360, (225, 235, 245), -1)  # focinho
    cv2.circle(canvas, (293, 200), 11, (40, 38, 36), -1)          # olhos
    cv2.circle(canvas, (347, 200), 11, (40, 38, 36), -1)
    cv2.ellipse(canvas, (320, 228), (14, 10), 0, 0, 360, (45, 42, 40), -1)     # nariz
    cv2.ellipse(canvas, (320, 470), (60, 30), 0, 0, 360, (110, 160, 195), -1)  # pes

    out = HERE / "exemplo.png"
    cv2.imwrite(str(out), canvas)
    print(f"gravado: {out}")


if __name__ == "__main__":
    main()
