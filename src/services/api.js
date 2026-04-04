/**
 * api.js — Kavach ML Backend API Client
 * Connects the frontend to the FastAPI ML service at :8000
 */

const ML_BASE = import.meta.env.VITE_ML_BASE_URL || 'http://localhost:8000';

/**
 * Get Kavach risk score from ML backend (uses live weather + AQI + trained models)
 */
export async function getKavachScore(city, platform, earningsBracket, month = null) {
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
  });
  if (!res.ok) throw new Error(`Kavach score API error: ${res.status}`);
  return res.json();
}

/**
 * Predict weekly premium using trained ML model + live weather/AQI
 */
export async function getPremiumPrediction(city, month, tenureWeeks, weeklyEarnings, claims90d = 0, platform = 0) {
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
  });
  if (!res.ok) throw new Error(`Premium API error: ${res.status}`);
  return res.json();
}

/**
 * Get live weather + AQI conditions for a city
 */
export async function getCityConditions(city) {
  const res = await fetch(`${ML_BASE}/conditions/${encodeURIComponent(city.toLowerCase())}`);
  if (!res.ok) throw new Error(`Conditions API error: ${res.status}`);
  return res.json();
}

/**
 * Lookup Indian pincode → real area, district, state, zone info
 * Uses the ML backend proxy (which calls India Post API)
 */
export async function lookupPincode(pincode) {
  const res = await fetch(`${ML_BASE}/lookup-pincode/${pincode}`);
  if (!res.ok) throw new Error(`Pincode API error: ${res.status}`);
  return res.json();
}

/**
 * Run fraud scoring on a claim
 */
export async function scoreFraud(params) {
  const res = await fetch(`${ML_BASE}/fraud-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Fraud score API error: ${res.status}`);
  return res.json();
}

export async function pingML() {
  try {
    await fetch(`${ML_BASE}/health`, { method: 'GET' });
  } catch (_) {}
}
