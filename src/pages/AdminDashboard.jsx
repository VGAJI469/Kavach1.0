import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useKavachStore from '../store/useKavachStore';
import { simulateDisruption } from '../services/api';
import StatCard from '../components/StatCard';
import VelocityChart from '../components/VelocityChart';
import RiskMap from '../components/RiskMap';
import ClaimsTable from '../components/ClaimsTable';
import PoolHealth from '../components/PoolHealth';

function SimulationPanel({ onTriggerSimulate }) {
  const [city, setCity] = useState('Chennai');
  const [trigger, setTrigger] = useState('RAINFALL');
  const [value, setValue] = useState(78.5);
  const [workerId, setWorkerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await simulateDisruption(city, trigger, Number(value), workerId || null);
      setMessage({ type: 'success', text: res.message });
      onTriggerSimulate();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Simulation failed' });
    } finally {
      setLoading(false);
    }
  };

  const citiesList = ['Chennai', 'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Pune', 'Kolkata'];
  const triggersList = ['RAINFALL', 'HEAT', 'POLLUTION', 'CURFEW', 'FLOOD'];

  return (
    <div
      style={{
        background: '#2c2c2e',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'var(--shadow-card)',
        color: '#fff',
      }}
    >
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
        ⚡ Live Parametric Disruption Simulation
      </h2>
      <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', marginBottom: '24px' }}>
        Instantly simulate weather alerts or restrictions. The simulation engine queries real Open-Meteo conditions, calculates payout percentages, runs the ML fraud filter, and records claims in Supabase.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>CITY</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{
              width: '100%',
              background: '#1c1c1e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {citiesList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>TRIGGER TYPE</label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            style={{
              width: '100%',
              background: '#1c1c1e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {triggersList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>TRIGGER VALUE</label>
          <input
            type="number"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: '100%',
              background: '#1c1c1e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '10px 12px',
              borderRadius: '8px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>WORKER ID (OPTIONAL)</label>
          <input
            type="text"
            placeholder="e.g. +919999999999"
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            style={{
              width: '100%',
              background: '#1c1c1e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '10px 12px',
              borderRadius: '8px',
            }}
          />
        </div>

        <div>
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{
              padding: '12px',
              height: '46px',
              background: 'var(--green-primary)',
              color: '#fff',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <span style={{
                width: '16px', height: '16px',
                border: '2px solid rgba(255,255,255,0.2)',
                borderTop: '2px solid #fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : 'Simulate Trigger ⚡'}
          </button>
        </div>
      </form>

      {message && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          background: message.type === 'success' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 69, 58, 0.15)',
          border: message.type === 'success' ? '1px solid rgba(52, 199, 89, 0.3)' : '1px solid rgba(255, 69, 58, 0.3)',
          color: message.type === 'success' ? '#30d158' : '#ff453a',
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { adminStats, velocityData, cities, claims, poolHealth, loadAdminClaims } = useKavachStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadAdminClaims();
  }, [loadAdminClaims]);

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
        {/* 4 Stat Cards */}
        <div className="grid-4 fade-in-up">
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

        {/* Map + Pool Health side by side */}
        <div className="grid-2 fade-in-up" style={{ animationDelay: '0.15s' }}>
          <RiskMap cities={cities} />
          <PoolHealth pool={poolHealth} />
        </div>

        {/* Simulation Panel */}
        <div className="fade-in-up" style={{ animationDelay: '0.18s' }}>
          <SimulationPanel onTriggerSimulate={loadAdminClaims} />
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
