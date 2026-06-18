/**
 * api.js — Kavach Frontend API Client
 * 
 * ALL features work client-side with built-in fallbacks.
 * If the ML backend is available, it enriches with live weather/AQI data.
 * If not, everything still works using rule-based calculations + direct India Post API.
 */

const ML_BASE = import.meta.env.VITE_ML_BASE_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000' 
    : '/api');

// ── Tier config (mirrors backend) ──────────────────────────────────────────
const TIERS = {
  basic:    { coverage: 1500, base_premium: 49 },
  standard: { coverage: 3000, base_premium: 79 },
  pro:      { coverage: 5000, base_premium: 129 },
};

const MONTH_RISK = {
  1: 0.70, 2: 0.65, 3: 0.75, 4: 0.88,
  5: 0.92, 6: 1.10, 7: 1.20, 8: 1.20,
  9: 1.10, 10: 0.85, 11: 0.75, 12: 0.70,
};

const CITY_BASELINE = {
  chennai: 0.90, mumbai: 0.85, kolkata: 0.75,
  hyderabad: 0.60, pune: 0.55, delhi: 0.50,
  bengaluru: 0.45,
};

// ── Pincode region map (fallback when India Post API is down) ───────────────
const PINCODE_REGION_MAP = {
  '1': { region: 'Delhi & nearby',                     state: 'Delhi',          risk: 'Medium Risk', type: 'Inland' },
  '2': { region: 'Uttar Pradesh / Uttarakhand',         state: 'Uttar Pradesh',  risk: 'Medium Risk', type: 'Inland' },
  '3': { region: 'Rajasthan / Gujarat',                 state: 'Western India',  risk: 'Low Risk',    type: 'Inland' },
  '4': { region: 'Maharashtra / Goa',                   state: 'Maharashtra',    risk: 'Medium Risk', type: 'Coastal' },
  '5': { region: 'Andhra Pradesh / Telangana / Karnataka', state: 'South India', risk: 'Medium Risk', type: 'Inland' },
  '6': { region: 'Tamil Nadu / Kerala',                 state: 'Tamil Nadu',     risk: 'High Risk',   type: 'Coastal' },
  '7': { region: 'West Bengal / Odisha / NE',           state: 'Eastern India',  risk: 'High Risk',   type: 'Coastal' },
  '8': { region: 'Bihar / Jharkhand',                   state: 'Bihar',          risk: 'Medium Risk', type: 'Inland' },
  '9': { region: 'Army / Field Post',                   state: 'India',          risk: 'Low Risk',    type: 'Inland' },
};

// Known coastal & flood-prone districts for risk classification
const COASTAL_DISTRICTS = new Set([
  'chennai', 'thiruvallur', 'kancheepuram', 'cuddalore', 'nagapattinam',
  'ramanathapuram', 'thoothukudi', 'tirunelveli', 'kanniyakumari',
  'mumbai', 'mumbai suburban', 'thane', 'raigad', 'ratnagiri', 'sindhudurg',
  'kolkata', 'north 24 parganas', 'south 24 parganas', 'purba medinipur',
  'ernakulam', 'kozhikode', 'thiruvananthapuram', 'alappuzha', 'kannur',
  'visakhapatnam', 'east godavari', 'west godavari', 'krishna', 'guntur',
  'north goa', 'south goa', 'puri', 'ganjam', 'balasore', 'kendrapara', 'jagatsinghpur',
]);

const FLOOD_PRONE_DISTRICTS = new Set([
  'chennai', 'mumbai', 'mumbai suburban', 'kolkata',
  'north 24 parganas', 'south 24 parganas',
  'patna', 'varanasi', 'allahabad', 'gorakhpur',
  'east godavari', 'west godavari', 'ernakulam', 'alappuzha',
]);

const CITY_ZONE_MAP = {
  chennai:        { zone: 'Zone 5' },
  mumbai:         { zone: 'Zone 4' },
  delhi:          { zone: 'Zone 4' },
  kolkata:        { zone: 'Zone 3' },
  bengaluru:      { zone: 'Zone 2' },
  bangalore:      { zone: 'Zone 2' },
  hyderabad:      { zone: 'Zone 2' },
  pune:           { zone: 'Zone 3' },
  kochi:          { zone: 'Zone 3' },
  visakhapatnam:  { zone: 'Zone 4' },
};

