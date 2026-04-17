const fetch = require('node-fetch');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * Calls the `/fraud-score-v2` endpoint of the Python ML service.
 * payload – the full FraudInputV2 JSON object.
 * Returns the parsed JSON response.
 */
async function getFraudScore(payload) {
  const resp = await fetch(`${ML_SERVICE_URL}/fraud-score-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`ML service error ${resp.status}: ${err}`);
  }
  return resp.json();
}

/**
 * Calls the `/predict-next-week` endpoint of the Python ML service.
 * payload – { city, forecast_rainfall_mm, forecast_max_temp, forecast_aqi, active_policies_count, avg_premium }
 */
async function getNextWeekPrediction(payload) {
  const resp = await fetch(`${ML_SERVICE_URL}/predict-next-week`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`ML service error ${resp.status}: ${err}`);
  }
  return resp.json();
}

module.exports = { getFraudScore, getNextWeekPrediction };
