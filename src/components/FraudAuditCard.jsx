export default function FraudAuditCard({ claim }) {
  // Map legacy signal format to Phase 3 fraud audit signals
  const fraudReasons = claim.fraud_reasons || [];
  const fraudScore = claim.fraudScore || claim.fraud_score || 0;

  // Build signal list from either new fraud_reasons array or legacy signals object
  const signals = claim.fraud_reasons ? [
    { label: 'GPS zone match',            pass: !fraudReasons.includes('GPS_ZONE_MISMATCH'),           points: 40 },
    { label: 'GPS precision normal',      pass: !fraudReasons.includes('GPS_SPOOF_LOW_PRECISION'),     points: 15 },
    { label: 'Movement speed valid',      pass: !fraudReasons.includes('GPS_SPOOF_IMPOSSIBLE_SPEED'),  points: 35 },
    { label: 'Disruption event verified', pass: !fraudReasons.includes('NO_VERIFIED_DISRUPTION_EVENT'),points: 40 },
    { label: 'Zone in affected area',     pass: !fraudReasons.includes('ZONE_NOT_IN_AFFECTED_AREA'),   points: 30 },
    { label: 'Inactive during trigger',   pass: !fraudReasons.includes('ACTIVE_DURING_TRIGGER'),       points: 25 },
    { label: 'No duplicate claim',        pass: !fraudReasons.includes('DUPLICATE_CLAIM'),             points: 50 },
    { label: 'Normal claim frequency',    pass: !fraudReasons.includes('HIGH_CLAIM_VELOCITY'),         points: 20 },
    { label: 'Account established',       pass: !fraudReasons.includes('NEW_ACCOUNT'),                 points: 15 },
    { label: 'City-wide disruption confirmed', pass: !fraudReasons.includes('LOW_CITY_INACTIVITY'),    points: 25 },
  ] : [
    // Legacy format from existing mock claims
    { label: 'GPS zone match',          pass: claim.signals?.gps?.pass ?? true,       points: claim.signals?.gps?.score || 25 },
    { label: 'Activity check',          pass: claim.signals?.activity?.pass ?? true,  points: claim.signals?.activity?.score || 15 },
    { label: 'Duplicate check',         pass: claim.signals?.duplicate?.pass ?? true, points: claim.signals?.duplicate?.score || 15 },
    { label: 'Claim velocity',          pass: claim.signals?.velocity?.pass ?? true,  points: claim.signals?.velocity?.score || 20 },
    { label: 'Account age',             pass: claim.signals?.accountAge?.pass ?? true,points: claim.signals?.accountAge?.score || 10 },
    { label: 'GPS precision normal',    pass: true, points: 15 },
    { label: 'Movement speed valid',    pass: true, points: 35 },
    { label: 'Disruption event verified', pass: true, points: 40 },
    { label: 'Zone in affected area',   pass: true, points: 30 },
    { label: 'City-wide disruption OK', pass: true, points: 25 },
  ];

  const decision = fraudScore < 30 ? 'AUTO_APPROVE' :
                   fraudScore < 70 ? 'FLAG_REVIEW'  : 'AUTO_REJECT';

  return (
    <div style={{ padding: '16px', background: 'var(--charcoal)',
      borderRadius: '12px', marginTop: '8px' }}>
      <p style={{ fontSize: '12px', fontFamily: 'Satoshi', fontWeight: 700,
        color: '#8E8E93', letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: '12px' }}>
        Fraud Signal Breakdown
      </p>

      {signals.map((sig, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: '5px 0',
          borderBottom: i < signals.length - 1 ? '0.5px solid #2A2A2A' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px' }}>{sig.pass ? '✅' : '❌'}</span>
            <span style={{ fontSize: '12px', fontFamily: 'Inter',
              color: sig.pass ? '#8E8E93' : '#F5F5F0' }}>
              {sig.label}
            </span>
          </div>
          <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono',
            color: sig.pass ? '#8E8E93' : 'var(--red)' }}>
            {sig.pass ? '+0' : `+${sig.points}`}
          </span>
        </div>
      ))}

      <div style={{ marginTop: '12px', padding: '10px',
        background: decision === 'AUTO_APPROVE' ? 'rgba(27,127,79,0.15)' :
                    decision === 'FLAG_REVIEW'   ? 'rgba(232,98,10,0.15)' :
                                                   'rgba(192,57,43,0.15)',
        borderRadius: '8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono', fontWeight: 700,
          color: decision === 'AUTO_APPROVE' ? '#0E9F6E' :
                 decision === 'FLAG_REVIEW'   ? 'var(--orange)' : 'var(--red)' }}>
          {fraudScore} / 100
        </span>
        <span style={{ fontSize: '12px', fontFamily: 'Satoshi', fontWeight: 600,
          color: decision === 'AUTO_APPROVE' ? '#0E9F6E' :
                 decision === 'FLAG_REVIEW'   ? 'var(--orange)' : 'var(--red)' }}>
          → {decision}
        </span>
      </div>
    </div>
  );
}
