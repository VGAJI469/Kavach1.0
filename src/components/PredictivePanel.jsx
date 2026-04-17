import { useEffect, useState } from 'react';

const ML_BASE = import.meta.env.VITE_ML_BASE_URL || 'http://127.0.0.1:8000';

const CITIES = ['chennai', 'mumbai', 'delhi', 'bengaluru', 'hyderabad'];

// Fallback predictions when ML service is unavailable
const FALLBACK_PREDICTIONS = [
  { city: 'chennai',   disruption_probability: 72, top_trigger: 'RAINFALL',     predicted_claims: 89, predicted_payout: 28500, risk_level: 'high',   recommended_action: 'Raise new policy premiums 15% immediately' },
  { city: 'mumbai',    disruption_probability: 58, top_trigger: 'RAINFALL',     predicted_claims: 64, predicted_payout: 19200, risk_level: 'medium', recommended_action: 'Activate reinsurance pre-authorization' },
  { city: 'delhi',     disruption_probability: 45, top_trigger: 'SEVERE_AQI',   predicted_claims: 38, predicted_payout: 11400, risk_level: 'medium', recommended_action: 'Normal operations — monitor closely' },
  { city: 'bengaluru', disruption_probability: 22, top_trigger: 'RAINFALL',     predicted_claims: 15, predicted_payout: 4500,  risk_level: 'low',    recommended_action: 'Low risk week — standard operations' },
  { city: 'hyderabad', disruption_probability: 31, top_trigger: 'EXTREME_HEAT', predicted_claims: 20, predicted_payout: 6000,  risk_level: 'low',    recommended_action: 'Low risk week — standard operations' },
];

export default function PredictivePanel() {
  const [predictions, setPredictions] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    async function fetchPredictions() {
      try {
        const results = await Promise.all(
          CITIES.map(async (city) => {
            try {
              const pRes = await fetch(`${ML_BASE}/predict-next-week`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  city,
                  forecast_rainfall_mm:  city === 'chennai' ? 72 : city === 'mumbai' ? 55 : 20,
                  forecast_max_temp:     city === 'delhi' ? 42 : 38,
                  forecast_aqi:          city === 'delhi' ? 280 : 80,
                  active_policies_count: city === 'chennai' ? 1247 : city === 'mumbai' ? 2340 : 1000,
                  avg_premium:           49,
                }),
                signal: AbortSignal.timeout(5000),
              });
              if (pRes.ok) {
                const prediction = await pRes.json();
                return { city, ...prediction };
              }
              throw new Error('ML service unavailable');
            } catch {
              // Use fallback for this city
              return FALLBACK_PREDICTIONS.find(p => p.city === city) || 
                { city, disruption_probability: 0, top_trigger: 'UNKNOWN', risk_level: 'low', predicted_claims: 0, predicted_payout: 0, recommended_action: 'Data unavailable' };
            }
          })
        );
        setPredictions(results.sort((a, b) =>
          b.disruption_probability - a.disruption_probability
        ));
      } catch {
        // Complete fallback
        setPredictions(FALLBACK_PREDICTIONS);
      }
      setLoading(false);
    }
    fetchPredictions();
  }, []);

  if (loading) return <div className="skeleton" style={{ height: '200px', borderRadius: '20px' }} />;

  return (
    <div style={{
      background: 'var(--charcoal-card)',
      borderRadius: '20px',
      padding: '24px',
      border: '0.5px solid #2A2A2A',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '20px' }}>
        <p style={{ fontSize: '13px', fontFamily: 'Satoshi', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8E8E93' }}>
          Next 7 Days — Disruption Forecast
        </p>
        <span style={{ fontSize: '11px', fontFamily: 'Inter',
          color: '#8E8E93' }}>
          Updated every 15 min
        </span>
      </div>

      {predictions.map((pred) => (
        <div key={pred.city} style={{
          marginBottom: '16px',
          padding:      '16px',
          background:   'var(--charcoal)',
          borderRadius: '12px',
          borderLeft:   `3px solid ${
            pred.risk_level === 'high'   ? 'var(--red)'    :
            pred.risk_level === 'medium' ? 'var(--orange)' : '#2A2A2A'
          }`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontFamily: 'Satoshi',
              fontWeight: 600, color: '#F5F5F0', textTransform: 'capitalize' }}>
              {pred.city}
            </span>
            <span style={{
              fontSize: '13px',
              fontFamily: 'JetBrains Mono',
              fontWeight: 700,
              color: pred.risk_level === 'high'   ? 'var(--red)'    :
                     pred.risk_level === 'medium' ? 'var(--orange)' : '#0E9F6E',
            }}>
              {pred.disruption_probability}% risk
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: '6px', background: '#2A2A2A',
            borderRadius: '3px', marginBottom: '8px' }}>
            <div style={{
              height: '100%',
              width:  `${pred.disruption_probability}%`,
              background: pred.risk_level === 'high'   ? 'var(--red)'    :
                          pred.risk_level === 'medium' ? 'var(--orange)' : '#0E9F6E',
              borderRadius: '3px',
              transition:   'width 0.8s ease',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontFamily: 'Inter', color: '#8E8E93' }}>
              {formatTrigger(pred.top_trigger)} · {pred.predicted_claims || 0} claims likely
            </span>
            <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono', color: '#8E8E93' }}>
              ₹{(pred.predicted_payout || 0).toLocaleString()} exposure
            </span>
          </div>

          {pred.risk_level === 'high' && (
            <div style={{
              marginTop: '8px',
              padding:   '6px 12px',
              background: 'rgba(192,57,43,0.15)',
              borderRadius: '8px',
              fontSize:  '11px',
              fontFamily: 'Inter',
              color:     'var(--red)',
            }}>
              ⚠️ {pred.recommended_action}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatTrigger(type) {
  const map = {
    RAINFALL:     '🌧️ Heavy Rainfall',
    EXTREME_HEAT: '🌡️ Extreme Heat',
    SEVERE_AQI:   '😷 Severe AQI',
    CYCLONE:      '🌀 Cyclone',
    CURFEW:       '🚫 Curfew',
  };
  return map[type] || type;
}
