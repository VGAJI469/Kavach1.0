import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const clipReveal = {
  hidden: { clipPath: 'inset(0 100% 0 0)' },
  show: { clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.2 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'var(--landing-black)', color: 'var(--landing-white)', minHeight: '100vh', fontFamily: 'var(--font-body)', overflowX: 'hidden' }}>
      {/* Hero Section */}
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', padding: '32px 24px' }}>

        {/* Top Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--landing-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
          <span>Kavach</span>
        </div>

        {/* Hero Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            <motion.h1 variants={clipReveal} style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 'clamp(48px, 8vw, 88px)', lineHeight: 1, margin: 0, color: 'var(--landing-white)' }}>
              "Your income."
            </motion.h1>

            <motion.h1 variants={clipReveal} style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(48px, 8vw, 88px)', lineHeight: 1.1, margin: '0 0 24px 0', color: 'var(--landing-white)' }}>
              "SHIELDED."
            </motion.h1>

            <motion.p variants={fadeUp} style={{ color: 'var(--landing-muted)', fontSize: '16px', maxWidth: '480px', lineHeight: 1.6, marginBottom: '48px' }}>
              Parametric income insurance for Zomato & Swiggy
              delivery partners. No forms. No waiting. Just money
              in your UPI when disruptions hit.
            </motion.p>

            <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                className="landing-glow-btn"
                onClick={() => navigate('/onboarding')}
                style={{
                  background: 'var(--landing-green)', color: '#fff', border: 'none', borderRadius: '12px',
                  width: '200px', height: '52px', fontSize: '16px', fontFamily: 'var(--font-display)', fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Get Protected →
              </button>
              <span style={{ color: 'var(--landing-muted)', fontSize: '14px' }}>
                From ₹29 / week
              </span>
            </motion.div>

          </motion.div>
        </div>
      </div>

      {/* Marquee Band */}
      <div style={{ background: 'var(--landing-surface)', height: '48px', overflow: 'hidden', display: 'flex', alignItems: 'center', borderTop: '1px solid var(--landing-border)', borderBottom: '1px solid var(--landing-border)' }}>
        <div className="marquee-track">
          {[1, 2].map(i => (
            <div key={i} style={{ display: 'flex', whiteSpace: 'nowrap', paddingRight: '40px', fontSize: '13px', color: 'var(--landing-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
              <span style={{ margin: '0 20px' }}>AUTO-TRIGGERED PAYOUTS</span>·
              <span style={{ margin: '0 20px' }}>ZERO FORMS</span>·
              <span style={{ margin: '0 20px' }}>WEEKLY COVERAGE</span>·
              <span style={{ margin: '0 20px' }}>UPI IN MINUTES</span>·
              <span style={{ margin: '0 20px' }}>FRAUD-PROOF</span>·
              <span style={{ margin: '0 20px' }}>IMD VERIFIED</span>·
            </div>
          ))}
        </div>
      </div>

      {/* Three Feature Blocks */}
      <div>
        {[
          {
            num: '01', title: 'Auto-detection', body: "Our cron job monitors weather every 15 minutes. Threshold crossed = you're paid.", stat: '₹0 forms filed'
          },
          {
            num: '02', title: 'Fraud-proof payouts', body: "5-layer spoofing defense. Only genuine claims approved. Full audit trail.", stat: '18 min avg.'
          },
          {
            num: '03', title: 'Built for your cycle', body: "Weekly premiums because you earn weekly. No monthly lock-ins, no surprises.", stat: 'From ₹29/week'
          }
        ].map((feat) => (
          <div key={feat.num} className="feature-block" style={{ borderBottom: '1px solid var(--landing-border)', padding: '48px 24px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
              <div className="feature-block-number" style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: '64px', lineHeight: 1, minWidth: '100px' }}>
                {feat.num}
              </div>
              <div style={{ flex: '1 1 300px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
                  {feat.title}
                </h3>
                <p style={{ color: 'var(--landing-muted)', fontSize: '15px', lineHeight: 1.6, maxWidth: '400px' }}>
                  {feat.body}
                </p>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'var(--landing-green)', minWidth: '200px', textAlign: 'right' }}>
                {feat.stat}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How it works section */}
      <div style={{ padding: '120px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 'clamp(40px, 6vw, 64px)', marginBottom: '64px', fontWeight: 400 }}>
          "Simple as it should be."
        </h2>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}
        >
          {[
            { step: 'STEP 01', text: 'Buy your weekly policy in 60 seconds.' },
            { step: 'STEP 02', text: 'Disruption detected via weather API.' },
            { step: 'STEP 03', text: 'System checks your location & policy.' },
            { step: 'STEP 04', text: 'Money hits your UPI. Done.' }
          ].map((item, i) => (
            <motion.div key={i} variants={fadeUp} style={{ paddingLeft: '24px', borderLeft: '1px solid var(--landing-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--landing-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 600 }}>
                {item.step}
              </div>
              <p style={{ fontSize: '15px', color: 'var(--landing-white)', lineHeight: 1.6 }}>
                {item.text}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom CTA section */}
      <div style={{ background: 'var(--landing-surface)', padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 'clamp(40px, 6vw, 72px)', margin: '0 0 16px 0', fontWeight: 400 }}>
          "Ready to get covered?"
        </h2>
        <p style={{ color: 'var(--landing-muted)', fontSize: '16px', marginBottom: '40px' }}>
          Join thousands of delivery partners protecting their income.
        </p>
        <button
          className="landing-glow-btn"
          onClick={() => navigate('/onboarding')}
          style={{
            background: 'var(--landing-green)', color: '#fff', border: 'none', borderRadius: '12px',
            padding: '16px 32px', fontSize: '16px', fontFamily: 'var(--font-display)', fontWeight: 700,
            cursor: 'pointer', marginBottom: '24px'
          }}
        >
          Activate My Shield →
        </button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--landing-muted)' }}>
          No lock-in · Cancel any week · UPI payout
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--landing-border)', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
        <span style={{ color: 'var(--landing-muted)' }}>Kavach © 2026</span>
        <button
          onClick={() => navigate('/admin')}
          style={{ background: 'none', border: 'none', color: 'var(--landing-muted)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Admin Dashboard →
        </button>
      </div>
    </div>
  );
}
