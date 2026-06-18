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
from supabase_service import (
    get_worker_claims_history,
    get_worker_profile,
    get_city_claim_velocity,
    upsert_worker_profile,
    create_claim,
    get_all_claims
)
from model import predict_premium, score_fraud, calculate_kavach_score

validate_config()

# Train ML models on startup
try:
    from ml_models import train_models
    train_models()
except Exception as e:
    print(f"[ML] Model training failed - using rule-based fallback: {e}")

app = FastAPI(
    title="Kavach ML Service",
    description="Live weather + AQI powered premium prediction and fraud scoring",
    version="2.0.0",
    root_path="/api",
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


# ── Worker & Claims REST API ──────────────────────────────────────────────────

class WorkerProfile(BaseModel):
    id:              str
    name:            str
    city:            str
    platform:        str
    weekly_earnings: float
    risk_score:      int = 0
    created_at:      Optional[str] = None


@app.get("/workers/{worker_id}")
async def get_worker_profile_endpoint(worker_id: str):
    profile = await get_worker_profile(worker_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    return profile


@app.post("/workers")
async def create_worker_profile_endpoint(req: WorkerProfile):
    worker_dict = req.dict(exclude_none=True)
    if not worker_dict.get("created_at"):
        worker_dict["created_at"] = datetime.datetime.utcnow().isoformat()
    success = await upsert_worker_profile(worker_dict)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save worker profile in database")
    return {"status": "success", "worker": worker_dict}


@app.get("/claims")
async def get_all_claims_endpoint():
    claims_list = await get_all_claims()
    return claims_list


@app.get("/claims/{worker_id}")
async def get_worker_claims_endpoint(worker_id: str):
    claims_list = await get_worker_claims_history(worker_id)
    return claims_list


# ── Dev Simulate & Claims Engine ──────────────────────────────────────────────

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
    Simulate a disruption trigger for demo and testing.
    Runs live fraud score, calculates payout, and writes the claim to Supabase.
    """
    weekly_earnings = 4000.0  # default fallback
    tenure_weeks = 12         # default fallback
    claims_90d = 0
    hist_avg = None

    # Fetch worker profile if ID provided to perform real calculations
    if req.worker_id:
        profile = await get_worker_profile(req.worker_id)
        if profile:
            weekly_earnings = float(profile.get("weekly_earnings", 4000.0))
            # Calculate tenure in weeks from created_at
            created_at_str = profile.get("created_at")
            if created_at_str:
                try:
                    created_at = datetime.datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    delta = datetime.datetime.now(datetime.timezone.utc) - created_at
                    tenure_weeks = max(0, delta.days // 7)
                except Exception:
                    pass

            # Fetch actual claims history for fraud engine loading
            past_claims = await get_worker_claims_history(req.worker_id)
            if past_claims:
                claims_90d = len(past_claims)
                paid = [c["payout_amount"] for c in past_claims if c.get("status") == "approved" or c.get("status") == "Approved"]
                if paid:
                    hist_avg = sum(paid) / len(paid)

    fraud_result = await score_fraud(
        trigger_type=req.trigger,
        trigger_value=req.value,
        tenure_weeks=tenure_weeks,
        claims_90d=claims_90d,
        weekly_earnings=weekly_earnings,
        gps_match=True,
        has_duplicate=False,
        historical_avg_earnings=hist_avg,
    )

    disrupted_hours = 4
    payout = round(
        (weekly_earnings / 56) * disrupted_hours * PAYOUT_PCT.get(req.trigger, 0.3)
    )
    payout_val = payout if fraud_result["decision"] == "AUTO_APPROVE" else 0

    # Translate decision status for Supabase
    status_translation = {
        "AUTO_APPROVE": "Approved",
        "REVIEW":       "Pending",
        "AUTO_REJECT":  "Rejected"
    }
    supabase_status = status_translation.get(fraud_result["decision"], "Pending")

    claim_record = {
        "worker_id":     req.worker_id or "WRK-4515",
        "trigger_type":  req.trigger,
        "payout_amount": payout_val,
        "status":        supabase_status,
        "fraud_score":   fraud_result["fraud_score"],
        "triggered_at":  datetime.datetime.utcnow().isoformat()
    }

    # Write the claim to Supabase
    await create_claim(claim_record)

    return {
        "simulation":    True,
        "city":          req.city,
        "trigger":       req.trigger,
        "value":         req.value,
        "fraud_score":   fraud_result["fraud_score"],
        "decision":      fraud_result["decision"],
        "signals":       fraud_result["signals"],
        "payout_amount": payout_val,
        "claim":         claim_record,
        "message": (
            f"₹{payout_val} auto-approved & saved to database" if fraud_result["decision"] == "AUTO_APPROVE"
            else "Flagged for review & saved to database" if fraud_result["decision"] == "REVIEW"
            else "Auto-rejected & saved to database"
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

