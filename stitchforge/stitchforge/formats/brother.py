"""Especificidades das maquinas Brother (formato PES).

Duas coisas mudam quando o destino e uma Brother:

1. A maquina tem uma **paleta fixa de 64 cores**. Se o arquivo trouxer uma cor
   fora dela, quem escolhe a substituicao e a maquina — e o operador so
   descobre a troca no visor. Gerar direto na paleta Brother elimina a
   surpresa: o que aparece na previa e o que aparece no visor.
2. O bastidor tem limite rigido. Desenho maior que o bastidor nao "sai
   cortado": a maquina simplesmente recusa o arquivo.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models import Thread

# PES v1 e o mais universal — todas as Brother com leitura de PES abrem.
# v6 carrega nome de linha e miniatura, mas maquinas antigas recusam.
PES_VERSIONS = (1, 6)
DEFAULT_PES_VERSION = 1


@dataclass(frozen=True)
class Hoop:
    name: str
    width_mm: float
    height_mm: float

    def fits(self, width_mm: float, height_mm: float, margin_mm: float = 2.0) -> bool:
        """Cabe considerando margem de seguranca (o pe calcador precisa de folga)."""
        usable_w = self.width_mm - margin_mm * 2
        usable_h = self.height_mm - margin_mm * 2
        return (width_mm <= usable_w and height_mm <= usable_h) or (
            height_mm <= usable_w and width_mm <= usable_h  # pode girar 90 graus
        )


# Bastidores Brother mais comuns, ordenados por AREA — nao pela diagonal nem
# pela ordem do catalogo. O 8x8 (400 cm2) e menor que o 6x10 (416 cm2), e sem
# essa ordenacao `smallest_hoop` devolveria um bastidor maior que o preciso.
HOOPS: tuple[Hoop, ...] = tuple(
    sorted(
        (
            Hoop("4x4 (10x10 cm)", 100, 100),
            Hoop("5x7 (13x18 cm)", 130, 180),
            Hoop("6x10 (16x26 cm)", 160, 260),
            Hoop("8x8 (20x20 cm)", 200, 200),
            Hoop("9.5x14 (24x36 cm)", 240, 360),
        ),
        key=lambda hoop: hoop.width_mm * hoop.height_mm,
    )
)


def smallest_hoop(width_mm: float, height_mm: float) -> Hoop | None:
    """Menor bastidor Brother em que o desenho cabe, ou None se nao couber."""
    for hoop in HOOPS:
        if hoop.fits(width_mm, height_mm):
            return hoop
    return None


def hoop_by_name(name: str) -> Hoop | None:
    return next((h for h in HOOPS if h.name == name or h.name.startswith(name)), None)


def brother_catalog() -> tuple[Thread, ...]:
    """As 64 cores da paleta Brother, lidas do pyembroidery.

    Lidas em tempo de execucao de proposito: transcrever 64 RGBs a mao e
    convite a erro, e o valor correto ja vem da mesma biblioteca que grava o
    arquivo — nao ha como a previa divergir do que sera escrito.
    """
    from pyembroidery import EmbThreadPec

    return tuple(
        Thread(
            code=str(thread.catalog_number),
            name=thread.description,
            rgb=(thread.get_red(), thread.get_green(), thread.get_blue()),
            brand="brother",
        )
        for thread in EmbThreadPec.get_thread_set()
        if thread is not None
    )


def machine_display_color(rgb: tuple[int, int, int]) -> Thread | None:
    """Cor que a Brother vai MOSTRAR NO VISOR para uma linha qualquer.

    O PES guarda indices da carta fixa de 64 cores da Brother. Se a linha
    escolhida nao esta na carta, a maquina exibe a mais proxima. Isso muda
    apenas o visor — a linha fisica no cone continua sendo a que o operador
    colocou. Por isso a quantizacao usa o catalogo real (mais fiel) e o visor
    e apenas informado, em vez de virar uma camisa de forca sobre a arte.
    """
    try:
        catalog = brother_catalog()
    except ImportError:
        return None
    from ..pipeline.threads import delta_e

    return min(catalog, key=lambda thread: delta_e(rgb, thread.rgb))


def available() -> bool:
    try:
        import pyembroidery  # noqa: F401
    except ImportError:
        return False
    return True
