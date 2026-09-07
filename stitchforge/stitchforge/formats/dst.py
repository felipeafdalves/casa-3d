"""Leitor/escritor Tajima DST em Python puro (sem dependencias).

O DST e o formato mais universal em maquinas industriais (Tajima, Barudan,
SWF, Ricoma...). Cada ponto ocupa 3 bytes que codificam o deslocamento
relativo em base ternaria (+/-1, 3, 9, 27, 81) — alcance de +/-121
decimilimetros (12.1 mm) por ponto. Movimentos maiores precisam ser
quebrados em varios registros; `encode_stitch` cuida disso.

Referencia da tabela de bits: especificacao publica do formato Tajima DST.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models import Design, StitchKind

HEADER_SIZE = 512
MAX_DELTA = 121

# (byte_index, bit_mask, valor_em_x, valor_em_y)
_BIT_TABLE: tuple[tuple[int, int, int, int], ...] = (
    (0, 0x01, 0, +1),
    (0, 0x02, 0, -1),
    (0, 0x04, 0, +9),
    (0, 0x08, 0, -9),
    (0, 0x10, -9, 0),
    (0, 0x20, +9, 0),
    (0, 0x40, -1, 0),
    (0, 0x80, +1, 0),
    (1, 0x01, 0, +3),
    (1, 0x02, 0, -3),
    (1, 0x04, 0, +27),
    (1, 0x08, 0, -27),
    (1, 0x10, -27, 0),
    (1, 0x20, +27, 0),
    (1, 0x40, -3, 0),
    (1, 0x80, +3, 0),
    (2, 0x04, 0, +81),
    (2, 0x08, 0, -81),
    (2, 0x10, -81, 0),
    (2, 0x20, +81, 0),
)

_CTRL_NORMAL = 0x03
_CTRL_JUMP = 0x83
_CTRL_COLOR_CHANGE = 0xC3
_END_RECORD = b"\x00\x00\xf3"


def _split(delta: int) -> list[int]:
    """Quebra um deslocamento em pedacos de no maximo MAX_DELTA."""
    parts: list[int] = []
    remaining = delta
    while abs(remaining) > MAX_DELTA:
        step = MAX_DELTA if remaining > 0 else -MAX_DELTA
        parts.append(step)
        remaining -= step
    parts.append(remaining)
    return parts


def _balanced_ternary(value: int) -> list[int]:
    """Digitos {-1,0,1} para os pesos 1, 3, 9, 27, 81.

    O alcance do DST (+/-121) e exatamente (3**5-1)/2, ou seja, todo valor
    valido tem uma representacao unica em ternario balanceado de 5 digitos.
    Isso torna a codificacao exata por construcao — sem heuristica gulosa.
    """
    digits: list[int] = []
    remaining = value
    for _ in range(5):
        digit = remaining % 3
        if digit == 2:
            digit = -1
        digits.append(digit)
        remaining = (remaining - digit) // 3
    if remaining != 0:
        raise ValueError(f"valor fora do alcance do DST: {value}")
    return digits


def encode_record(dx: int, dy: int, ctrl: int) -> bytes:
    """Codifica um unico registro de 3 bytes. dx/dy devem caber em +/-121."""
    if abs(dx) > MAX_DELTA or abs(dy) > MAX_DELTA:
        raise ValueError(f"deslocamento fora do alcance do DST: ({dx}, {dy})")

    data = [0, 0, ctrl]
    lookup = {(vx, vy): (index, mask) for index, mask, vx, vy in _BIT_TABLE}
    for axis, value in (("x", dx), ("y", dy)):
        for weight, digit in zip((1, 3, 9, 27, 81), _balanced_ternary(value)):
            if digit == 0:
                continue
            key = (digit * weight, 0) if axis == "x" else (0, digit * weight)
            index, mask = lookup[key]
            data[index] |= mask
    return bytes(data)


def decode_record(record: bytes) -> tuple[int, int, int]:
    """Decodifica 3 bytes em (dx, dy, ctrl). Usado nos testes e na leitura."""
    dx = dy = 0
    for byte_index, mask, vx, vy in _BIT_TABLE:
        if record[byte_index] & mask:
            dx += vx
            dy += vy
    # O byte 2 mistura controle (0xC3) com os bits de dados de +/-81,
    # entao devolvemos apenas o campo de controle.
    return dx, dy, record[2] & 0xC3


def encode_stitch(dx: int, dy: int, kind: StitchKind) -> bytes:
    """Codifica um ponto, quebrando em varios pulos se for longo demais."""
    xs = _split(dx)
    ys = _split(dy)
    steps = max(len(xs), len(ys))
    xs += [0] * (steps - len(xs))
    ys += [0] * (steps - len(ys))

    if kind is StitchKind.COLOR_CHANGE:
        return encode_record(0, 0, _CTRL_COLOR_CHANGE)

    ctrl = _CTRL_JUMP if kind in (StitchKind.JUMP, StitchKind.TRIM) else _CTRL_NORMAL
    out = bytearray()
    for index, (sx, sy) in enumerate(zip(xs, ys)):
        last = index == steps - 1
        # Todos os passos intermediarios viram pulo; so o ultimo crava o ponto.
        out += encode_record(sx, sy, ctrl if last else _CTRL_JUMP)
    return bytes(out)


def build_header(design: Design, label: str = "") -> bytes:
    x0, y0, x1, y1 = design.bounds()
    last_x, last_y = 0, 0
    for stitch, _ in design.iter_stitches():
        last_x, last_y = stitch.x, stitch.y

    fields = [
        f"LA:{(label or design.name)[:16]:<16}\r",
        f"ST:{design.stitch_count:7d}\r",
        f"CO:{max(design.color_count - 1, 0):3d}\r",
        f"+X:{max(x1, 0):5d}\r",
        f"-X:{abs(min(x0, 0)):5d}\r",
        f"+Y:{max(y1, 0):5d}\r",
        f"-Y:{abs(min(y0, 0)):5d}\r",
        f"AX:{last_x:+6d}\r",
        f"AY:{last_y:+6d}\r",
        "MX:+    0\r",
        "MY:+    0\r",
        "PD:******\r",
    ]
    header = "".join(fields).encode("ascii", "replace") + b"\x1a"
    if len(header) > HEADER_SIZE:  # pragma: no cover
        raise ValueError("cabecalho DST maior que 512 bytes")
    return header.ljust(HEADER_SIZE, b" ")


def write_dst(design: Design, path=None, label: str = "") -> bytes:
    """Serializa o desenho em DST. Se `path` vier, tambem grava em disco."""
    body = bytearray()
    cur_x = cur_y = 0
    first_block = True

    for block in design.blocks:
        if not first_block:
            body += encode_stitch(0, 0, StitchKind.COLOR_CHANGE)
        first_block = False
        for stitch in block.stitches:
            dx = stitch.x - cur_x
            # O eixo Y do DST cresce para cima; o nosso cresce para baixo.
            dy = -(stitch.y - cur_y)
            body += encode_stitch(dx, dy, stitch.kind)
            cur_x, cur_y = stitch.x, stitch.y

    body += _END_RECORD
    data = build_header(design, label) + bytes(body)
    if path is not None:
        with open(path, "wb") as handle:
            handle.write(data)
    return data


@dataclass
class DecodedStitch:
    x: int
    y: int
    ctrl: int


def read_dst(data: bytes) -> list[DecodedStitch]:
    """Decodifica um DST em pontos absolutos (usado nos testes)."""
    out: list[DecodedStitch] = []
    x = y = 0
    body = data[HEADER_SIZE:]
    for offset in range(0, len(body) - 2, 3):
        record = body[offset : offset + 3]
        if record == _END_RECORD:
            break
        dx, dy, ctrl = decode_record(record)
        x += dx
        y += dy
        out.append(DecodedStitch(x, y, ctrl))
    return out