// ── Helper: classify risk from district/state ─────────────────────────────
function classifyRisk(district, state, cityName) {
  const d = district.toLowerCase();
  const s = state.toLowerCase();
  const isCoastal = COASTAL_DISTRICTS.has(d);
  const isFloodProne = FLOOD_PRONE_DISTRICTS.has(d);
  const zoneInfo = CITY_ZONE_MAP[cityName.toLowerCase()] || {};
  const zone = zoneInfo.zone || 'Zone 3';

  let riskScore = 30;
  if (isCoastal) riskScore += 25;
  if (isFloodProne) riskScore += 20;
  if (['kerala', 'assam', 'bihar'].includes(s)) riskScore += 10;
  if (['Zone 4', 'Zone 5'].includes(zone)) riskScore += 15;
  riskScore = Math.min(100, riskScore);

  const riskLabel = riskScore >= 65 ? 'High Risk' : riskScore >= 40 ? 'Medium Risk' : 'Low Risk';

  return {
    is_coastal: isCoastal,
    is_flood_prone: isFloodProne,
    zone,
    risk_score: riskScore,
    risk: riskLabel,
    type: isCoastal ? 'Coastal' : 'Inland',
  };
}

// ── Pincode fallback from first digit ──────────────────────────────────────
function fallbackPincode(pincode) {
  const info = PINCODE_REGION_MAP[pincode[0]] || { region: 'India', state: 'Unknown', risk: 'Medium Risk', type: 'Inland' };
  return {
    pincode,
    area: `Area ${pincode}`,
    district: info.region,
    state: info.state,
    zone: 'Zone 3',
    type: info.type,
    risk: info.risk,
    risk_score: 50,
    is_coastal: info.type === 'Coastal',
    is_flood_prone: false,
    all_areas: [],
    source: 'fallback',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lookup Indian pincode → real area, district, state, zone info.
 * Tries: 1) ML backend  2) Direct India Post API  3) Client-side fallback
 */
