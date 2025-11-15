"""
Testy wyszukiwania użytkowników
"""
import pytest
from auth.service import AuthService


class TestUserSearch:
    """Testy wyszukiwania użytkowników"""
    
    def test_search_users_by_username(self, db_session, test_user, test_user2):
        """Test wyszukiwania po username"""
        
        service = AuthService(db_session)
        results = service.search_users("testuser", test_user.id, limit=10)
        
        # Powinien znaleźć test_user2, ale nie test_user (bo to my)
        assert len(results) >= 1
        usernames = [r.username for r in results]
        assert "testuser2" in usernames
        assert "testuser" not in usernames  # Wykluczamy siebie
    
    def test_search_users_by_email(self, db_session, test_user, test_user2):
        """Test wyszukiwania po email"""
        
        service = AuthService(db_session)
        results = service.search_users("test2@example.com", test_user.id, limit=10)
        
        assert len(results) == 1
        assert results[0].email == "test2@example.com"
    
    def test_search_users_case_insensitive(self, db_session, test_user, test_user2):
        """Test czy wyszukiwanie jest case-insensitive"""
        
        service = AuthService(db_session)
        results = service.search_users("TESTUSER", test_user.id, limit=10)
        
        assert len(results) >= 1
    
    def test_search_users_excludes_self(self, db_session, test_user):
        """Test czy wyszukiwanie wyklucza zalogowanego użytkownika"""
        
        service = AuthService(db_session)
        results = service.search_users("testuser", test_user.id, limit=10)
        
        # Nie powinien znaleźć siebie
        user_ids = [r.id for r in results]
        assert test_user.id not in user_ids
    
    def test_search_users_min_length(self, db_session, test_user):
        """Test minimalnej długości zapytania"""
        
        service = AuthService(db_session)
        results = service.search_users("a", test_user.id, limit=10)
        
        # Zapytanie < 2 znaki powinno zwrócić pustą listę
        assert len(results) == 0
    
    def test_search_users_limit(self, db_session, test_user):
        """Test limitu wyników"""
        
        # Dodaj wielu użytkowników
        for i in range(15):
            from core.models import User
            from auth.utils import hash_password
            user = User(
                username=f"searchuser{i}",
                email=f"search{i}@example.com",
                hashed_password=hash_password("password"),
                is_active=True
            )
            db_session.add(user)
        db_session.commit()
        
        service = AuthService(db_session)
        results = service.search_users("search", test_user.id, limit=5)
        
        # Powinien zwrócić maksymalnie 5
        assert len(results) <= 5