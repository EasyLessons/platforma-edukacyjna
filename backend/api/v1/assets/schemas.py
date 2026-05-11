from pydantic import BaseModel, ConfigDict
from typing import List, Any, Optional
from datetime import datetime

class AssetCreate(BaseModel):
    name: str
    elements_data: List[Any]
    thumbnail: Optional[str] = None

class AssetResponse(AssetCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
