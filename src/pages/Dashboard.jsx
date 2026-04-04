import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useKavachStore from '../store/useKavachStore';
import ShieldCard from '../components/ShieldCard';
import KavachScore from '../components/KavachScore';
import ForecastRow from '../components/ForecastRow';
import EarningsCalendar from '../components/EarningsCalendar';
import PayoutList from '../components/PayoutList';
import DriverMap from '../components/DriverMap';

export default function Dashboard() {
  const { worker, payouts, forecast, earnings, liveConditions, conditionsLoading, fetchLiveConditions } = useKavachStore();
  const navigate = useNavigate();

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradingTier, setUpgradingTier] = useState(null);
  const [livePremium, setLivePremium] = useState(null);
  const [isGettingPremium, setIsGettingPremium] = useState(false);
  const [showToast, setShowToast] = useState(null);

  const handleUpgradeClick = async (tierName, weeklyEarnings) => {
    setUpgradingTier(tierName);
    setIsGettingPremium(true);
    try {
      const month = new Date().getMonth() + 1;
      const res = await fetch(`${import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:8000'}/predict-premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: worker.city,
          month,
          tenure_weeks: worker.tenureWeeks || 12,
          weekly_earnings: weeklyEarnings,
          claims_90d: 0,
          platform: worker.platform === 'Swiggy' ? 1 : 0
        })
      });
      const data = await res.json();
      setLivePremium(data.premium);
    } catch(e) {
      console.error(e);
      // Fallback
      setLivePremium(weeklyEarnings === 2500 ? 49 : weeklyEarnings === 4000 ? 79 : 129);
    }
    setIsGettingPremium(false);
  };

  const confirmUpgrade = async (tierName) => {
    await useKavachStore.getState().updatePolicyTier(tierName, livePremium);
    setIsUpgradeModalOpen(false);
    setUpgradingTier(null);
    setLivePremium(null);
    setShowToast(tierName);
    setTimeout(() => setShowToast(null), 3000);
  };

  const TIERS = [
    {
      name: 'Basic Shield', price: 49, cap: 1500, earnings: 2500,
      features: ['✓ Rainfall + Heat triggers', '✓ Auto-payout in <30 min'],
      missing: ['✗ Pollution & Flood cover', '✗ Curfew cover']
    },
    {
      name: 'Standard Shield', price: 79, cap: 3000, earnings: 4000,
      features: ['✓ All 5 trigger types', '✓ Auto-payout in <30 min', '✓ Priority fraud review'],
      missing: ['✗ Dedicated support']
    },
    {
      name: 'Pro Shield', price: 129, cap: 5000, earnings: 6000,
      features: ['✓ All 5 trigger types', '✓ Auto-payout in <20 min', '✓ Priority fraud review', '✓ Dedicated WhatsApp support', '✓ Earnings history analytics'],
      missing: []
    }
  ];

  // Fetch live conditions from ML backend on mount
  useEffect(() => {
    fetchLiveConditions(worker.city);
  }, [worker.city, fetchLiveConditions]);

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Top Navigation */}
      <nav
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
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
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/')}
          >
            Kavach
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Notification bell */}
            <button
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                position: 'relative',
                padding: '4px',
              }}
            >
              🔔
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '8px',
                  height: '8px',
                  background: 'var(--red)',
                  borderRadius: '50%',
                }}
              />
            </button>

            {/* Avatar */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--text-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {worker.initial}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Shield Card Area with Event Delegation */}
        <div className="fade-in-up" onClick={(e) => {
          if (e.target.tagName === 'BUTTON') {
             if (e.target.textContent.includes('Upgrade')) {
               setIsUpgradeModalOpen(true);
             } else if (e.target.textContent.includes('View Full Policy')) {
               navigate('/policy');
             }
          }
        }}>
          <ShieldCard worker={worker} />
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <span style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'underline' }} onClick={() => navigate('/policy')}>
              View Policy
            </span>
          </div>
        </div>

        {/* Score + Forecast Row */}
        <div className="grid-2 fade-in-up" style={{ animationDelay: '0.1s' }}>
          {/* Kavach Score Widget */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
            <KavachScore
              score={worker.kavachScore}
              size={160}
              strokeWidth={10}
            />

            {/* Live conditions from ML backend */}
            {liveConditions ? (
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  marginBottom: '6px',
                }}>
                  {liveConditions.weather && (
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '14px',
                      background: 'var(--bg-subtle)',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}>
                      🌡️ {liveConditions.weather.temp_c?.toFixed(1)}°C · {liveConditions.weather.description}
                    </span>
                  )}
                  {liveConditions.aqi && (
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '14px',
                      background: liveConditions.aqi.aqi > 200 ? '#fff3e0' : 'var(--bg-subtle)',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: liveConditions.aqi.aqi > 200 ? '#e65100' : 'inherit',
                    }}>
                      🏭 AQI {liveConditions.aqi.aqi} · {liveConditions.aqi.category}
                    </span>
                  )}
                </div>
                {liveConditions.active_triggers?.length > 0 && (
                  <p style={{
                    color: 'var(--red)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}>
                    ⚠️ {liveConditions.active_triggers.length} active trigger{liveConditions.active_triggers.length > 1 ? 's' : ''} detected
                  </p>
                )}
                {liveConditions.active_triggers?.length === 0 && (
                  <p className="text-muted" style={{ fontSize: '12px' }}>
                    ✅ No active weather alerts
                  </p>
                )}
              </div>
            ) : conditionsLoading ? (
              <p className="text-muted" style={{ marginTop: '12px', fontSize: '12px' }}>
                Loading live conditions...
              </p>
            ) : (
              <p className="text-muted" style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px' }}>
                Red Alert forecast Thursday — consider upgrading
              </p>
            )}
          </div>

          {/* Forecast */}
          <ForecastRow forecast={forecast} />
        </div>

        {/* Live Location Map */}
        <div className="fade-in-up" style={{ animationDelay: '0.15s' }}>
          <DriverMap />
        </div>

        {/* Earnings Calendar */}
        <div className="fade-in-up" style={{ animationDelay: '0.2s' }}>
          <EarningsCalendar earnings={earnings} />
        </div>

        {/* Recent Payouts */}
        <div className="fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              onClick={() => useKavachStore.getState().simulateClaim('Heavy Rainfall', 'rain', 320, 'Approved')}
            >
              🌧️ Simulate Claim
            </button>
          </div>
          <PayoutList payouts={payouts} />
        </div>

        {/* Footer link to admin */}
        <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '13px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Admin Dashboard →
          </button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--green-primary)',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 'var(--radius-input)',
              fontWeight: 600,
              boxShadow: 'var(--shadow-card)',
              zIndex: 100,
            }}
          >
            Policy upgraded to {showToast} ✓
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {isUpgradeModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={(e) => {
               if (e.target === e.currentTarget) setIsUpgradeModalOpen(false);
            }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="card"
              style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
            >
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
              <h2 style={{ fontSize: '24px', marginBottom: '24px', textAlign: 'center' }}>Upgrade Your Shield</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {TIERS.map(tier => (
                  <div key={tier.name} className="card" style={{ border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{tier.name}</h3>
                      <div className="text-muted" style={{ marginBottom: '16px' }}>₹{tier.price}/week</div>
                      <div style={{ fontWeight: 600, marginBottom: '16px' }}>Coverage up to ₹{tier.cap.toLocaleString()}/week</div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tier.features.map(f => <li key={f} style={{ color: 'var(--green-primary)' }}>{f}</li>)}
                        {tier.missing.map(m => <li key={m} style={{ color: 'var(--text-muted)' }}>{m}</li>)}
                      </ul>
                    </div>
                    <div style={{ marginTop: '24px' }}>
                      {worker.policy.tier === tier.name ? (
                        <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-input)', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
                          Current Plan
                        </div>
                      ) : upgradingTier === tier.name ? (
                        <button
                          className="btn btn-primary btn-full"
                          style={{ position: 'relative', fontSize: '14px', padding: '10px' }}
                          onClick={() => confirmUpgrade(tier.name)}
                          disabled={isGettingPremium}
                        >
                          {isGettingPremium ? (
                            'Calculating...'
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span>Switch to {tier.name} — ₹{livePremium}/week</span>
                              <span style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#FFD700', color: '#000', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
                                ⚡ Live price
                              </span>
                            </div>
                          )}
                        </button>
                      ) : (
                        <button
                          className="btn btn-full"
                          style={{ border: '2px solid var(--green-primary)', background: 'transparent', color: 'var(--green-primary)' }}
                          onClick={() => handleUpgradeClick(tier.name, tier.earnings)}
                          disabled={upgradingTier != null && upgradingTier !== tier.name}
                        >
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
