# GANTI seluruh isi master.py menjadi aggregator import (jangan mendefinisikan ulang model)
from .jabatan import Jabatan
from .gaji import Gaji
from .kontrak import Kontrak
from .bonus import Bonus
from .mobil import Mobil

__all__ = [
    "Jabatan",
    "Gaji",
    "Kontrak",
    "Bonus",
    "Mobil",
]