"""
model.py — Kavach ML Logic
Premium prediction uses LIVE weather + AQI data + trained ML models.
Fraud scoring cross-checks trigger against real conditions + ML classifier.
"""
import datetime
from typing import Optional

from weather_service import derive_risk_factor_from_weather
from aqi_service import derive_risk_factor_from_aqi
from config import TRIGGER_THRESHOLDS

# ML model imports — graceful fallback if not available
try:
    from ml_models import predict_premium_ml, predict_fraud_ml
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("[Model] ml_models not available — using rule-based fallback only")

# ── Tier config ──────────────────────────────────────────────────────────────
TIERS = {
    "basic":    {"coverage": 1500, "base_premium": 49},
    "standard": {"coverage": 3000, "base_premium": 79},
    "pro":      {"coverage": 5000, "base_premium": 129},
}

# ── Seasonal risk by month (India monsoon/heat cycle) ────────────────────────
MONTH_RISK = {
    1: 0.70, 2: 0.65, 3: 0.75, 4: 0.88,
    5: 0.92, 6: 1.10, 7: 1.20, 8: 1.20,
    9: 1.10, 10: 0.85, 11: 0.75, 12: 0.70,
}

# ── City baseline risk (historical disruption frequency) ────────────────────
CITY_BASELINE = {
    "chennai":   0.90, "mumbai": 0.85, "kolkata":  0.75,
    "hyderabad": 0.60, "pune":   0.55, "delhi":    0.50,
    "bengaluru": 0.45,
}


def _get_tier(weekly_earnings: float) -> str:
    if weekly_earnings <= 3000:
        return "basic"
    elif weekly_earnings <= 5000:
        return "standard"
    return "pro"


# ── PREMIUM PREDICTION ───────────────────────────────────────────────────────

async def predict_premium(
    city: str,
    month: int,
    tenure_weeks: int,
    weekly_earnings: float,
    claims_90d: int,
    platform: int,
    weather: Optional[dict] = None,
    aqi: Optional[dict] = None,
) -> dict:
    """
    Predict weekly premium using trained ML model + live weather/AQI data.
    Falls back to rule-based calculation if ML model is unavailable.
    """
    tier = _get_tier(weekly_earnings)

    # Extract live data features
    rainfall = weather.get("rainfall_1h", 0) if weather else 0
    temp_c = weather.get("temp_c", 28) if weather else 28
    aqi_val = aqi.get("aqi", 80) if aqi else 80

    # Platform name mapping (int → string for ML model)
    platform_name = "zomato" if platform == 0 else "swiggy"

    # ── Try ML prediction first ──────────────────────────────────────────
    ml_premium = None
    model_version = "rule-based"

    if ML_AVAILABLE:
        try:
            ml_premium = predict_premium_ml(
                city=city,
                month=month,
                tenure_weeks=tenure_weeks,
                weekly_earnings=weekly_earnings,
                claims_90d=claims_90d,
                platform=platform_name,
                rainfall_1h=rainfall,
                temperature_c=temp_c,
                aqi=aqi_val,
            )
            model_version = "ml"
        except Exception as e:
            print(f"[Model] ML prediction failed, using fallback: {e}")

    # ── Rule-based calculation (fallback or comparison) ───────────────────
    base = TIERS[tier]["base_premium"]
    city_baseline = CITY_BASELINE.get(city.lower(), 0.65)
    seasonal_factor = MONTH_RISK.get(month, 0.80)
    tenure_discount = min(0.15, tenure_weeks * 0.002)
    claims_loading = claims_90d * 0.08
    platform_adj = 1.00 if platform == 0 else 0.97

    weather_risk = derive_risk_factor_from_weather(weather) if weather else 1.0
    aqi_risk = derive_risk_factor_from_aqi(aqi) if aqi else 1.0
    live_risk = (weather_risk * 0.7) + (aqi_risk * 0.3)

    rule_premium = (
        base * (0.5 + city_baseline) * seasonal_factor * live_risk
        * (1 + claims_loading) * platform_adj * (1 - tenure_discount)
    )

    clamp = {"basic": (39, 89), "standard": (59, 129), "pro": (99, 199)}
    lo, hi = clamp[tier]
    rule_premium = round(max(lo, min(hi, rule_premium)))

    # Use ML premium if available, else rule-based
    premium = ml_premium if ml_premium is not None else rule_premium

    # ── Build breakdown for UI ───────────────────────────────────────────
    breakdown = {
        "base_premium":        base,
        "city_adjustment":     round((city_baseline - 0.65) * base, 2),
        "seasonal_adjustment": round((seasonal_factor - 1.0) * base, 2),
        "live_weather_factor": round((weather_risk - 1.0) * base, 2),
        "live_aqi_factor":     round((aqi_risk - 1.0) * base, 2),
        "tenure_discount":     round(-tenure_discount * base, 2),
        "claims_loading":      round(claims_loading * base, 2),
        # Context labels for UI
        "weather_condition":   weather.get("description", "N/A") if weather else "N/A",
        "rainfall_mm":         rainfall,
        "temperature_c":       temp_c,
        "aqi_value":           aqi_val,
        "aqi_category":        aqi.get("category", "N/A") if aqi else "N/A",
        "data_source":         weather.get("source", "fallback") if weather else "fallback",
        "model_version":       model_version,
        "rule_based_premium":  rule_premium,
    }

    return {
        "premium":          premium,
        "breakdown":        breakdown,
        "recommended_tier": tier,
        "coverage_cap":     TIERS[tier]["coverage"],
    }


