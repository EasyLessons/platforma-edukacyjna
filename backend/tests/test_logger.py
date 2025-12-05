"""
SKRYPT TESTOWY - Sprawdzanie logowania
Uruchom: python test_logger.py
"""
import logging
from core.logging import setup_logging, get_logger

# Inicjalizuj logging
setup_logging(log_level="DEBUG")

# Pobierz loggery
logger_main = get_logger(__name__)
logger_auth = get_logger("auth.service")
logger_dashboard = get_logger("dashboard.boards.service")

print("\n" + "="*80)
print("🧪 TEST LOGOWANIA - Sprawdzamy czy logi działają")
print("="*80 + "\n")

# Test różnych poziomów
logger_main.debug("🔍 DEBUG: To jest log debugowy")
logger_main.info("ℹ️ INFO: To jest log informacyjny")
logger_main.warning("⚠️ WARNING: To jest ostrzeżenie")
logger_main.error("❌ ERROR: To jest błąd")

print("\n--- Test loggerów z różnych modułów ---\n")

logger_auth.info("🔐 AUTH: Symulacja logowania użytkownika")
logger_auth.warning("⚠️ AUTH: Symulacja błędnego hasła")

logger_dashboard.info("📊 DASHBOARD: Symulacja tworzenia tablicy")
logger_dashboard.error("❌ DASHBOARD: Symulacja błędu przy zapisie")

print("\n" + "="*80)
print("✅ Test zakończony! Sprawdź pliki:")
print("   - logs/app.log (wszystkie logi)")
print("   - logs/error.log (tylko błędy)")
print("="*80 + "\n")
