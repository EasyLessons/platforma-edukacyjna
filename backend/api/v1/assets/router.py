from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from core.models import User
from api.v1.auth.dependencies import get_current_user
from . import schemas, service
from core.responses import ApiResponse

router = APIRouter(tags=["Saved Assets"])

@router.post("/", response_model=ApiResponse)
def create_asset_endpoint(
    asset_data: schemas.AssetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    asset = service.create_asset(db, current_user.id, asset_data)
    response_data = schemas.AssetResponse.model_validate(asset).model_dump()
    return ApiResponse(success=True, data=response_data)

@router.get("/", response_model=ApiResponse)
def get_assets_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assets = service.get_user_assets(db, current_user.id)
    response_data = [schemas.AssetResponse.model_validate(a).model_dump() for a in assets]
    return ApiResponse(success=True, data=response_data)

@router.delete("/{asset_id}", response_model=ApiResponse)
def delete_asset_endpoint(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    success = service.delete_asset(db, current_user.id, asset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Asset not found or not owned by user")
    return ApiResponse(success=True, data={"deleted": True})
