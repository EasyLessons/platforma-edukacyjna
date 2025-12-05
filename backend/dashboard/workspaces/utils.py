import resend

async def send_workspace_invite_email(
    invited_email: str,
    invited_name: str,
    inviter_name: str,
    workspace_name: str,
    invite_token: str,
    resend_api_key: str,
    from_email: str,
    frontend_url: str = "https://easylesson.app"
) -> bool:
    """
    Wysyła email z zaproszeniem do workspace'a
    
    PARAMETRY:
    - invited_email: Email zaproszonego
    - invited_name: Imię zaproszonego
    - inviter_name: Imię zapraszającego
    - workspace_name: Nazwa workspace'a
    - invite_token: Token zaproszenia
    - resend_api_key: Klucz API Resend
    - from_email: Email nadawcy
    - frontend_url: URL frontendu (domyślnie easylesson.app)
    """
    
    resend.api_key = resend_api_key
    
    # Link do akceptacji zaproszenia
    invite_link = f"{frontend_url}/invite/{invite_token}"
    
    try:
        params = {
            "from": from_email,
            "to": [invited_email],
            "subject": f"{inviter_name} zaprasza Cię do workspace'a {workspace_name}",
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white;">
                    
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">
                            📬 Masz zaproszenie!
                        </h1>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #1f2937; margin-top: 0;">
                            Cześć, {invited_name}!
                        </h2>
                        
                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                            <strong>{inviter_name}</strong> zaprasza Cię do dołączenia do workspace'a:
                        </p>
                        
                        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 4px;">
                            <h3 style="color: #059669; margin: 0 0 10px 0; font-size: 20px;">
                                🏢 {workspace_name}
                            </h3>
                            <p style="color: #065f46; margin: 0; font-size: 14px;">
                                Współpracuj, twórz i zarządzaj projektami razem z zespołem
                            </p>
                        </div>
                        
                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                            Kliknij poniższy przycisk, aby zaakceptować zaproszenie:
                        </p>
                        
                        <!-- CTA Button -->
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="{invite_link}" 
                               style="background-color: #10b981; 
                                      color: white; 
                                      padding: 16px 40px; 
                                      text-decoration: none; 
                                      border-radius: 8px; 
                                      font-weight: bold; 
                                      font-size: 16px;
                                      display: inline-block;
                                      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                                ✅ Akceptuj zaproszenie
                            </a>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                            Lub skopiuj i wklej poniższy link do przeglądarki:
                        </p>
                        
                        <div style="background-color: #f9fafb; 
                                    padding: 12px; 
                                    border-radius: 6px; 
                                    word-break: break-all;
                                    font-family: monospace;
                                    font-size: 12px;
                                    color: #374151;
                                    margin-bottom: 30px;">
                            {invite_link}
                        </div>
                        
                        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                                ⏱️ Zaproszenie wygasa po 7 dniach
                            </p>
                            <p style="color: #9ca3af; font-size: 13px; margin: 5px 0 0 0;">
                                ❓ Nie rozpoznajesz tego zaproszenia? Możesz je bezpiecznie zignorować.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 12px; margin: 0;">
                            © 2024 EasyLesson. Wszystkie prawa zastrzeżone.
                        </p>
                    </div>
                    
                </div>
            </body>
            </html>
            """
        }
        
        response = resend.Emails.send(params)
        print(f"✅ Email wysłany do {invited_email}! Response: {response}")
        return True
        
    except Exception as e:
        print(f"❌ Błąd wysyłania emaila do {invited_email}: {e}")
        raise