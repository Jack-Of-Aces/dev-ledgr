import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090B',
          borderRadius: 36,
          border: '2px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <svg
          width="110"
          height="110"
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
    ),
    {
      ...size,
    }
  );
}
