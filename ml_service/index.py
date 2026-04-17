"""
main.py — Kavach ML Microservice
Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Literal
import datetime
import httpx

from config import validate_config
from weather_service import get_current_weather, get_forecast
from aqi_service import get_aqi
from supabase_service import get_worker_claims_history, get_worker_profile, get_city_claim_velocity
from model import predict_premium, score_fraud, calculate_kavach_score

validate_config()

# Train ML models on startup
try:
    from ml_models import train_models
    train_models()
except Exception as e:
    print(f"[ML] Model training failed — using rule-based fallback: {e}")

app = FastAPI(
    title="Kavach ML Service",
    description="Live weather + AQI powered premium prediction and fraud scoring",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://kavach1-0.vercel.app",
        "http://localhost:5173",
        "http://localhost:4173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":    "ok",
        "service":   "kavach-ml",
        "version":   "2.0.0",
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }


# ── Premium Prediction ───────────────────────────────────────────────────────

class PremiumRequest(BaseModel):
    city:             str   = Field(..., example="chennai")
    month:            int   = Field(..., ge=1, le=12)
    tenure_weeks:     int   = Field(default=1, ge=0)
    weekly_earnings:  float = Field(..., gt=0, example=4500)
    claims_90d:       int   = Field(default=0, ge=0)
    platform:         int   = Field(default=0, description="0=Zomato, 1=Swiggy/other")


@app.post("/predict-premium")
async def predict_premium_endpoint(req: PremiumRequest):
    """
    Predict weekly premium using live OpenWeather + AQICN data for the city.
    """
    # Fetch live data in parallel concepts (sequential here for simplicity)
    weather = await get_current_weather(req.city)
    aqi     = await get_aqi(req.city)

    result = await predict_premium(
        city=req.city,
        month=req.month,
        tenure_weeks=req.tenure_weeks,
        weekly_earnings=req.weekly_earnings,
        claims_90d=req.claims_90d,
        platform=req.platform,
        weather=weather,
        aqi=aqi,
    )
    return result


# ── Fraud Score ───────────────────────────────────────────────────────────────

class FraudRequest(BaseModel):
    trigger_type:             str   = Field(..., example="RAINFALL")
    trigger_value:            float = Field(..., example=78.5)
    city:                     str   = Field(..., example="chennai")
    tenure_weeks:             int   = Field(..., ge=0)
    claims_90d:               int   = Field(default=0, ge=0)
    weekly_earnings:          float = Field(..., gt=0)
    worker_id:                Optional[str]   = None
    historical_avg_earnings:  Optional[float] = None
    gps_match:                bool  = Field(default=True)
    has_duplicate:            bool  = Field(default=False)


@app.post("/fraud-score")
async def fraud_score_endpoint(req: FraudRequest):
    """
    Score a claim for fraud, validating the trigger against live weather/AQI.
    """
    # Fetch live data
    weather  = await get_current_weather(req.city)
    aqi      = await get_aqi(req.city)
    velocity = await get_city_claim_velocity(req.city, minutes=60)

    # If worker_id provided, enrich with Supabase history
    hist_avg = req.historical_avg_earnings
    if req.worker_id and hist_avg is None:
        claims = await get_worker_claims_history(req.worker_id)
        if claims:
            paid = [c["payout_amount"] for c in claims if c.get("status") == "approved"]
            if paid:
                hist_avg = sum(paid) / len(paid)

    result = await score_fraud(
        trigger_type=req.trigger_type,
        trigger_value=req.trigger_value,
        tenure_weeks=req.tenure_weeks,
        claims_90d=req.claims_90d,
        weekly_earnings=req.weekly_earnings,
        weather=weather,
        aqi=aqi,
        gps_match=req.gps_match,
        has_duplicate=req.has_duplicate,
        city_velocity=velocity,
        historical_avg_earnings=hist_avg,
    )
    return result


# ── Kavach Score (Onboarding) ─────────────────────────────────────────────────

class KavachScoreRequest(BaseModel):
    city:             str = Field(..., example="chennai")
    platform:         str = Field(..., example="zomato")
    earnings_bracket: Literal["basic", "standard", "pro"] = "standard"
    month:            Optional[int] = None


@app.post("/kavach-score")
async def kavach_score_endpoint(req: KavachScoreRequest):
    """
    Calculate worker's Kavach Risk Score using live conditions.
    """
    weather = await get_current_weather(req.city)
    aqi     = await get_aqi(req.city)

    score = await calculate_kavach_score(
        city=req.city,
        platform=req.platform,
        earnings_bracket=req.earnings_bracket,
        weather=weather,
        aqi=aqi,
        month=req.month,
    )
    return {
        "kavach_score":    score,
        "weather_summary": weather.get("description"),
        "aqi_value":       aqi.get("aqi"),
        "aqi_category":    aqi.get("category"),
    }


# ── Live Conditions (for frontend display) ────────────────────────────────────

@app.get("/conditions/{city}")
async def get_conditions(city: str):
    """
    Get current weather + AQI for a city. Used by dashboard weather widget.
    """
    weather = await get_current_weather(city)
    aqi     = await get_aqi(city)

    # Check if any parametric triggers are currently active
    from config import TRIGGER_THRESHOLDS
    active_triggers = []
    if weather.get("rainfall_1h", 0) >= TRIGGER_THRESHOLDS["RAINFALL"]:
        active_triggers.append({"type": "RAINFALL", "value": weather["rainfall_1h"]})
    if weather.get("temp_c", 0) >= TRIGGER_THRESHOLDS["HEAT"]:
        active_triggers.append({"type": "HEAT", "value": weather["temp_c"]})
    if aqi.get("aqi", 0) >= TRIGGER_THRESHOLDS["POLLUTION"]:
        active_triggers.append({"type": "POLLUTION", "value": aqi["aqi"]})

    return {
        "city":            city,
        "weather":         weather,
        "aqi":             aqi,
        "active_triggers": active_triggers,
        "alert_level":     "red" if active_triggers else "green",
    }


# ── Phase 3: Enhanced Fraud Scoring ──────────────────────────────────────────

class FraudInputV2(BaseModel):
    gps_match:            int
    active_deliveries:    int
    duplicate_claim:      int
    claims_30d:           int
    account_age_days:     int
    workers_inactive_pct: float
    trigger_type:         str
    trigger_value:        float
    # New Phase 3 fields
    coordinate_precision: float = 6.0
    movement_speed_kmh:   float = 0.0
    stationary_minutes:   float = 0.0
    event_verified:       int   = 1
    zone_affected:        int   = 1
    platform_orders_2hr:  int   = 0
    device_on_wifi:       int   = 0
    battery_charging:     int   = 0


@app.post("/fraud-score-v2")
def fraud_score_v2(data: FraudInputV2):
    score   = 0
    reasons = []

    # Existing signals
    if not data.gps_match:
        score += 40; reasons.append("GPS_ZONE_MISMATCH")
    if data.active_deliveries > 4:
        score += 25; reasons.append("ACTIVE_DURING_TRIGGER")
    if data.duplicate_claim:
        score += 50; reasons.append("DUPLICATE_CLAIM")
    if data.claims_30d > 3:
        score += 20; reasons.append("HIGH_CLAIM_VELOCITY")
    if data.account_age_days < 7:
        score += 15; reasons.append("NEW_ACCOUNT")
    if data.workers_inactive_pct < 0.20:
        score += 25; reasons.append("LOW_CITY_INACTIVITY")

    # NEW: GPS Spoof Detection
    if data.coordinate_precision < 4:
        score += 15; reasons.append("GPS_SPOOF_LOW_PRECISION")
    if data.movement_speed_kmh > 200:
        score += 35; reasons.append("GPS_SPOOF_IMPOSSIBLE_SPEED")
    if data.stationary_minutes > 60:
        score += 20; reasons.append("GPS_SPOOF_STATIONARY_TOO_LONG")

    # NEW: Historical Weather Cross-Check
    if not data.event_verified:
        score += 40; reasons.append("NO_VERIFIED_DISRUPTION_EVENT")
    if not data.zone_affected:
        score += 30; reasons.append("ZONE_NOT_IN_AFFECTED_AREA")

    # NEW: Platform Activity Cross-Check
    if data.platform_orders_2hr > 4:
        score += 25; reasons.append("PLATFORM_ACTIVE_PRE_TRIGGER")

    # NEW: Device State (home vs field)
    if data.device_on_wifi and data.battery_charging:
        score += 20; reasons.append("DEVICE_HOME_STATE_DURING_CLAIM")

    score = min(score, 100)

    decision = (
        "AUTO_APPROVE" if score < 30 else
        "FLAG_REVIEW"  if score < 70 else
        "AUTO_REJECT"
    )

    return {
        "fraud_score":  score,
        "decision":     decision,
        "reasons":      reasons,
        "breakdown": {
            "base_signals":       min(score, 100),
            "gps_spoof_signals":  sum([
                15 if data.coordinate_precision < 4 else 0,
                35 if data.movement_speed_kmh > 200 else 0,
                20 if data.stationary_minutes > 60 else 0,
            ]),
            "weather_signals":    sum([
                40 if not data.event_verified else 0,
                30 if not data.zone_affected else 0,
            ]),
            "platform_signals":   25 if data.platform_orders_2hr > 4 else 0,
            "device_signals":     20 if (data.device_on_wifi and data.battery_charging) else 0,
        }
    }


# ── Phase 3: Next Week Disruption Prediction ─────────────────────────────────

# City-specific config for prediction
CITY_CONFIG = {
    'chennai':   {'triggers': {'rainfall': 64.5, 'heat': 42, 'aqi': 300}},
    'mumbai':    {'triggers': {'rainfall': 64.5, 'heat': 40, 'aqi': 300}},
    'delhi':     {'triggers': {'rainfall': 50,   'heat': 44, 'aqi': 400}},
    'bengaluru': {'triggers': {'rainfall': 50,   'heat': 38, 'aqi': 300}},
    'hyderabad': {'triggers': {'rainfall': 50,   'heat': 42, 'aqi': 300}},
}

TRIGGER_PAYOUT_PCT = {
    'RAINFALL':     {'payout_pct': 75},
    'EXTREME_HEAT': {'payout_pct': 60},
    'SEVERE_AQI':   {'payout_pct': 50},
}


class NextWeekInput(BaseModel):
    city:                   str
    forecast_rainfall_mm:   float
    forecast_max_temp:      float
    forecast_aqi:           float
    active_policies_count:  int
    avg_premium:            float = 49.0


@app.post("/predict-next-week")
def predict_next_week(data: NextWeekInput):
    cfg = CITY_CONFIG.get(data.city.lower(), CITY_CONFIG['chennai'])
    t   = cfg['triggers']

    # Probability calculation based on forecast vs historical thresholds
    rain_prob  = min(data.forecast_rainfall_mm / 65,  1.0) * 0.85
    heat_prob  = min(max(data.forecast_max_temp - 38, 0) / 5, 1.0) * 0.65
    aqi_prob   = min(data.forecast_aqi / 400, 1.0) * 0.60
    disruption_prob = min(max(rain_prob, heat_prob, aqi_prob) * 100, 99)

    # Top risk trigger
    probs = {
        'RAINFALL':     rain_prob,
        'EXTREME_HEAT': heat_prob,
        'SEVERE_AQI':   aqi_prob,
    }
    top_trigger = max(probs, key=probs.get)

    # Predicted claims and payouts
    predicted_claim_rate  = disruption_prob / 100 * 0.85
    predicted_claims      = round(data.active_policies_count * predicted_claim_rate)
    payout_config         = TRIGGER_PAYOUT_PCT.get(top_trigger, {})
    avg_payout_per_claim  = round((4500 / 7) * (payout_config.get('payout_pct', 75) / 100) * 0.5)
    predicted_payout      = predicted_claims * avg_payout_per_claim
    predicted_premiums    = data.active_policies_count * data.avg_premium
    predicted_loss_ratio  = round((predicted_payout / predicted_premiums * 100) if predicted_premiums > 0 else 0)

    recommended_action = (
        "Raise new policy premiums 15% immediately"
        if predicted_loss_ratio > 70 else
        "Activate reinsurance pre-authorization"
        if predicted_loss_ratio > 60 else
        "Normal operations — monitor closely"
        if predicted_loss_ratio > 40 else
        "Low risk week — standard operations"
    )

    return {
        "city":                   data.city,
        "disruption_probability": round(disruption_prob),
        "top_trigger":            top_trigger,
        "predicted_claims":       predicted_claims,
        "predicted_payout":       predicted_payout,
        "predicted_loss_ratio":   predicted_loss_ratio,
        "recommended_action":     recommended_action,
        "risk_level":             "high" if disruption_prob > 65 else "medium" if disruption_prob > 35 else "low",
    }


# ── Dev Simulate (demo only) ──────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    city:      str   = Field(..., example="chennai")
    trigger:   Literal["RAINFALL", "HEAT", "POLLUTION", "CURFEW", "FLOOD"] = "RAINFALL"
    value:     float = Field(..., example=78.5)
    worker_id: Optional[str] = None


PAYOUT_PCT = {
    "RAINFALL":  0.40,
    "HEAT":      0.30,
    "POLLUTION": 0.25,
    "FLOOD":     0.60,
    "CURFEW":    0.50,
}


@app.post("/dev/simulate")
async def simulate_disruption(req: SimulateRequest):
    """
    DEV ONLY — Simulate a disruption trigger for demo purposes.
    Runs fraud score and returns what the automated decision would be.
    """
    weekly_earnings = 4000.0  # default demo earnings

    fraud_result = await score_fraud(
        trigger_type=req.trigger,
        trigger_value=req.value,
        tenure_weeks=12,
        claims_90d=0,
        weekly_earnings=weekly_earnings,
        gps_match=True,
        has_duplicate=False,
    )

    disrupted_hours = 4
    payout = round(
        (weekly_earnings / 56) * disrupted_hours * PAYOUT_PCT.get(req.trigger, 0.3)
    )

    return {
        "simulation":    True,
        "city":          req.city,
        "trigger":       req.trigger,
        "value":         req.value,
        "fraud_score":   fraud_result["fraud_score"],
        "decision":      fraud_result["decision"],
        "signals":       fraud_result["signals"],
        "payout_amount": payout if fraud_result["decision"] == "AUTO_APPROVE" else 0,
        "message": (
            f"₹{payout} auto-approved" if fraud_result["decision"] == "AUTO_APPROVE"
            else "Flagged for review" if fraud_result["decision"] == "REVIEW"
            else "Auto-rejected"
        ),
    }


# ── Pincode Lookup (India Post API) ──────────────────────────────────────────

# Known coastal districts for risk classification
COASTAL_DISTRICTS = {
    "chennai", "thiruvallur", "kancheepuram", "cuddalore", "nagapattinam",
    "ramanathapuram", "thoothukudi", "tirunelveli", "kanniyakumari",
    "mumbai", "mumbai suburban", "thane", "raigad", "ratnagiri", "sindhudurg",
    "kolkata", "north 24 parganas", "south 24 parganas", "purba medinipur",
    "ernakulam", "kozhikode", "thiruvananthapuram", "alappuzha", "kannur",
    "visakhapatnam", "east godavari", "west godavari", "krishna", "guntur",
    "north goa", "south goa",
    "puri", "ganjam", "balasore", "kendrapara", "jagatsinghpur",
}

# Known flood-prone areas
FLOOD_PRONE_DISTRICTS = {
    "chennai", "mumbai", "mumbai suburban", "kolkata",
    "north 24 parganas", "south 24 parganas",
    "patna", "varanasi", "allahabad", "gorakhpur",
    "east godavari", "west godavari",
    "ernakulam", "alappuzha",
}

# City-to-zone classification
CITY_ZONE_MAP = {
    "chennai": {"zone": "Zone 5", "seismic": "II"},
    "mumbai": {"zone": "Zone 4", "seismic": "III"},
    "delhi": {"zone": "Zone 4", "seismic": "IV"},
    "kolkata": {"zone": "Zone 3", "seismic": "III"},
    "bengaluru": {"zone": "Zone 2", "seismic": "II"},
    "bangalore": {"zone": "Zone 2", "seismic": "II"},
    "hyderabad": {"zone": "Zone 2", "seismic": "II"},
    "pune": {"zone": "Zone 3", "seismic": "III"},
    "kochi": {"zone": "Zone 3", "seismic": "III"},
    "visakhapatnam": {"zone": "Zone 4", "seismic": "II"},
}


def _classify_risk(district: str, state: str, city_name: str) -> dict:
    """Classify risk based on district, state, and proximity to coast."""
    district_lower = district.lower()
    state_lower = state.lower()

    is_coastal = district_lower in COASTAL_DISTRICTS
    is_flood_prone = district_lower in FLOOD_PRONE_DISTRICTS

    # Base zone from city mapping or derive from district
    zone_info = CITY_ZONE_MAP.get(city_name.lower(), {})
    zone = zone_info.get("zone", "Zone 3")

    # Risk score (0-100)
    risk_score = 30  # baseline
    if is_coastal:
        risk_score += 25
    if is_flood_prone:
        risk_score += 20
    if state_lower in ("kerala", "assam", "bihar"):
        risk_score += 10  # historically flood-prone states
    if zone in ("Zone 4", "Zone 5"):
        risk_score += 15  # high cyclone/flood zone

    risk_score = min(100, risk_score)

    if risk_score >= 65:
        risk_label = "High Risk"
    elif risk_score >= 40:
        risk_label = "Medium Risk"
    else:
        risk_label = "Low Risk"

    return {
        "is_coastal": is_coastal,
        "is_flood_prone": is_flood_prone,
        "zone": zone,
        "risk_score": risk_score,
        "risk_label": risk_label,
        "type": "Coastal" if is_coastal else "Inland",
    }


@app.get("/lookup-pincode/{pincode}")
async def lookup_pincode(pincode: str):
    """
    Look up an Indian pincode via the India Post API.
    Returns area, district, state, zone, and risk classification.
    """
    if len(pincode) != 6 or not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode — must be 6 digits")

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(f"https://api.postalpincode.in/pincode/{pincode}")
            resp.raise_for_status()
            data = resp.json()

        if not data or not isinstance(data, list) or data[0].get("Status") != "Success":
            # Call fallback for non-success (404, No data, or custom status)
            return _fallback_pincode(pincode)

        post_offices = data[0].get("PostOffice", [])
        if not post_offices:
            return _fallback_pincode(pincode)

        # Use the first post office for primary data
        po = post_offices[0]
        area = po.get("Name", "Unknown")
        district = po.get("District", "Unknown")
        state = po.get("State", "Unknown")
        division = po.get("Division", "Unknown")
        region = po.get("Region", "Unknown")
        block = po.get("Block", "Unknown")

        # Classify risk based on location
        risk = _classify_risk(district, state, district)

        return {
            "pincode": pincode,
            "area": area,
            "district": district,
            "state": state,
            "division": division,
            "region": region,
            "block": block,
            "zone": risk["zone"],
            "type": risk["type"],
            "risk": risk["risk_label"],
            "risk_score": risk["risk_score"],
            "is_coastal": risk["is_coastal"],
            "is_flood_prone": risk["is_flood_prone"],
            "all_areas": [po.get("Name") for po in post_offices[:5]],
            "source": "api",
        }

    except Exception as e:
        print(f"[Pincode] General lookup error: {e}")
        # Always graceful fallback
        return _fallback_pincode(pincode)


def _fallback_pincode(pincode: str) -> dict:
    """Derive basic zone info from pincode prefix when API is down."""
    # First digit gives the postal region
    region_map = {
        "1": {"region": "Delhi & nearby", "state": "Delhi", "risk": "Medium Risk", "type": "Inland"},
        "2": {"region": "Uttar Pradesh / Uttarakhand", "state": "Uttar Pradesh", "risk": "Medium Risk", "type": "Inland"},
        "3": {"region": "Rajasthan / Gujarat", "state": "Western India", "risk": "Low Risk", "type": "Inland"},
        "4": {"region": "Maharashtra / Goa", "state": "Maharashtra", "risk": "Medium Risk", "type": "Coastal"},
        "5": {"region": "Andhra Pradesh / Telangana / Karnataka", "state": "South India", "risk": "Medium Risk", "type": "Inland"},
        "6": {"region": "Tamil Nadu / Kerala", "state": "Tamil Nadu", "risk": "High Risk", "type": "Coastal"},
        "7": {"region": "West Bengal / Odisha / NE", "state": "Eastern India", "risk": "High Risk", "type": "Coastal"},
        "8": {"region": "Bihar / Jharkhand", "state": "Bihar", "risk": "Medium Risk", "type": "Inland"},
        "9": {"region": "Army / Field Post", "state": "India", "risk": "Low Risk", "type": "Inland"},
    }

    prefix = pincode[0]
    info = region_map.get(prefix, {"region": "India", "state": "Unknown", "risk": "Medium Risk", "type": "Inland"})

    return {
        "pincode": pincode,
        "area": f"Area {pincode}",
        "district": info["region"],
        "state": info["state"],
        "division": info["region"],
        "region": info["region"],
        "block": "N/A",
        "zone": "Zone 3",
        "type": info["type"],
        "risk": info["risk"],
        "risk_score": 50,
        "is_coastal": info["type"] == "Coastal",
        "is_flood_prone": False,
        "all_areas": [],
        "source": "fallback",
    }

