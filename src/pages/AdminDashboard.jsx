import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useKavachStore from '../store/useKavachStore';
import StatCard from '../components/StatCard';
import VelocityChart from '../components/VelocityChart';
import RiskMap from '../components/RiskMap';
import ClaimsTable from '../components/ClaimsTable';
import PoolHealth from '../components/PoolHealth';
import PredictivePanel from '../components/PredictivePanel';

const ML_BASE = import.meta.env.VITE_ML_BASE_URL || 'http://127.0.0.1:8000';

function DemoSimulator() {
  const [city,     setCity]     = useState('chennai');
  const [trigger,  setTrigger]  = useState('RAINFALL');
  const [value,    setValue]    = useState(78);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);

  const TRIGGERS = [
    { value: 'RAINFALL',  label: '🌧️ Heavy Rainfall',  default: 78  },
    { value: 'HEAT',      label: '🌡️ Extreme Heat',    default: 44  },
    { value: 'POLLUTION', label: '😷 Severe AQI',      default: 420 },
    { value: 'FLOOD',     label: '🌊 Flood',           default: 120 },
    { value: 'CURFEW',    label: '🚫 Curfew',          default: 1   },
  ];

  const handleSimulate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${ML_BASE}/dev/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, trigger, value }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        // Fallback demo result
        setResult({
          simulation: true,
          city,
          trigger,
          value,
          fraud_score: 12,
          decision: 'AUTO_APPROVE',
          payout_amount: Math.round((4000 / 56) * 4 * 0.4),
          message: `₹${Math.round((4000 / 56) * 4 * 0.4)} auto-approved (simulated)`,
        });
      }
    } catch {
      setResult({
        simulation: true,
        city,
        trigger,
        value,
        fraud_score: 12,
        decision: 'AUTO_APPROVE',
        payout_amount: Math.round((4000 / 56) * 4 * 0.4),
        message: `₹${Math.round((4000 / 56) * 4 * 0.4)} auto-approved (simulated)`,
      });
    }
    setLoading(false);
  };

  return (
    <div style={{
      background:   '#1A0A00',
      border:       '1px solid var(--orange)',
      borderRadius: '16px',
      padding:      '20px 24px',
      marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', fontFamily: 'Satoshi', fontWeight: 700,
          color: 'var(--orange)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          ⚡ Demo Trigger Simulator
        </p>
        <span style={{ fontSize: '11px', fontFamily: 'Inter', color: '#8E8E93' }}>
          Dev mode only
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <select value={city} onChange={e => setCity(e.target.value)}
          style={{ background: '#2C1A00', border: '1px solid var(--orange)',
            borderRadius: '8px', color: '#F5F5F0', padding: '8px 12px',
            fontFamily: 'Inter', fontSize: '13px' }}>
          {['chennai', 'mumbai', 'delhi', 'bengaluru', 'hyderabad'].map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        <select value={trigger} onChange={e => {
          setTrigger(e.target.value);
          setValue(TRIGGERS.find(t => t.value === e.target.value)?.default || 1);
        }} style={{ background: '#2C1A00', border: '1px solid var(--orange)',
          borderRadius: '8px', color: '#F5F5F0', padding: '8px 12px',
          fontFamily: 'Inter', fontSize: '13px' }}>
          {TRIGGERS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <input type="number" value={value}
          onChange={e => setValue(Number(e.target.value))}
          style={{ background: '#2C1A00', border: '1px solid var(--orange)',
            borderRadius: '8px', color: '#F5F5F0', padding: '8px 12px',
            fontFamily: 'JetBrains Mono', fontSize: '13px', width: '80px' }}
        />

        <button onClick={handleSimulate} disabled={loading}
          style={{
            background:   loading ? '#2C1A00' : 'var(--orange)',
            border:       'none',
            borderRadius: '8px',
            color:        '#fff',
            padding:      '8px 20px',
            fontFamily:   'Satoshi',
            fontSize:     '13px',
            fontWeight:   600,
            cursor:       loading ? 'not-allowed' : 'pointer',
          }}>
          {loading ? 'Simulating...' : 'Fire Trigger →'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: '12px', padding: '12px',
          background: result.decision === 'AUTO_APPROVE'
            ? 'rgba(27,127,79,0.15)' : 'rgba(232,98,10,0.15)',
          borderRadius: '10px' }}>
          <p style={{ fontSize: '12px', fontFamily: 'JetBrains Mono',
            color: result.decision === 'AUTO_APPROVE' ? '#0E9F6E' : 'var(--orange)' }}>
            {result.decision === 'AUTO_APPROVE' ? '✅' : '⚠️'} {result.message}
          </p>
          <p style={{ fontSize: '11px', fontFamily: 'Inter', color: '#8E8E93', marginTop: '4px' }}>
            Fraud Score: {result.fraud_score} · Decision: {result.decision}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { adminStats, velocityData, cities, claims, poolHealth } = useKavachStore();
  const navigate = useNavigate();

  return (
    <div className="admin-page">
      {/* Top bar */}
      <nav
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(28,28,30,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--max-width)',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            Kavach
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span
              className="pill"
              style={{
                background: 'rgba(245,166,35,0.15)',
                color: 'var(--orange)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Admin
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              A
            </div>
          </div>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Demo Simulator — top of dashboard */}
        <div className="fade-in-up">
          <DemoSimulator />
        </div>

        {/* 4 Stat Cards */}
        <div className="grid-4 fade-in-up" style={{ animationDelay: '0.05s' }}>
          <StatCard
            label="Active Policies"
            value={adminStats.activePolicies}
            color="var(--green-primary)"
          />
          <StatCard
            label="Claims This Week"
            value={adminStats.claimsThisWeek}
            color="var(--orange)"
          />
          <StatCard
            label="Loss Ratio"
            value={adminStats.lossRatio}
            suffix="%"
            color={adminStats.lossRatio < 70 ? 'var(--green-primary)' : 'var(--red)'}
          />
          <StatCard
            label="Avg Payout Time"
            value={adminStats.avgPayoutMinutes}
            suffix=" min"
            color="var(--green-primary)"
          />
        </div>

        {/* Velocity Chart */}
        <div className="fade-in-up" style={{ animationDelay: '0.1s' }}>
          <VelocityChart data={velocityData} />
        </div>

        {/* Predictive Analytics Panel */}
        <div className="fade-in-up" style={{ animationDelay: '0.12s' }}>
          <PredictivePanel />
        </div>

        {/* Map + Pool Health side by side */}
        <div className="grid-2 fade-in-up" style={{ animationDelay: '0.15s' }}>
          <RiskMap cities={cities} />
          <PoolHealth pool={poolHealth} />
        </div>

        {/* Claims Table */}
        <div className="fade-in-up" style={{ animationDelay: '0.2s' }}>
          <ClaimsTable claims={claims} />
        </div>

        {/* Footer link */}
        <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--charcoal-muted)',
              fontSize: '13px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            ← Worker Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