export async function lookupPincode(pincode) {
  // Attempt 1: ML backend (if available)
  try {
    const res = await fetch(`${ML_BASE}/lookup-pincode/${pincode}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return await res.json();
  } catch { /* backend unavailable, try direct */ }

  // Attempt 2: Direct India Post API (works from browser, has CORS)
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data) && data[0]?.Status === 'Success') {
        const postOffices = data[0].PostOffice || [];
        if (postOffices.length > 0) {
          const po = postOffices[0];
          const district = po.District || 'Unknown';
          const state = po.State || 'Unknown';
          const risk = classifyRisk(district, state, district);
          return {
            pincode,
            area: po.Name || 'Unknown',
            district,
            state,
            division: po.Division || 'Unknown',
            region: po.Region || 'Unknown',
            block: po.Block || 'Unknown',
            zone: risk.zone,
            type: risk.type,
            risk: risk.risk,
            risk_score: risk.risk_score,
            is_coastal: risk.is_coastal,
            is_flood_prone: risk.is_flood_prone,
            all_areas: postOffices.slice(0, 5).map(p => p.Name),
            source: 'direct_api',
          };
        }
      }
    }
  } catch { /* India Post API also failed */ }

  // Attempt 3: Client-side fallback (always works)
  return fallbackPincode(pincode);
}

/**
 * Get Kavach risk score.
 * Tries ML backend first, falls back to client-side calculation.
 */
export async function getKavachScore(city, platform, earningsBracket, month = null) {
  // Try ML backend
  try {
    const body = {
      city: city.toLowerCase(),
      platform: platform.toLowerCase(),
      earnings_bracket: earningsBracket,
    };
    if (month) body.month = month;

    const res = await fetch(`${ML_BASE}/kavach-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return await res.json();
  } catch { /* backend unavailable */ }

  // Client-side fallback
  const m = month || new Date().getMonth() + 1;
  const cityBase = CITY_BASELINE[city.toLowerCase()] || 0.65;
  const seasonal = MONTH_RISK[m] || 0.80;
  const earnAdd = { basic: 10, standard: 5, pro: 0 }[earningsBracket] || 5;
  const platAdd = platform.toLowerCase() === 'zomato' ? 5 : 2;
  const score = Math.max(10, Math.min(95, Math.round(cityBase * 60 + (seasonal - 0.65) * 30 + earnAdd + platAdd)));

  return {
    kavach_score: score,
    weather_summary: 'clear sky',
    aqi_value: null,
    aqi_category: null,
    source: 'client_fallback',
  };
}

/**
 * Predict weekly premium.
 * Tries ML backend first, falls back to client-side rule-based calculation.
 */
export async function getPremiumPrediction(city, month, tenureWeeks, weeklyEarnings, claims90d = 0, platform = 0) {
  // Try ML backend
  try {
    const res = await fetch(`${ML_BASE}/predict-premium`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: city.toLowerCase(),
        month,
        tenure_weeks: tenureWeeks,
        weekly_earnings: weeklyEarnings,
        claims_90d: claims90d,
        platform,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return await res.json();
  } catch { /* backend unavailable */ }

  // Client-side fallback
  const tier = weeklyEarnings <= 3000 ? 'basic' : weeklyEarnings <= 5000 ? 'standard' : 'pro';
  const base = TIERS[tier].base_premium;
  const cityBaseline = CITY_BASELINE[city.toLowerCase()] || 0.65;
  const seasonalFactor = MONTH_RISK[month] || 0.80;
  const tenureDiscount = Math.min(0.15, tenureWeeks * 0.002);
  const claimsLoading = claims90d * 0.08;
  const platAdj = platform === 0 ? 1.00 : 0.97;

  let premium = base * (0.5 + cityBaseline) * seasonalFactor * (1 + claimsLoading) * platAdj * (1 - tenureDiscount);
  const clamp = { basic: [39, 89], standard: [59, 129], pro: [99, 199] };
  const [lo, hi] = clamp[tier];
  premium = Math.round(Math.max(lo, Math.min(hi, premium)));

  return {
    premium,
    breakdown: {
      base_premium: base,
      model_version: 'client_fallback',
      data_source: 'fallback',
    },
    recommended_tier: tier,
    coverage_cap: TIERS[tier].coverage,
  };
}

/**
 * Get live weather + AQI conditions for a city.
 * Falls back gracefully.
 */
export async function getCityConditions(city) {
  try {
    const res = await fetch(`${ML_BASE}/conditions/${encodeURIComponent(city.toLowerCase())}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return await res.json();
  } catch { /* backend unavailable */ }

  // Fallback
  return {
    city,
    weather: { temp_c: 28, condition: 'Clear', description: 'clear sky', source: 'fallback' },
    aqi: { aqi: 80, category: 'Satisfactory', source: 'fallback' },
    active_triggers: [],
    alert_level: 'green',
  };
}

/**
 * Run fraud scoring on a claim.
 */
export async function scoreFraud(params) {
  try {
    const res = await fetch(`${ML_BASE}/fraud-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return await res.json();
  } catch { /* backend unavailable */ }

  // Minimal fallback
  return {
    fraud_score: 15,
    decision: 'AUTO_APPROVE',
    reasons: [],
    signals: {},
    source: 'client_fallback',
  };
}

export async function pingML() {
  try {
    await fetch(`${ML_BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
  } catch { /* ignore */ }
}

export async function upsertWorkerProfile(profile) {
  const res = await fetch(`${ML_BASE}/workers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert worker: ${res.statusText}`);
  }
  return await res.json();
}

export async function getWorkerProfile(workerId) {
  const res = await fetch(`${ML_BASE}/workers/${encodeURIComponent(workerId)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch worker: ${res.statusText}`);
  }
  return await res.json();
}

export async function getWorkerClaims(workerId) {
  const res = await fetch(`${ML_BASE}/claims/${encodeURIComponent(workerId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch worker claims: ${res.statusText}`);
  }
  return await res.json();
}

export async function getAllClaims() {
  const res = await fetch(`${ML_BASE}/claims`);
  if (!res.ok) {
    throw new Error(`Failed to fetch all claims: ${res.statusText}`);
  }
  return await res.json();
}

export async function simulateDisruption(city, trigger, value, workerId = null) {
  const body = { city, trigger, value };
  if (workerId) body.worker_id = workerId;
  const res = await fetch(`${ML_BASE}/dev/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Simulation failed: ${res.statusText}`);
  }
  return await res.json();
}
