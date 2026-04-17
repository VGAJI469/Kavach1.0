import { motion, AnimatePresence } from 'framer-motion';

export default function PayoutConfirmation({ claim, onDismiss }) {
  if (!claim || claim.status !== 'approved') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0,   scale: 1    }}
        exit={{    opacity: 0, y: -20              }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={{
          position:     'fixed',
          top:          '80px',
          left:         '50%',
          transform:    'translateX(-50%)',
          zIndex:       1000,
          background:   '#FFFFFF',
          border:       '2px solid var(--green-primary)',
          borderRadius: '20px',
          padding:      '24px 32px',
          boxShadow:    '0 8px 40px rgba(27,127,79,0.20)',
          textAlign:    'center',
          minWidth:     '300px',
        }}
      >
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
          style={{
            width: '56px', height: '56px',
            background: 'var(--green-light)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <motion.path
              d="M6 14L11 19L22 9"
              stroke="#1B7F4F"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            />
          </svg>
        </motion.div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)',
          fontFamily: 'Inter', marginBottom: '4px' }}>
          Payout credited
        </p>
        <p style={{ fontSize: '36px', fontFamily: 'JetBrains Mono',
          fontWeight: 700, color: 'var(--green-primary)', margin: '0 0 8px' }}>
          ₹{claim.payout_amount?.toLocaleString()}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)',
          fontFamily: 'Inter', marginBottom: '4px' }}>
          {formatTrigger(claim.trigger_type)} — {claim.city || 'your zone'}
        </p>
        {claim.payout_utr && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)',
            fontFamily: 'JetBrains Mono', marginBottom: '16px' }}>
            UTR: {claim.payout_utr}
          </p>
        )}
        <button onClick={onDismiss} style={{
          background: 'var(--green-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '10px 24px',
          fontFamily: 'Satoshi',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: '8px',
        }}>
          Got it
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

function formatTrigger(type) {
  const map = {
    RAINFALL:     '🌧️ Heavy Rainfall',
    EXTREME_HEAT: '🌡️ Extreme Heat',
    HEAT:         '🌡️ Extreme Heat',
    CYCLONE:      '🌀 Cyclone Alert',
    SEVERE_AQI:   '😷 Severe AQI',
    POLLUTION:    '😷 Severe AQI',
    CURFEW:       '🚫 Curfew',
    FLOOD:        '🌊 Flood',
  };
  return map[type] || type;
}
