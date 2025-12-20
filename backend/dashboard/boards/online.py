"""
═══════════════════════════════════════════════════════════════════════════
                    BOARD ONLINE STATUS SERVICE
            Zarządzanie statusem online użytkowników na tablicy
═══════════════════════════════════════════════════════════════════════════
"""
from sqlalchemy.orm import Session
from datetime import datetime
from core.models import BoardUsers

def set_user_online(db: Session, board_id: int, user_id: int) -> bool:
    """
    Oznacz użytkownika jako online na tablicy
    
    Returns:
        True jeśli sukces, False jeśli użytkownik nie ma dostępu do tablicy
    """
    board_user = db.query(BoardUsers).filter(
        BoardUsers.board_id == board_id,
        BoardUsers.user_id == user_id
    ).first()
    
    if not board_user:
        # Użytkownik nie ma dostępu do tablicy
        return False
    
    board_user.is_online = True
    board_user.last_opened = datetime.utcnow()
    db.commit()
    
    return True

def set_user_offline(db: Session, board_id: int, user_id: int) -> bool:
    """
    Oznacz użytkownika jako offline na tablicy
    
    Returns:
        True jeśli sukces, False jeśli użytkownik nie ma dostępu do tablicy
    """
    board_user = db.query(BoardUsers).filter(
        BoardUsers.board_id == board_id,
        BoardUsers.user_id == user_id
    ).first()
    
    if not board_user:
        return False
    
    board_user.is_online = False
    db.commit()
    
    return True

def set_all_users_offline(db: Session, board_id: int) -> int:
    """
    Oznacz wszystkich użytkowników jako offline (cleanup)
    
    Returns:
        Liczba zaktualizowanych użytkowników
    """
    count = db.query(BoardUsers).filter(
        BoardUsers.board_id == board_id,
        BoardUsers.is_online == True
    ).update({"is_online": False})
    
    db.commit()
    
    return count
