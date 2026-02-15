

    # === GOOGLE OAUTH METHODS ===
    
    async def get_google_auth_url(self) -> str:
        """
        Generuje URL do autoryzacji Google OAuth
        """
        auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={self.settings.google_client_id}&"
            f"redirect_uri={self.settings.google_redirect_uri}&"
            f"response_type=code&"
            f"scope=openid%20email%20profile&"
            f"access_type=offline"
        )
        logger.info("?? Wygenerowano URL autoryzacji Google")
        return auth_url
    
    async def google_login(self, code: str) -> dict:
        """
        Logowanie przez Google OAuth
        1. Wymienia code na access_token w Google
        2. Pobiera dane uytkownika z Google        3. Tworzy uytkownika lub loguje istniejcego
        """
        logger.info("?? Rozpoczto logowanie przez Google")
        
        # 1. Wymie code na token
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": self.settings.google_client_id,
            "client_secret": self.settings.google_client_secret,
            "redirect_uri": self.settings.google_redirect_uri,
            "grant_type": "authorization_code"
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)
            
            if token_response.status_code != 200:
                logger.error(f"? Bd wymiany kodu: {token_response.text}")
                raise HTTPException(status_code=400, detail="Bd autoryzacji Google")
            
            tokens = token_response.json()
            access_token = tokens.get("access_token")
            
            # 2. Pobierz dane uytkownika
            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            userinfo_response = await client.get(userinfo_url, headers=headers)
            
            if userinfo_response.status_code != 200:
                logger.error(f"? Bd pobierania danych: {userinfo_response.text}")
                raise HTTPException(status_code=400, detail="Bd pobierania danych uytkownika")
            
            user_info = userinfo_response.json()
        
        google_id = user_info.get("id")
        email = user_info.get("email")
        name = user_info.get("name", "")
        picture = user_info.get("picture")
        
        logger.info(f"?? Dane Google: {email}")
        
        # 3. Sprawd czy uytkownik istnieje (po google_id lub email)
        user = self.db.query(User).filter(
            (User.google_id == google_id) | (User.email == email)
        ).first()
        
        if user:
            # Uytkownik istnieje - zaktualizuj dane Google jeli nie ma
            if not user.google_id:
                user.google_id = google_id
                user.auth_provider = "google"
                user.profile_picture = picture
                user.is_active = True  # Google weryfikuje email
                self.db.commit()
                logger.info(f"?? Zaktualizowano uytkownika: {user.username}")
            
            logger.info(f"? Logowanie istniejcego uytkownika: {user.username}")
        else:
            # Utwórz nowego uytkownika
            username = email.split("@")[0]  # Tymczasowy username z email
            
            # Sprawd czy username jest zajty
            counter = 1
            original_username = username
            while self.db.query(User).filter(User.username == username).first():
                username = f"{original_username}{counter}"
                counter += 1
            
            user = User(
                username=username,
                email=email,
                full_name=name,
                google_id=google_id,
                auth_provider="google",
                profile_picture=picture,
                is_active=True,  # Google weryfikuje email
                hashed_password=None  # Brak hasa dla Google
            )
            
            try:
                self.db.add(user)
                self.db.flush()
                logger.info(f"? Nowy uytkownik Google: {user.username} (ID: {user.id})")
                
                # Utwórz starter workspace
                starter_workspace = Workspace(
                    name="Moja Przestrze",
                    icon="Home",
                    bg_color="bg-green-500",
                    created_by=user.id,
                    created_at=datetime.utcnow()
                )
                self.db.add(starter_workspace)
                self.db.flush()
                
                # Dodaj membership
                membership = WorkspaceMember(
                    workspace_id=starter_workspace.id,
                    user_id=user.id,
                    role="owner",
                    is_favourite=True,
                    joined_at=datetime.utcnow()
                )
                self.db.add(membership)
                
                # Ustaw jako aktywny workspace
                user.active_workspace_id = starter_workspace.id
                
                self.db.commit()
                logger.info(f"?? Workspace utworzony dla {user.username}")
            
            except Exception as e:
                self.db.rollback()
                logger.error(f"? Bd tworzenia uytkownika Google: {str(e)}")
                raise HTTPException(status_code=500, detail="Bd tworzenia konta")
        
        # Generuj JWT token
        jwt_token = create_access_token(
            data={"sub": user.username, "user_id": user.id}
        )
        
        logger.info(f"??? Token wygenerowany dla {user.username}")
        
        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "created_at": user.created_at
            }
        }
