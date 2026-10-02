import json
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# === LIMITY (SEC-15) ===
# Zapisany zasób to JSONB + Text w Postgresie - bez limitów jedno konto mogło zapchać bazę.
# Limity są celowo luźne względem tego, co realnie wysyła frontend:
# - elements_data: grupa zaznaczonych elementów tablicy (obrazy to URL-e do Storage, nie base64),
# - thumbnail: miniatura SVG generowana na froncie (generateElementsSvgThumbnail) - zawiera
#   wszystkie punkty ścieżek, więc bywa rzędu setek kB; limit 200 znaków z audytu by ją odciął.
MAX_ASSET_NAME_LENGTH = 100          # = kolumna saved_assets.name String(100)
MAX_ASSET_ELEMENTS = 500             # liczba elementów w jednym zasobie
MAX_ASSET_ELEMENTS_BYTES = 1_000_000  # rozmiar elements_data po serializacji do JSON (UTF-8)
MAX_ASSET_THUMBNAIL_CHARS = 1_000_000
MAX_ASSETS_PER_USER = 100


class AssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=MAX_ASSET_NAME_LENGTH)
    elements_data: List[Any] = Field(..., max_length=MAX_ASSET_ELEMENTS)
    thumbnail: Optional[str] = Field(default=None, max_length=MAX_ASSET_THUMBNAIL_CHARS)

    @field_validator("elements_data")
    @classmethod
    def elements_data_size(cls, value: List[Any]) -> List[Any]:
        size = len(json.dumps(value, ensure_ascii=False).encode("utf-8"))
        if size > MAX_ASSET_ELEMENTS_BYTES:
            raise ValueError(
                f"Zasób jest za duży ({size} B, limit {MAX_ASSET_ELEMENTS_BYTES} B)"
            )
        return value


class AssetResponse(BaseModel):
    """Odpowiedź API. Osobny model (bez limitów wejściowych), żeby zasoby zapisane
    przed wprowadzeniem limitów nadal dało się odczytać."""
    id: int
    name: str
    elements_data: List[Any]
    thumbnail: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
