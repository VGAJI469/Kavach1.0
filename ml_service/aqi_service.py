"""
aqi_service.py — Live Air Quality Index from AQICN API
Caches for 15 minutes (AQI changes slower than weather).
"""
import httpx
import time
from config import AQICN_API_KEY, CITY_MAP

BASE_URL = "https://api.waqi.info/feed"

_cache: dict = {}
CACHE_TTL = 900  # 15 minutes


def _is_cached(key: str) -> bool:
    if key not in _cache:
        return False
    ts, _ = _cache[key]
    return (time.time() - ts) < CACHE_TTL


def _get_aqi_city(city: str) -> str:
    return CITY_MAP.get(city.lower(), {}).get("aqi", city.lower())


CITY_COORDS = {
    "chennai":   {"lat": 13.0827, "lon": 80.2707},
    "mumbai":    {"lat": 19.0760, "lon": 72.8777},
    "delhi":     {"lat": 28.6139, "lon": 77.2090},
    "bengaluru": {"lat": 12.9716, "lon": 77.5946},
    "bangalore": {"lat": 12.9716, "lon": 77.5946},
    "hyderabad": {"lat": 17.3850, "lon": 78.4867},
    "pune":      {"lat": 18.5204, "lon": 73.8567},
    "kolkata":   {"lat": 22.5726, "lon": 88.3639},
}


async def _get_openmeteo_aqi(city: str) -> dict | None:
    coords = CITY_COORDS.get(city.lower())
    if not coords:
        return None
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude": coords["lat"],
        "longitude": coords["lon"],
        "current": "us_aqi,pm2_5,pm10"
    }
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()
        current = raw.get("current", {})
        aqi_val = current.get("us_aqi", 80)
        pm25 = current.get("pm2_5")
        pm10 = current.get("pm10")
        
        return {
            "aqi":                int(aqi_val),
            "dominant_pollutant": "pm25",
            "category":           _aqi_category(aqi_val),
            "pm25":               pm25,
            "pm10":               pm10,
            "station":            f"{city.capitalize()} Open-Meteo",
            "source":             "live_keyless",
        }
    except Exception as e:
        print(f"[AQIService] Open-Meteo error: {e}")
        return None


async def get_aqi(city: str) -> dict:
    """
    Fetch current AQI for a city.
    Returns:
        aqi               — overall AQI value (integer)
        dominant_pollutant — e.g. pm25, pm10, o3
        category          — Good / Moderate / Unhealthy / Very Unhealthy / Hazardous / Severe
        pm25              — PM2.5 value if available
        pm10              — PM10 value if available
        source            — "live" or "fallback"
    """
    cache_key = f"aqi_{city.lower()}"
 
    if _is_cached(cache_key):
        _, data = _cache[cache_key]
        return data
 
    if not AQICN_API_KEY:
        openmeteo = await _get_openmeteo_aqi(city)
        if openmeteo:
            _cache[cache_key] = (time.time(), openmeteo)
            return openmeteo
        return _fallback_aqi(city)
 
    aqi_city = _get_aqi_city(city)
    url = f"{BASE_URL}/{aqi_city}/"
    params = {"token": AQICN_API_KEY}
 
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()
 
        if raw.get("status") != "ok":
            print(f"[AQIService] Non-ok response for {city}: {raw.get('data')}")
            openmeteo = await _get_openmeteo_aqi(city)
            if openmeteo:
                _cache[cache_key] = (time.time(), openmeteo)
                return openmeteo
            return _fallback_aqi(city)
 
        d = raw["data"]
        aqi_val = d.get("aqi", 0)
        iaqi = d.get("iaqi", {})
 
        data = {
            "aqi":                int(aqi_val) if isinstance(aqi_val, (int, float)) else 0,
            "dominant_pollutant": d.get("dominentpol", "pm25"),
            "category":           _aqi_category(aqi_val),
            "pm25":               iaqi.get("pm25", {}).get("v"),
            "pm10":               iaqi.get("pm10", {}).get("v"),
            "station":            d.get("city", {}).get("name", city),
            "source":             "live",
        }
        _cache[cache_key] = (time.time(), data)
        return data
 
    except Exception as e:
        print(f"[AQIService] Error fetching {city}: {e}")
        openmeteo = await _get_openmeteo_aqi(city)
        if openmeteo:
            _cache[cache_key] = (time.time(), openmeteo)
            return openmeteo
        return _fallback_aqi(city)


def _aqi_category(aqi: int) -> str:
    """CPCB India AQI categories."""
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Satisfactory"
    if aqi <= 200:  return "Moderate"
    if aqi <= 300:  return "Poor"
    if aqi <= 400:  return "Very Poor"
    return "Severe"


def _fallback_aqi(city: str) -> dict:
    """Fallback when AQICN is unavailable."""
    # Delhi historically worst, Bengaluru best
    defaults = {
        "delhi":     180,
        "mumbai":    120,
        "kolkata":   150,
        "hyderabad": 100,
        "chennai":   90,
        "pune":      95,
        "bengaluru": 70,
    }
    aqi = defaults.get(city.lower(), 100)
    return {
        "aqi":                aqi,
        "dominant_pollutant": "pm25",
        "category":           _aqi_category(aqi),
        "pm25":               None,
        "pm10":               None,
        "station":            city,
        "source":             "fallback",
    }


def derive_risk_factor_from_aqi(aqi_data: dict) -> float:
    """
    Convert AQI into a 1.0–1.4 risk multiplier for premium.
    """
    aqi = aqi_data.get("aqi", 0)
    if aqi > 400:   return 1.40   # Severe
    if aqi > 300:   return 1.30   # Very Poor
    if aqi > 200:   return 1.15   # Poor
    if aqi > 100:   return 1.05   # Moderate
    return 1.0