# ── FRAUD SCORING ────────────────────────────────────────────────────────────

async def score_fraud(
    trigger_type: str,
    trigger_value: float,
    tenure_weeks: int,
    claims_90d: int,
    weekly_earnings: float,
    weather: Optional[dict] = None,
    aqi: Optional[dict] = None,
    gps_match: bool = True,
    has_duplicate: bool = False,
    city_velocity: int = 0,
    historical_avg_earnings: Optional[float] = None,
) -> dict:
    """
    Score a claim for fraud using ML model + rule-based signals.
    Validates trigger against REAL weather/AQI data from APIs.
    """
    score = 0
    reasons = []
    signals = {}

    # ── 1. GPS check ─────────────────────────────────────────────────────
    if not gps_match:
        score += 25
        reasons.append("GPS location outside reported delivery zone")
    signals["gps"] = {"pass": gps_match, "score": 0 if gps_match else 25}

    # ── 2. Duplicate claim ───────────────────────────────────────────────
    if has_duplicate:
        score += 15
        reasons.append("Duplicate claim detected within 48 hours")
    signals["duplicate"] = {"pass": not has_duplicate, "score": 0 if not has_duplicate else 15}

    # ── 3. Validate trigger against REAL API data ────────────────────────
    trigger_valid, trigger_note = _validate_trigger_with_real_data(
        trigger_type, trigger_value, weather, aqi
    )
    if not trigger_valid:
        score += 30
        reasons.append(trigger_note)
    signals["trigger_validation"] = {
        "pass": trigger_valid,
        "score": 0 if trigger_valid else 30,
        "note": trigger_note,
    }

    # ── 4. City-wide velocity spike ──────────────────────────────────────
    is_spike = city_velocity > 50
    if is_spike:
        score += 10
        reasons.append(f"High claim velocity in city ({city_velocity} claims/hr)")
    signals["velocity"] = {
        "pass": not is_spike,
        "score": 0 if not is_spike else 10,
        "note": f"{city_velocity}/hr" if is_spike else None,
    }

    # ── 5. Account age ───────────────────────────────────────────────────
    new_account = tenure_weeks < 4
    if new_account:
        score += 10
        reasons.append("Account age under 30 days")
    signals["accountAge"] = {
        "pass": not new_account,
        "score": 0 if not new_account else 10,
        "note": "< 30 days" if new_account else None,
    }

    # ── 6. Earnings anomaly ──────────────────────────────────────────────
    earnings_ok = True
    if historical_avg_earnings and weekly_earnings > historical_avg_earnings * 2.5:
        earnings_ok = False
        score += 15
        reasons.append("Claimed earnings significantly above historical average")
    signals["activity"] = {
        "pass": earnings_ok,
        "score": 0 if earnings_ok else 15,
        "note": "earnings spike" if not earnings_ok else None,
    }

    # ── Rule-based decision ──────────────────────────────────────────────
    score = min(100, max(0, score))
    if score < 30:
        decision = "AUTO_APPROVE"
    elif score <= 70:
        decision = "REVIEW"
    else:
        decision = "AUTO_REJECT"

    # ── ML model prediction (enrichment) ─────────────────────────────────
    ml_result = None
    if ML_AVAILABLE:
        try:
            ml_result = predict_fraud_ml(
                tenure_weeks=tenure_weeks,
                claims_90d=claims_90d,
                weekly_earnings=weekly_earnings,
                gps_match=gps_match,
                has_duplicate=has_duplicate,
                city_velocity=city_velocity,
                trigger_value=trigger_value,
                trigger_weather_match=trigger_valid,
                historical_avg_earnings=historical_avg_earnings,
            )
            signals["ml_model"] = {
                "ml_fraud_score": ml_result["ml_fraud_score"],
                "ml_probability": ml_result["ml_fraud_probability"],
                "ml_decision": ml_result["ml_decision"],
            }

            # Blend: average of rule-based and ML scores
            blended_score = round((score + ml_result["ml_fraud_score"]) / 2)
            if blended_score < 30:
                decision = "AUTO_APPROVE"
            elif blended_score <= 70:
                decision = "REVIEW"
            else:
                decision = "AUTO_REJECT"
            score = blended_score

        except Exception as e:
            print(f"[Model] ML fraud prediction failed: {e}")

    return {
        "fraud_score": score,
        "decision":    decision,
        "reasons":     reasons,
        "signals":     signals,
    }


