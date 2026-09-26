import { ImageResponse } from 'next/og';

export const alt = 'DevLedgr: Proof of work, not another tutorial clone.';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#09090B',
          padding: '80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#FAFAFA',
          position: 'relative',
        }}
      >
        {/* Subtle ambient accent glow in background */}
        <div
          style={{
            position: 'absolute',
            top: '-150px',
            right: '-150px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            filter: 'blur(120px)',
          }}
        />

        {/* Top Header: Logo + Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: '#121215',
              border: '1.5px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.5 8.5V23.5H23.5"
                stroke="#FAFAFA"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.5 13H20M13.5 18H17"
                stroke="#A1A1AA"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="22" cy="18" r="2.5" fill="#10B981" />
            </svg>
          </div>
          <span style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.03em' }}>
            DevLedgr
          </span>
          <div
            style={{
              marginLeft: '12px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#34D399',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            Verifiable Proof of Work
          </div>
        </div>

        {/* Center: Main Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px' }}>
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.04em',
              margin: 0,
              color: '#FAFAFA',
            }}
          >
            Proof of work, <br />
            <span style={{ color: '#A1A1AA' }}>not another tutorial clone.</span>
          </h1>
          <p
            style={{
              fontSize: '24px',
              lineHeight: 1.45,
              color: '#A1A1AA',
              margin: 0,
              maxWidth: '850px',
            }}
          >
            A ledger, not a resume. Real-world challenges, automated CI test telemetry, and guaranteed 1-year public portfolio URLs.
          </p>
        </div>

        {/* Bottom Bar: Metadata pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '28px',
          }}
        >
          <div style={{ display: 'flex', gap: '32px', fontSize: '17px', color: '#71717A', fontFamily: 'monospace' }}>
            <span>SHA-256 Signed Commits</span>
            <span>·</span>
            <span>Live Mock Fleet</span>
            <span>·</span>
            <span>Deterministic SLA Proof</span>
          </div>
          <span style={{ fontSize: '18px', fontWeight: 600, color: '#10B981', fontFamily: 'monospace' }}>
            devledgr.xyz
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
