from sqlalchemy.orm import Session
from core.models import SavedAsset
from .schemas import AssetCreate

def create_asset(db: Session, user_id: int, schema: AssetCreate) -> SavedAsset:
    db_asset = SavedAsset(
        user_id=user_id,
        name=schema.name,
        elements_data=schema.elements_data,
        thumbnail=schema.thumbnail
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset

def get_user_assets(db: Session, user_id: int) -> list[SavedAsset]:
    return db.query(SavedAsset).filter(SavedAsset.user_id == user_id).order_by(SavedAsset.created_at.desc()).all()

def delete_asset(db: Session, user_id: int, asset_id: int) -> bool:
    asset = db.query(SavedAsset).filter(SavedAsset.id == asset_id, SavedAsset.user_id == user_id).first()
    if asset:
        db.delete(asset)
        db.commit()
        return True
    return False