def _validate_trigger_with_real_data(
    trigger_type: str,
    trigger_value: float,
    weather: Optional[dict],
    aqi: Optional[dict],
) -> tuple[bool, str]:
    """
    Cross-check the claimed trigger against live API data.
    Returns (is_valid, reason_string).
    """
    t = trigger_type.upper()
    threshold = TRIGGER_THRESHOLDS.get(t, 1.0)

    if trigger_value < threshold:
        return False, f"{t} value {trigger_value} below payout threshold ({threshold})"

    if t == "RAINFALL" and weather:
        actual_rain = weather.get("rainfall_1h", 0)
        if actual_rain < threshold * 0.8 and weather.get("source") == "live":
            return False, (
                f"Weather API shows only {actual_rain:.1f}mm rainfall "
                f"(threshold: {threshold}mm) — claim unverifiable"
            )

    elif t == "HEAT" and weather:
        actual_temp = weather.get("temp_c", 0)
        if actual_temp < threshold - 3 and weather.get("source") == "live":
            return False, (
                f"Weather API shows {actual_temp:.1f}°C "
                f"(heat wave threshold: {threshold}°C)"
            )

    elif t == "POLLUTION" and aqi:
        actual_aqi = aqi.get("aqi", 0)
        if actual_aqi < threshold * 0.8 and aqi.get("source") == "live":
            return False, (
                f"AQI API shows {actual_aqi} "
                f"(severe threshold: {threshold}) — claim unverifiable"
            )

    return True, "Trigger validated against live data"


# ── KAVACH SCORE ─────────────────────────────────────────────────────────────

async def calculate_kavach_score(
    city: str,
    platform: str,
    earnings_bracket: str,
    weather: Optional[dict] = None,
    aqi: Optional[dict] = None,
    month: Optional[int] = None,
) -> int:
    if month is None:
        month = datetime.datetime.now().month

    city_base  = CITY_BASELINE.get(city.lower(), 0.65)
    seasonal   = MONTH_RISK.get(month, 0.80)
    earn_add   = {"basic": 10, "standard": 5, "pro": 0}.get(earnings_bracket, 5)
    plat_add   = 5 if platform.lower() == "zomato" else 2

    base_score = city_base * 60 + (seasonal - 0.65) * 30 + earn_add + plat_add

    # Boost score if live data shows active conditions
    if weather and weather.get("source") == "live":
        if weather.get("rainfall_1h", 0) >= 35:
            base_score += 10
        if weather.get("temp_c", 0) >= 40:
            base_score += 8

    if aqi and aqi.get("source") == "live":
        if aqi.get("aqi", 0) > 200:
            base_score += 7

    return max(10, min(95, round(base_score)))
