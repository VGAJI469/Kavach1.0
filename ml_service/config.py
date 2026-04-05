"""
config.py — Load all secrets from .env
Never hardcode keys here.
"""
import os
from dotenv import load_dotenv

load_dotenv()

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
AQICN_API_KEY       = os.getenv("AQICN_API_KEY")
SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY   = os.getenv("SUPABASE_ANON_KEY")

# Validate on startup
def validate_config():
    missing = []
    if not OPENWEATHER_API_KEY: missing.append("OPENWEATHER_API_KEY")
    if not AQICN_API_KEY:       missing.append("AQICN_API_KEY")
    if not SUPABASE_URL:        missing.append("SUPABASE_URL")
    if missing:
        print(f"⚠️  Missing env vars: {', '.join(missing)} — some features will degrade gracefully.")

# City name mappings (OpenWeather & AQICN use different names)
CITY_MAP = {
    "chennai":   {"ow": "Chennai,IN",   "aqi": "chennai"},
    "mumbai":    {"ow": "Mumbai,IN",    "aqi": "mumbai"},
    "delhi":     {"ow": "Delhi,IN",     "aqi": "delhi"},
    "bengaluru": {"ow": "Bangalore,IN", "aqi": "bangalore"},
    "hyderabad": {"ow": "Hyderabad,IN", "aqi": "hyderabad"},
    "pune":      {"ow": "Pune,IN",      "aqi": "pune"},
    "kolkata":   {"ow": "Kolkata,IN",   "aqi": "kolkata"},
}

# IMD parametric trigger thresholds
TRIGGER_THRESHOLDS = {
    "RAINFALL":  64.5,   # mm/hr — IMD Heavy Rain
    "HEAT":      42.0,   # °C    — IMD Heat Wave
    "POLLUTION": 300,    # AQI   — CPCB Severe category
    "FLOOD":     115.5,  # mm/hr — IMD Very Heavy Rain
    "CURFEW":    1.0,    # flag
}
