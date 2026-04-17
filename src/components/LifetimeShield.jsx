import { useEffect, useState } from 'react';
import useKavachStore from '../store/useKavachStore';

export default function LifetimeShield() {
  const { worker, payouts } = useKavachStore();
  const [stats, setStats] = useState({
    totalProtected: 0,
    disruptionsCovered: 0,
    weeksActive: 0,
    netSaved: 0,
    streak: 0,
  });
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!worker) return;
    try {
      const approvedPayouts = (payouts || []).filter(p => p.status === 'Approved');
      const totalProtected = approvedPayouts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const disruptionsCovered = approvedPayouts.length;
      const weeksActive = 12;
      const totalPremiums = weeksActive * (worker.policy?.premium || 65);
      const netSaved = totalProtected - totalPremiums;
      setStats({ totalProtected, disruptionsCovered, weeksActive, netSaved, streak: 4 });
      // trigger number animation after data loads
      setTimeout(() => setAnimated(true), 100);
    } catch (e) {
      console.error('[LifetimeShield] stats error:', e);
    }
  }, [worker, payouts]);

  const streak = stats.streak;

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '20px',
      padding: '24px',
      border: '0.5px solid var(--border)',
      marginBottom: '16px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{
        fontSize: '11px',
        fontFamily: 'Satoshi',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: '16px',
      }}>
        Your Kavach Impact
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <StatBox label="Total protected" value={stats.totalProtected} prefix="₹" color="var(--green-primary)" animated={animated} />
        <StatBox label="Disruptions covered" value={stats.disruptionsCovered} color="var(--green-primary)" animated={animated} />
        <StatBox label="Weeks active" value={stats.weeksActive} color="var(--text-primary)" animated={animated} />
        <StatBox label="Net savings" value={Math.max(0, stats.netSaved)} prefix="₹" color={stats.netSaved >= 0 ? 'var(--green-primary)' : 'var(--red)'} animated={animated} />
      </div>

      {streak >= 2 && (
        <div style={{
          marginTop: '16px',
          padding: '10px 16px',
          background: 'var(--green-light)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '16px' }}>🔥</span>
          <span style={{ fontSize: '13px', fontFamily: 'Inter', color: 'var(--green-primary)', fontWeight: 500 }}>
            {streak} week protection streak — keep it going
          </span>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, prefix = '', color, animated }) {
  const display = animated ? value.toLocaleString() : '—';
  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '22px',
        fontFamily: 'JetBrains Mono',
        fontWeight: 700,
        color,
        transition: 'all 0.3s ease',
      }}>
        {prefix}{display}
      </div>
    </div>
  );
}
