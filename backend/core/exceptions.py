"""
Custom exception hierarchy dla aplikacji
"""

class AppException(Exception):
    """Base application exception"""
    def __init__(self, message: str, code: str = "APP_ERROR", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(self.message)

class ValidationError(AppException):
    """Validation error"""
    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_ERROR", status_code=400)

class AuthenticationError(AppException):
    """Authentication error"""
    def __init__(self, message: str):
        super().__init__(message, code="AUTH_ERROR", status_code=401)

class NotFoundError(AppException):
    """Resource not found"""
    def __init__(self, message: str):
        super().__init__(message, code="NOT_FOUND", status_code=404)

class ConflictError(AppException):
    """Resource conflict"""
    def __init__(self, message: str):
        super().__init__(message, code="CONFLICT", status_code=409)
