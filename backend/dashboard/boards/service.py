"""
BOARDS SERVICE - Logika zarządzania tablicami w dashboardzie
"""
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from fastapi import HTTPException
from core.logging import get_logger
from core.config import get_settings
import asyncio

from core.models import User, Board, BoardUsers, Workspace
from dashboard.boards.schemas import (
    CreateBoard, UpdateBoard, ToggleFavourite, 
    OnlineUserInfo, BoardResponse, BoardListResponse, 
    BoardOwnerInfo, LastModifiedByInfo, LastOpenedInfo,
    ToggleFavouriteResponse
)

logger = get_logger(__name__)

class BoardService:
    """Serwis zarządzający tablicami"""
    
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
    
    def _check_board_access(self, board: Board, user_id: int) -> bool:
        """Sprawdza czy użytkownik ma dostęp do tablicy"""
        if board.created_by == user_id:
            return True
        
        board_user = self.db.query(BoardUsers).filter(
            BoardUsers.board_id == board.id,
            BoardUsers.user_id == user_id
        ).first()
        
        return board_user is not None
    
    async def create_board(self, board_data: CreateBoard, user_id: int) -> BoardResponse:
        """Tworzenie nowej tablicy"""
        # Sprawdź czy workspace istnieje
        workspace = self.db.query(Workspace).filter(
            Workspace.id == board_data.workspace_id
        ).first()
        
        if not workspace:
            logger.warning(f"⚠️ Workspace nie znaleziony: {board_data.workspace_id}")
            raise HTTPException(status_code=404, detail="Workspace nie znaleziony")
        
        new_board = Board(
            name=board_data.name,
            icon=board_data.icon,
            bg_color=board_data.bg_color,
            workspace_id=board_data.workspace_id,
            created_by=user_id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow(),
            last_modified_by=user_id
        )
        
        self.db.add(new_board)
        self.db.commit()
        self.db.refresh(new_board)
        
        # Dodaj relację użytkownik-tablica
        board_user = BoardUsers(
            board_id=new_board.id,
            user_id=user_id,
            is_favourite=False,
            is_online=True,
            last_opened=datetime.utcnow()
        )
        
        self.db.add(board_user)
        self.db.commit()
        
        logger.info(f"✅ Nowa tablica utworzona: {new_board.id} przez użytkownika {user_id}")
        
        # Pobierz dane właściciela
        owner = self.db.query(User).filter(User.id == user_id).first()
        
        return BoardResponse(
            id=new_board.id,
            name=new_board.name,
            icon=new_board.icon,
            bg_color=new_board.bg_color,
            workspace_id=new_board.workspace_id,
            owner_id=user_id,
            owner_username=owner.username,
            is_favourite=False,
            last_modified=new_board.last_modified,
            last_modified_by=owner.username,
            last_opened=datetime.utcnow(),
            created_at=new_board.created_at,
            created_by=owner.username
        )
    
    async def update_board(self, board_id: int, data_to_update: UpdateBoard, user_id: int) -> BoardResponse:
        """Aktualizacja tablicy"""
        board = self.db.query(Board).filter(Board.id == board_id).first()
        
        if not board:
            logger.warning(f"⚠️ Tablica nie znaleziona: {board_id}")
            raise HTTPException(status_code=404, detail="Tablica nie znaleziona")
        
        # Sprawdź uprawnienia
        if not self._check_board_access(board, user_id):
            logger.warning(f"⚠️ Brak uprawnień: user {user_id}, board {board_id}")
            raise HTTPException(status_code=403, detail="Brak uprawnień do edycji tablicy")
        
        # Aktualizuj tylko te pola, które zostały przekazane
        if data_to_update.name is not None:
            board.name = data_to_update.name
        if data_to_update.icon is not None:
            board.icon = data_to_update.icon
        if data_to_update.bg_color is not None:
            board.bg_color = data_to_update.bg_color
        
        board.last_modified = datetime.utcnow()
        board.last_modified_by = user_id
        
        self.db.commit()
        self.db.refresh(board)
        
        logger.info(f"✅ Tablica zaktualizowana: {board_id} przez użytkownika {user_id}")
        
        # Pobierz dodatkowe informacje
        owner = self.db.query(User).filter(User.id == board.created_by).first()
        modifier = self.db.query(User).filter(User.id == user_id).first()
        board_user = self.db.query(BoardUsers).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.user_id == user_id
        ).first()
        
        return BoardResponse(
            id=board.id,
            name=board.name,
            icon=board.icon,
            bg_color=board.bg_color,
            workspace_id=board.workspace_id,
            owner_id=board.created_by,
            owner_username=owner.username,
            is_favourite=board_user.is_favourite if board_user else False,
            last_modified=board.last_modified,
            last_modified_by=modifier.username,
            last_opened=board_user.last_opened if board_user else None,
            created_at=board.created_at,
            created_by=owner.username
        )
    
    async def delete_board(self, board_id: int, user_id: int) -> dict:
        """Usuwanie tablicy"""
        board = self.db.query(Board).filter(Board.id == board_id).first()
        
        if not board:
            logger.warning(f"⚠️ Tablica nie znaleziona: {board_id}")
            raise HTTPException(status_code=404, detail="Tablica nie znaleziona")
        
        # Tylko właściciel może usunąć tablicę
        if board.created_by != user_id:
            logger.warning(f"⚠️ Brak uprawnień do usunięcia: user {user_id}, board {board_id}")
            raise HTTPException(status_code=403, detail="Tylko właściciel może usunąć tablicę")
        
        self.db.delete(board)
        self.db.commit()
        
        logger.info(f"✅ Tablica usunięta: {board_id} przez użytkownika {user_id}")
        
        return {
            "success": True,
            "message": "Tablica została pomyślnie usunięta."
        }
    
    async def toggle_favourite(self, board_id: int, toggle_data: ToggleFavourite, user_id: int) -> ToggleFavouriteResponse:
        """Toggleowanie ulubionej tablicy"""
        board_user = self.db.query(BoardUsers).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.user_id == user_id
        ).first()
        
        if not board_user:
            # Jeśli relacja nie istnieje, utwórz ją
            board = self.db.query(Board).filter(Board.id == board_id).first()
            if not board:
                logger.warning(f"⚠️ Tablica nie znaleziona: {board_id}")
                raise HTTPException(status_code=404, detail="Tablica nie znaleziona")
            
            board_user = BoardUsers(
                board_id=board_id,
                user_id=user_id,
                is_favourite=toggle_data.is_favourite,
                is_online=False,
                last_opened=None
            )
            self.db.add(board_user)
        else:
            board_user.is_favourite = toggle_data.is_favourite
        
        self.db.commit()
        self.db.refresh(board_user)
        
        logger.info(f"✅ Ulubiona tablica zaktualizowana: board {board_id} przez użytkownika {user_id} na {toggle_data.is_favourite}")
        
        return ToggleFavouriteResponse(
            is_favourite=board_user.is_favourite,
            message="Ulubiona tablica została pomyślnie zaktualizowana."
        )
    
    async def get_online_users(self, board_id: int, limit: int = 50, offset: int = 0) -> list[OnlineUserInfo]:
        """Pobierz użytkowników online na tablicy"""
        online_users = self.db.query(BoardUsers).join(User).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.is_online == True
        ).offset(offset).limit(limit).all()
        
        return [
            OnlineUserInfo(
                user_id=bu.user.id,
                username=bu.user.username
            ) 
            for bu in online_users
        ]
    
    async def get_board_owner_info(self, board_id: int) -> BoardOwnerInfo:
        """Pobierz informacje o właścicielu tablicy"""
        board = self.db.query(Board).filter(Board.id == board_id).first()
        
        if not board:
            logger.warning(f"⚠️ Tablica nie znaleziona: {board_id}")
            raise HTTPException(status_code=404, detail="Tablica nie znaleziona")
        
        owner = self.db.query(User).filter(User.id == board.created_by).first()
        
        if not owner:
            logger.warning(f"⚠️ Właściciel tablicy nie znaleziony: user {board.created_by}")
            raise HTTPException(status_code=404, detail="Właściciel tablicy nie znaleziony")
        
        return BoardOwnerInfo(
            user_id=owner.id,
            username=owner.username
        )
    
    async def get_last_modifier_info(self, board_id: int) -> LastModifiedByInfo:
        """Pobierz informacje o ostatnim modyfikatorze tablicy"""
        board = self.db.query(Board).filter(Board.id == board_id).first()
        
        if not board:
            logger.warning(f"⚠️ Tablica nie znaleziona: {board_id}")
            raise HTTPException(status_code=404, detail="Tablica nie znaleziona")
        
        if not board.last_modified_by:
            # Jeśli brak last_modified_by, użyj właściciela
            last_modifier = self.db.query(User).filter(User.id == board.created_by).first()
        else:
            last_modifier = self.db.query(User).filter(User.id == board.last_modified_by).first()
        
        if not last_modifier:
            logger.warning(f"⚠️ Ostatni modyfikator nie znaleziony: user {board.last_modified_by}")
            raise HTTPException(status_code=404, detail="Ostatni modyfikator nie znaleziony")
        
        return LastModifiedByInfo(
            user_id=last_modifier.id,
            username=last_modifier.username
        )
    
    async def get_last_opened_info(self, board_id: int, user_id: int) -> LastOpenedInfo:
        """Pobierz informacje o ostatnim otwarciu tablicy"""
        board_user = self.db.query(BoardUsers).join(User).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.user_id == user_id
        ).first()
        
        if not board_user:
            logger.warning(f"⚠️ Relacja użytkownik-tablica nie znaleziona: user {user_id}, board {board_id}")
            raise HTTPException(status_code=404, detail="Relacja użytkownik-tablica nie znaleziona")
        
        if not board_user.last_opened:
            logger.warning(f"⚠️ Brak informacji o ostatnim otwarciu dla user {user_id} na board {board_id}")
            raise HTTPException(status_code=404, detail="Brak informacji o ostatnim otwarciu")
        
        username = self.db.query(User).filter(User.id == user_id).first().username
        
        return LastOpenedInfo(
            user_id=user_id,
            username=username,
            last_opened=board_user.last_opened
        )
    
    async def list_boards(self, workspace_id: int, user_id: int, limit: int = 10, offset: int = 0) -> BoardListResponse:
        """Pobierz listę tablic w przestrzeni roboczej"""
        query = self.db.query(Board).options(
            joinedload(Board.users)
        ).filter(Board.workspace_id == workspace_id)
        
        total = query.count()
        boards = query.offset(offset).limit(limit).all()
        
        board_responses = []
        for board in boards:
            try:
                # Pobierz informacje asynchronicznie
                results = await asyncio.gather(
                    self.get_board_owner_info(board.id),
                    self.get_last_modifier_info(board.id),
                    self.get_last_opened_info(board.id, user_id),
                    return_exceptions=True
                )
                
                owner_info = results[0] if not isinstance(results[0], Exception) else None
                last_modifier_info = results[1] if not isinstance(results[1], Exception) else None
                last_opened_info = results[2] if not isinstance(results[2], Exception) else None
                
                # Sprawdź czy wszystkie wymagane dane są dostępne
                if not owner_info or not last_modifier_info:
                    logger.error(f"❌ Brak wymaganych danych dla tablicy {board.id}")
                    continue
                
                board_response = BoardResponse(
                    id=board.id,
                    name=board.name,
                    icon=board.icon,
                    bg_color=board.bg_color,
                    workspace_id=board.workspace_id,
                    owner_id=owner_info.user_id,
                    owner_username=owner_info.username,
                    is_favourite=any(bu.is_favourite for bu in board.users if bu.user_id == user_id),
                    last_modified=board.last_modified,
                    last_modified_by=last_modifier_info.username,
                    last_opened=last_opened_info.last_opened if last_opened_info else None,
                    created_at=board.created_at,
                    created_by=owner_info.username
                )
                board_responses.append(board_response)
                
            except Exception as e:
                logger.error(f"❌ Błąd przy przetwarzaniu tablicy {board.id}: {e}")
                continue
        
        return BoardListResponse(
            boards=board_responses,
            total=total,
            limit=limit,
            offset=offset
        )