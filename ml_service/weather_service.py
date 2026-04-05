"""
weather_service.py — Live weather data from OpenWeather API
Caches responses for 10 minutes to avoid rate limits.
"""
import httpx
import time
from typing import Optional
from config import OPENWEATHER_API_KEY, CITY_MAP

BASE_URL = "https://api.openweathermap.org/data/2.5"

# Simple in-memory cache: { city_key: (timestamp, data) }
_cache: dict = {}
CACHE_TTL = 600  # 10 minutes


def _is_cached(key: str) -> bool:
    if key not in _cache:
        return False
    ts, _ = _cache[key]
    return (time.time() - ts) < CACHE_TTL


def _get_ow_city(city: str) -> str:
    return CITY_MAP.get(city.lower(), {}).get("ow", f"{city},IN")


async def get_current_weather(city: str) -> dict:
    """
    Fetch current weather for a city.
    Returns:
        temp_c       — current temperature in °C
        feels_like_c — feels like temperature
        rainfall_1h  — rainfall in last 1 hour (mm), 0 if none
        rainfall_3h  — rainfall in last 3 hours (mm), 0 if none
        humidity     — humidity %
        condition    — main weather condition (Rain, Clear, Clouds…)
        description  — detailed description
        wind_speed   — m/s
        source       — "live" or "fallback"
    """
    cache_key = f"weather_{city.lower()}"

    if _is_cached(cache_key):
        _, data = _cache[cache_key]
        return data

    if not OPENWEATHER_API_KEY:
        return _fallback_weather(city)

    ow_city = _get_ow_city(city)
    url = f"{BASE_URL}/weather"
    params = {
        "q":     ow_city,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()

        data = {
            "temp_c":       raw["main"]["temp"],
            "feels_like_c": raw["main"]["feels_like"],
            "humidity":     raw["main"]["humidity"],
            "rainfall_1h":  raw.get("rain", {}).get("1h", 0.0),
            "rainfall_3h":  raw.get("rain", {}).get("3h", 0.0),
            "condition":    raw["weather"][0]["main"],
            "description":  raw["weather"][0]["description"],
            "wind_speed":   raw["wind"]["speed"],
            "city_name":    raw["name"],
            "source":       "live",
        }
        _cache[cache_key] = (time.time(), data)
        return data

    except Exception as e:
        print(f"[WeatherService] Error fetching {city}: {e}")
        return _fallback_weather(city)


async def get_forecast(city: str) -> list:
    """
    Fetch 5-day / 3-hour forecast.
    Returns list of { dt, temp_c, rainfall_3h, condition }
    """
    cache_key = f"forecast_{city.lower()}"

    if _is_cached(cache_key):
        _, data = _cache[cache_key]
        return data

    if not OPENWEATHER_API_KEY:
        return []

    ow_city = _get_ow_city(city)
    url = f"{BASE_URL}/forecast"
    params = {
        "q":     ow_city,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
        "cnt":   40,  # 5 days × 8 per day
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()

        data = [
            {
                "dt":          item["dt"],
                "dt_txt":      item["dt_txt"],
                "temp_c":      item["main"]["temp"],
                "rainfall_3h": item.get("rain", {}).get("3h", 0.0),
                "condition":   item["weather"][0]["main"],
                "description": item["weather"][0]["description"],
            }
            for item in raw.get("list", [])
        ]
        _cache[cache_key] = (time.time(), data)
        return data

    except Exception as e:
        print(f"[WeatherService] Forecast error {city}: {e}")
        return []


def _fallback_weather(city: str) -> dict:
    """Rule-based fallback when API is unavailable."""
    import datetime
    month = datetime.datetime.now().month
    # Monsoon cities in season
    high_rain = city.lower() in ("chennai", "mumbai", "kolkata") and month in (6, 7, 8, 9)
    return {
        "temp_c":       38.0 if month in (4, 5) else 28.0,
        "feels_like_c": 40.0 if month in (4, 5) else 30.0,
        "humidity":     80 if high_rain else 55,
        "rainfall_1h":  10.0 if high_rain else 0.0,
        "rainfall_3h":  25.0 if high_rain else 0.0,
        "condition":    "Rain" if high_rain else "Clear",
        "description":  "moderate rain" if high_rain else "clear sky",
        "wind_speed":   4.0,
        "city_name":    city,
        "source":       "fallback",
    }


def derive_risk_factor_from_weather(weather: dict) -> float:
    """
    Convert live weather into a 0.5–1.5 risk multiplier for premium.
    """
    factor = 1.0

    # Rainfall loading
    rain = weather.get("rainfall_1h", 0)
    if rain >= 115.5:   factor += 0.50  # Extremely heavy
    elif rain >= 64.5:  factor += 0.35  # Heavy (IMD threshold)
    elif rain >= 35.5:  factor += 0.20  # Moderate
    elif rain >= 7.5:   factor += 0.10  # Light

    # Heat loading
    temp = weather.get("temp_c", 28)
    if temp >= 45:      factor += 0.40
    elif temp >= 42:    factor += 0.25  # IMD heat wave
    elif temp >= 40:    factor += 0.15

    return round(min(1.5, factor), 3)
