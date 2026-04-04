import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useKavachStore from '../store/useKavachStore';
import KavachScore from '../components/KavachScore';
import { lookupPincode } from '../services/api';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';

const TOTAL_STEPS = 5;

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

// ─── Step 1: Platform Selection ───
function PlatformStep({ onboarding, setField }) {
  const platforms = [
    { id: 'zomato', name: 'Zomato', accent: '#E23744' },
    { id: 'swiggy', name: 'Swiggy', accent: '#FC8019' },
  ];

  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>
        Which platform do you deliver for?
      </h1>
      <p className="text-muted" style={{ marginBottom: '40px', fontSize: '16px' }}>
        We'll calibrate your coverage based on how you work.
      </p>

      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {platforms.map((p) => (
          <div
            key={p.id}
            className={`selection-card ${onboarding.platform === p.id ? 'selected' : ''}`}
            onClick={() => setField('platform', p.id)}
            style={{
              width: '220px',
              minHeight: '180px',
              flexDirection: 'column',
              justifyContent: 'center',
              borderLeft: `4px solid ${p.accent}`,
              borderRadius: '20px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
          >
            <div className="check-mark">✓</div>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: `${p.accent}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
                color: p.accent,
                marginBottom: '12px',
              }}
            >
              {p.name[0]}
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>{p.name}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setField('platform', 'both')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--green-primary)',
          fontSize: '14px',
          cursor: 'pointer',
          marginTop: '20px',
          fontWeight: 500,
        }}
      >
        I deliver for both platforms
      </button>
    </div>
  );
}

// ─── Step 2: Zone Selection (NOW WITH REAL PINCODE API) ───
function ZoneStep({ onboarding, setField }) {
  const cities = ['Chennai', 'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Pune', 'Kolkata'];
  const [showPinCode, setShowPinCode] = useState(!!onboarding.city);
  const [zone, setZone] = useState(onboarding.zone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCityChange = (e) => {
    setField('city', e.target.value);
    if (e.target.value) {
      setTimeout(() => setShowPinCode(true), 200);
    }
  };

  const handlePinChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setField('pinCode', val);
    setError(null);

    if (val.length === 6) {
      setLoading(true);
      try {
        // Call the REAL pincode API via ML backend
        const result = await lookupPincode(val);
        const detected = {
          area: result.area,
          district: result.district,
          state: result.state,
          zone: result.zone,
          type: result.type,
          risk: result.risk,
          riskScore: result.risk_score,
          isCoastal: result.is_coastal,
          isFloodProne: result.is_flood_prone,
          allAreas: result.all_areas || [],
        };
        setZone(detected);
        setField('zone', detected);
      } catch (err) {
        console.error('[Zone] Pincode lookup failed:', err);
        setError('Could not look up pincode — check ML service is running');
        setZone(null);
        setField('zone', null);
      } finally {
        setLoading(false);
      }
    } else {
      setZone(null);
      setField('zone', null);
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>
        Which area do you mostly deliver in?
      </h1>
      <p className="text-muted" style={{ marginBottom: '40px', fontSize: '16px' }}>
        Your zone helps us assess local weather risks accurately.
      </p>

      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <select
            className="input input-lg"
            value={onboarding.city}
            onChange={handleCityChange}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              background: 'var(--bg-subtle)',
              cursor: 'pointer',
              paddingRight: '44px',
            }}
          >
            <option value="">Select your city</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            ▼
          </span>
        </div>

        <AnimatePresence>
          {showPinCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <input
                type="text"
                className="input input-lg"
                placeholder="Enter your pin code"
                value={onboarding.pinCode}
                onChange={handlePinChange}
                maxLength={6}
                style={{ marginBottom: '16px' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                fontSize: '14px',
                color: 'var(--text-muted)',
              }}
            >
              <span style={{
                width: '16px', height: '16px',
                border: '2px solid var(--border)',
                borderTop: '2px solid var(--green-primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Looking up pincode...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <p style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '12px' }}>
            {error}
          </p>
        )}

        {/* Zone result */}
        <AnimatePresence>
          {zone && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                padding: '16px 20px',
                borderRadius: '16px',
                background: zone.risk === 'High Risk' ? 'var(--orange-light)'
                  : zone.risk === 'Medium Risk' ? '#fff8e1'
                  : 'var(--green-light)',
                textAlign: 'left',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                fontSize: '15px',
                fontWeight: 600,
              }}>
                📍 {zone.area}
                {zone.district !== zone.area && (
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                    · {zone.district}
                  </span>
                )}
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '12px',
              }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: 'rgba(0,0,0,0.06)',
                  fontWeight: 500,
                }}>
                  {zone.zone}
                </span>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: 'rgba(0,0,0,0.06)',
                  fontWeight: 500,
                }}>
                  {zone.type}
                </span>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: zone.risk === 'High Risk' ? '#fff3e0'
                    : zone.risk === 'Medium Risk' ? '#fff8e1'
                    : '#e8f5e9',
                  fontWeight: 600,
                  color: zone.risk === 'High Risk' ? '#e65100'
                    : zone.risk === 'Medium Risk' ? '#f57f17'
                    : '#2e7d32',
                }}>
                  {zone.risk === 'High Risk' ? '⚠️' : zone.risk === 'Medium Risk' ? '🔶' : '✅'} {zone.risk}
                </span>
                {zone.isCoastal && (
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: '#e3f2fd',
                    fontWeight: 500,
                    color: '#1565c0',
                  }}>
                    🌊 Coastal
                  </span>
                )}
                {zone.isFloodProne && (
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: '#fce4ec',
                    fontWeight: 500,
                    color: '#c62828',
                  }}>
                    🌧️ Flood-prone
                  </span>
                )}
              </div>
              {zone.state && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {zone.state}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Step 3: Earnings ───
function EarningsStep({ onboarding, setField }) {
  const brackets = [
    { id: 'basic', range: '₹2,000 – ₹3,000 / week', rec: 'Basic Shield recommended' },
    { id: 'standard', range: '₹3,000 – ₹5,000 / week', rec: 'Standard Shield recommended' },
    { id: 'pro', range: '₹5,000+ / week', rec: 'Pro Shield recommended' },
  ];

  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>
        Roughly how much do you earn in a week?
      </h1>
      <p className="text-muted" style={{ marginBottom: '40px', fontSize: '16px' }}>
        This helps us recommend the right coverage level for you.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px', margin: '0 auto' }}>
        {brackets.map((b) => (
          <div
            key={b.id}
            className={`selection-card ${onboarding.earningsBracket === b.id ? 'selected' : ''}`}
            onClick={() => setField('earningsBracket', b.id)}
            style={{ height: '80px', cursor: 'pointer' }}
          >
            <div className="check-mark">✓</div>
            <div style={{ flex: 1 }}>
              <p className="rupee" style={{ fontWeight: 600, fontSize: '16px', marginBottom: '2px' }}>
                {b.range}
              </p>
              <p className="text-muted text-sm">{b.rec}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: Phone (Bypassed OTP) ───
function PhoneStep({ onboarding, setField, onComplete }) {
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = async () => {
    if (onboarding.phone.length === 10) {
      setLoading(true);
      // FAKE DELAY FOR REALISM
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>
        What's your phone number?
      </h1>
      <p className="text-muted" style={{ marginBottom: '40px', fontSize: '16px' }}>
        Enter your number to link your policy. (OTP is bypassed for testing)
      </p>

      <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', gap: '8px' }}>
        <div
          style={{
            height: '48px',
            padding: '0 16px',
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-input)',
            display: 'flex',
            alignItems: 'center',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          +91
        </div>
        <input
          type="tel"
          className="input input-lg"
          placeholder="10-digit mobile number"
          value={onboarding.phone}
          onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
          style={{ flex: 1 }}
        />
      </div>

      <button
        className="btn btn-primary btn-full"
        disabled={onboarding.phone.length !== 10 || loading}
        onClick={handlePhoneSubmit}
        style={{ maxWidth: '400px', marginTop: '24px' }}
      >
        {loading ? 'Processing...' : 'Continue →'}
      </button>
    </div>
  );
}

// ─── Step 5: Risk Profile Result (NOW WITH LIVE ML DATA) ───
function ResultStep({ onboarding }) {
  const navigate = useNavigate();
  const score = onboarding.kavachScore;
  const policy = onboarding.recommendedPolicy;
  const isLoading = onboarding.mlLoading;
  const mlError = onboarding.mlError;

  const getRiskLabel = (s) => {
    if (s < 40) return 'Low risk — inland zone, clear season';
    if (s <= 70) return 'Moderate risk — seasonal weather patterns detected';
    return 'High risk — coastal zone, active weather alerts';
  };

  // Loading state while ML backend processes
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '60px',
            height: '60px',
            border: '3px solid var(--border)',
            borderTop: '3px solid var(--green-primary)',
            borderRadius: '50%',
            margin: '0 auto 24px',
          }}
        />
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 700,
          marginBottom: '8px',
        }}>
          Analyzing your risk profile...
        </h2>
        <p className="text-muted" style={{ fontSize: '14px' }}>
          Checking live weather, AQI, and city risk data
        </p>
      </div>
    );
  }

  // Error state
  if (mlError || !score || !policy) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 700,
          marginBottom: '8px',
        }}>
          {mlError || 'Could not calculate your score'}
        </h2>
        <p className="text-muted" style={{ fontSize: '14px', marginBottom: '24px' }}>
          Make sure the ML service is running at localhost:8000
        </p>
        <button
          className="btn btn-primary"
          onClick={() => useKavachStore.getState().completeOnboarding()}
          style={{ padding: '12px 32px' }}
        >
          Retry →
        </button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <KavachScore score={score} size={200} strokeWidth={12} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.5 }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            marginTop: '20px',
            marginBottom: '8px',
          }}
        >
          Your Kavach Score: <span className="rupee">{score}</span>
        </h2>
        <p className="text-muted" style={{ marginBottom: '12px' }}>
          {getRiskLabel(score)}
        </p>

        {/* Live data indicators */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}>
          {onboarding.weatherSummary && (
            <span style={{
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'var(--bg-subtle)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}>
              🌤️ {onboarding.weatherSummary}
            </span>
          )}
          {onboarding.aqiCategory && (
            <span style={{
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'var(--bg-subtle)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}>
              🏭 AQI: {onboarding.aqiCategory}
            </span>
          )}
          {onboarding.modelVersion && (
            <span style={{
              padding: '4px 12px',
              borderRadius: '20px',
              background: onboarding.modelVersion === 'ml' ? '#e8f5e9' : 'var(--bg-subtle)',
              fontSize: '12px',
              color: onboarding.modelVersion === 'ml' ? '#2e7d32' : 'var(--text-secondary)',
              fontWeight: onboarding.modelVersion === 'ml' ? 600 : 400,
            }}>
              🤖 {onboarding.modelVersion === 'ml' ? 'ML Model' : 'Rule-based'}
            </span>
          )}
        </div>

        {/* Recommended Policy Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderLeft: '4px solid var(--green-primary)',
            borderRadius: '20px',
            padding: '28px',
            maxWidth: '400px',
            margin: '0 auto',
            textAlign: 'left',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}
          >
            {policy.tier}
          </h3>
          <p className="rupee" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--green-primary)', marginBottom: '4px' }}>
            ₹{policy.premium}
            <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
              / this week
            </span>
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            Coverage up to ₹{policy.coverage.toLocaleString('en-IN')}
          </p>

          <button
            className="btn btn-primary btn-full"
            onClick={() => navigate('/dashboard')}
            style={{
              fontSize: '16px',
              padding: '14px',
            }}
          >
            Activate My Shield →
          </button>
        </div>

        <p className="text-muted" style={{ marginTop: '16px', fontSize: '13px' }}>
          Renews every Sunday. Cancel anytime.
        </p>
      </motion.div>
    </div>
  );
}

// ─── Main Onboarding Page ───
export default function Onboarding() {
  const { onboarding, setOnboardingField, nextStep, prevStep, setOtpDigit, completeOnboarding } =
    useKavachStore();
  const [direction, setDirection] = useState(1);
  const completingRef = useRef(false);

  const canContinue = () => {
    switch (onboarding.step) {
      case 1: return !!onboarding.platform;
      case 2: return !!onboarding.city && !!onboarding.zone;
      case 3: return !!onboarding.earningsBracket;
      case 4: return false; // Handled by OTP auto-submit
      case 5: return false;
      default: return false;
    }
  };

  const handleNext = () => {
    if (onboarding.step < TOTAL_STEPS) {
      setDirection(1);
      nextStep();
    }
  };

  const handleBack = () => {
    if (onboarding.step > 1) {
      setDirection(-1);
      prevStep();
    }
  };

  const handleOtpComplete = async () => {
    // Guard against multiple calls (rapid OTP entry can trigger this)
    if (completingRef.current) return;
    completingRef.current = true;

    setDirection(1);
    // Call ML backend BEFORE advancing to result step
    await completeOnboarding();
    nextStep();
  };

  const renderStep = () => {
    switch (onboarding.step) {
      case 1: return <PlatformStep onboarding={onboarding} setField={setOnboardingField} />;
      case 2: return <ZoneStep onboarding={onboarding} setField={setOnboardingField} />;
      case 3: return <EarningsStep onboarding={onboarding} setField={setOnboardingField} />;
      case 4: return <PhoneStep onboarding={onboarding} setField={setOnboardingField} setOtpDigit={setOtpDigit} onComplete={handleOtpComplete} />;
      case 5: return <ResultStep onboarding={onboarding} />;
      default: return null;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
      }}
    >
      {/* Progress bar */}
      <div className="progress-bar" style={{ width: `${(onboarding.step / TOTAL_STEPS) * 100}%` }} />

      {/* Header — fixed at top */}
      <div style={{
        position: 'fixed',
        top: 3,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '18px 24px',
        background: 'var(--bg-base)',
      }}>
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {onboarding.step > 1 ? (
            <button
              onClick={handleBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Kavach
          </span>

          <span className="text-muted text-sm">
            {onboarding.step} of {TOTAL_STEPS}
          </span>
        </div>
      </div>

      {/* Step content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={onboarding.step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ width: '100%', maxWidth: '600px' }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      {onboarding.step < 4 && (
        <div style={{ padding: '0 24px 32px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <button
            className="btn btn-primary btn-full"
            disabled={!canContinue()}
            onClick={handleNext}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
