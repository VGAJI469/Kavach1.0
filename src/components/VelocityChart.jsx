import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'var(--charcoal)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
        }}
      >
        <p style={{ color: 'var(--charcoal-muted)', marginBottom: '4px' }}>{label}</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {payload[0].value} claims
        </p>
      </div>
    );
  }
  return null;
};

export default function VelocityChart({ data }) {
  const [showBanner, setShowBanner] = useState(true);
  const avg = data.reduce((a, b) => a + b.claims, 0) / data.length;
  const hasSpike = data.some((d) => d.claims > avg * 3);

  return (
    <div className="admin-card">
      {/* Spike banner */}
      {hasSpike && showBanner && (
        <div
          style={{
            background: '#2C1400',
            borderLeft: '3px solid #E8620A',
            color: '#E8620A',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          <div>
            <strong>⚠️ Spike detected</strong> — 287 claims in 15 min — Chennai
            <br />
            <span style={{ opacity: 0.8 }}>Review mode activated. Incoming claims held for verification.</span>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 0 0 12px',
              lineHeight: 1,
              opacity: 0.7,
            }}
          >
            ×
          </button>
        </div>
      )}

      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          marginBottom: '20px',
          color: '#fff',
        }}
      >
        Claim Velocity
      </h3>

      <div style={{ width: '100%', height: '280px' }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="claimGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={hasSpike ? 'var(--orange)' : 'var(--green-primary)'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={hasSpike ? 'var(--orange)' : 'var(--green-primary)'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="time"
              tick={{ fill: 'var(--charcoal-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fill: 'var(--charcoal-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="claims"
              stroke={hasSpike ? 'var(--orange)' : 'var(--green-primary)'}
              strokeWidth={2}
              fill="url(#claimGrad)"
              dot={false}
              activeDot={{ r: 5, fill: hasSpike ? 'var(--orange)' : 'var(--green-primary)', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
