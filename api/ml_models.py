"""
ml_models.py — Scikit-learn ML models trained on synthetic Indian gig-worker data.

Premium prediction:  GradientBoostingRegressor
Fraud detection:     RandomForestClassifier

Models train once on startup (~2-3s), then predict in real-time.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import warnings
import time

warnings.filterwarnings("ignore", category=UserWarning)

# ── City & platform encodings ────────────────────────────────────────────────
CITIES = ["chennai", "mumbai", "kolkata", "delhi", "hyderabad", "pune", "bengaluru"]
PLATFORMS = ["swiggy", "zomato", "uber", "ola", "dunzo", "zepto", "blinkit", "porter"]

CITY_BASE_RISK = {
    "chennai": 0.90, "mumbai": 0.85, "kolkata": 0.75,
    "hyderabad": 0.60, "pune": 0.55, "delhi": 0.50, "bengaluru": 0.45,
}

MONTH_RISK = {
    1: 0.70, 2: 0.65, 3: 0.75, 4: 0.88,
    5: 0.92, 6: 1.10, 7: 1.20, 8: 1.20,
    9: 1.10, 10: 0.85, 11: 0.75, 12: 0.70,
}

_city_enc = LabelEncoder().fit(CITIES)
_plat_enc = LabelEncoder().fit(PLATFORMS)

# Trained model instances (populated on startup)
_premium_model: GradientBoostingRegressor = None
_fraud_model: RandomForestClassifier = None


# ── Synthetic data generators ────────────────────────────────────────────────

def _generate_premium_data(n: int = 5000) -> pd.DataFrame:
    """Generate realistic synthetic gig-worker premium records."""
    rng = np.random.default_rng(42)

    cities = rng.choice(CITIES, n)
    months = rng.integers(1, 13, n)
    tenure = rng.integers(0, 200, n)
    earnings = rng.uniform(1500, 12000, n)
    claims = rng.choice([0, 0, 0, 0, 1, 1, 2, 3], n)
    platforms = rng.choice(PLATFORMS, n)

    # Weather features (simulated distributions by city/month)
    rainfall = np.zeros(n)
    temperature = np.zeros(n)
    aqi = np.zeros(n)

    for i in range(n):
        m = months[i]
        c = cities[i]
        is_monsoon = m in (6, 7, 8, 9)
        is_hot = m in (4, 5)

        # Rainfall: monsoon cities get more
        base_rain = 15.0 if is_monsoon else 2.0
        if c in ("chennai", "mumbai", "kolkata") and is_monsoon:
            base_rain = 40.0
        rainfall[i] = max(0, rng.normal(base_rain, base_rain * 0.6))

        # Temperature
        base_temp = 38.0 if is_hot else 28.0
        if c == "delhi" and is_hot:
            base_temp = 43.0
        temperature[i] = rng.normal(base_temp, 3.0)

        # AQI
        aqi_base = {"delhi": 180, "kolkata": 150, "mumbai": 120, "chennai": 90,
                     "hyderabad": 100, "pune": 95, "bengaluru": 70}.get(c, 100)
        aqi[i] = max(20, rng.normal(aqi_base, 30))

    # Generate ground-truth premium using the domain formula (what we're training towards)
    city_risk = np.array([CITY_BASE_RISK.get(c, 0.65) for c in cities])
    month_risk = np.array([MONTH_RISK.get(m, 0.80) for m in months])

    # Weather risk factor
    weather_risk = np.ones(n)
    weather_risk += np.where(rainfall >= 64.5, 0.35,
                    np.where(rainfall >= 35.5, 0.20,
                    np.where(rainfall >= 7.5, 0.10, 0.0)))
    weather_risk += np.where(temperature >= 45, 0.40,
                    np.where(temperature >= 42, 0.25,
                    np.where(temperature >= 40, 0.15, 0.0)))

    # AQI risk
    aqi_risk = np.where(aqi > 400, 1.40,
               np.where(aqi > 300, 1.30,
               np.where(aqi > 200, 1.15,
               np.where(aqi > 100, 1.05, 1.0))))

    live_risk = weather_risk * 0.7 + aqi_risk * 0.3

    # Tier base premium
    base = np.where(earnings <= 3000, 49,
           np.where(earnings <= 5000, 79, 129)).astype(float)

    tenure_disc = np.minimum(0.15, tenure * 0.002)
    claims_load = claims * 0.08

    premium = (
        base * (0.5 + city_risk) * month_risk * live_risk
        * (1 + claims_load) * (1 - tenure_disc)
    )

    # Add noise for realism
    premium *= rng.uniform(0.92, 1.08, n)

    # Clamp
    premium = np.clip(premium, 39, 199)

    df = pd.DataFrame({
        "city": _city_enc.transform(cities),
        "month": months,
        "tenure_weeks": tenure,
        "weekly_earnings": earnings,
        "claims_90d": claims,
        "platform": _plat_enc.transform(platforms),
        "rainfall_1h": rainfall,
        "temperature_c": temperature,
        "aqi": aqi,
        "premium": premium,
    })
    return df


def _generate_fraud_data(n: int = 5000) -> pd.DataFrame:
    """Generate synthetic fraud detection training data."""
    rng = np.random.default_rng(123)

    tenure = rng.integers(0, 200, n)
    claims = rng.choice([0, 0, 0, 1, 1, 2, 3, 4], n)
    earnings = rng.uniform(1500, 12000, n)
    gps_match = rng.choice([1, 1, 1, 1, 1, 0], n)          # 1=match, 0=mismatch
    has_duplicate = rng.choice([0, 0, 0, 0, 0, 1], n)       # rare duplicates
    velocity = rng.choice([5, 10, 15, 20, 30, 60, 100], n)
    trigger_value = rng.uniform(30, 150, n)
    trigger_threshold = 64.5  # rainfall threshold

    # Weather match: does the trigger match real conditions?
    actual_rain = rng.uniform(0, 120, n)
    trigger_weather_match = (
        (trigger_value >= trigger_threshold) &
        (actual_rain >= trigger_threshold * 0.8)
    ).astype(int)

    # Earnings anomaly: current vs historical
    hist_earnings = earnings * rng.uniform(0.7, 1.3, n)
    earnings_ratio = earnings / np.maximum(hist_earnings, 1)

    # Generate fraud labels based on patterns
    fraud_score = np.zeros(n)
    fraud_score += np.where(gps_match == 0, 25, 0)
    fraud_score += np.where(has_duplicate == 1, 15, 0)
    fraud_score += np.where(trigger_weather_match == 0, 30, 0)
    fraud_score += np.where(velocity > 50, 10, 0)
    fraud_score += np.where(tenure < 4, 10, 0)
    fraud_score += np.where(earnings_ratio > 2.5, 15, 0)

    # Add noise
    fraud_score += rng.normal(0, 8, n)
    fraud_score = np.clip(fraud_score, 0, 100)

    # Binary label: fraud if score >= 40
    is_fraud = (fraud_score >= 40).astype(int)

    df = pd.DataFrame({
        "tenure_weeks": tenure,
        "claims_90d": claims,
        "weekly_earnings": earnings,
        "gps_match": gps_match,
        "has_duplicate": has_duplicate,
        "city_velocity": velocity,
        "trigger_value": trigger_value,
        "trigger_weather_match": trigger_weather_match,
        "earnings_ratio": earnings_ratio,
        "is_fraud": is_fraud,
    })
    return df


# ── Model training ───────────────────────────────────────────────────────────

def train_models():
    """Train both models on synthetic data. Called once at startup."""
    global _premium_model, _fraud_model

    print("[ML] Training models on synthetic data...")
    t0 = time.time()

    # ── Premium model ────────────────────────────────────────────────────
    pdf = _generate_premium_data(5000)
    X_prem = pdf.drop(columns=["premium"])
    y_prem = pdf["premium"]

    _premium_model = GradientBoostingRegressor(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
    )
    _premium_model.fit(X_prem, y_prem)

    # ── Fraud model ──────────────────────────────────────────────────────
    fdf = _generate_fraud_data(5000)
    X_fraud = fdf.drop(columns=["is_fraud"])
    y_fraud = fdf["is_fraud"]

    _fraud_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        random_state=42,
        class_weight="balanced",
    )
    _fraud_model.fit(X_fraud, y_fraud)

    elapsed = time.time() - t0
    print(f"[ML] Models trained in {elapsed:.2f}s")
    print(f"     Premium model R² (train): {_premium_model.score(X_prem, y_prem):.3f}")
    print(f"     Fraud model accuracy (train): {_fraud_model.score(X_fraud, y_fraud):.3f}")


# ── Prediction functions ─────────────────────────────────────────────────────

def predict_premium_ml(
    city: str,
    month: int,
    tenure_weeks: int,
    weekly_earnings: float,
    claims_90d: int,
    platform: str,
    rainfall_1h: float = 0.0,
    temperature_c: float = 28.0,
    aqi: float = 80.0,
) -> float:
    """Predict premium using the trained GradientBoosting model."""
    if _premium_model is None:
        raise RuntimeError("Models not trained yet — call train_models() first")

    city_encoded = _city_enc.transform([city.lower()])[0] if city.lower() in CITIES else 3
    plat_encoded = _plat_enc.transform([platform.lower()])[0] if platform.lower() in PLATFORMS else 0

    features = np.array([[
        city_encoded, month, tenure_weeks, weekly_earnings,
        claims_90d, plat_encoded, rainfall_1h, temperature_c, aqi
    ]])

    prediction = _premium_model.predict(features)[0]
    return round(float(np.clip(prediction, 39, 199)))


def predict_fraud_ml(
    tenure_weeks: int,
    claims_90d: int,
    weekly_earnings: float,
    gps_match: bool,
    has_duplicate: bool,
    city_velocity: int,
    trigger_value: float,
    trigger_weather_match: bool,
    historical_avg_earnings: float = None,
) -> dict:
    """Predict fraud probability using the trained RandomForest model."""
    if _fraud_model is None:
        raise RuntimeError("Models not trained yet — call train_models() first")

    if historical_avg_earnings and historical_avg_earnings > 0:
        earnings_ratio = weekly_earnings / historical_avg_earnings
    else:
        earnings_ratio = 1.0

    features = np.array([[
        tenure_weeks, claims_90d, weekly_earnings,
        int(gps_match), int(has_duplicate), city_velocity,
        trigger_value, int(trigger_weather_match), earnings_ratio
    ]])

    fraud_prob = _fraud_model.predict_proba(features)[0][1]  # P(fraud)
    fraud_score = round(float(fraud_prob * 100))

    if fraud_score < 30:
        decision = "AUTO_APPROVE"
    elif fraud_score <= 70:
        decision = "REVIEW"
    else:
        decision = "AUTO_REJECT"

    return {
        "ml_fraud_score": fraud_score,
        "ml_fraud_probability": round(float(fraud_prob), 4),
        "ml_decision": decision,
    }
