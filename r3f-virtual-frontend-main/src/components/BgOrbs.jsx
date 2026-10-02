export default function BgOrbs() {
  return (
    <div
      aria-hidden="true"
      style={{
        position:   'fixed',
        inset:      0,
        zIndex:     0,
        pointerEvents: 'none',
        overflow:   'hidden',
      }}
    >
      {/* Orb 1 — right side, indigo/violet */}
      <div style={{
        position:  'absolute',
        top:       '15%',
        right:     '-80px',
        width:     '420px',
        height:    '420px',
        borderRadius: '50%',
        background: 'rgba(99,102,241,0.12)',
        filter:    'blur(90px)',
        animation: 'orb-drift-1 18s ease-in-out infinite',
      }} />

      {/* Orb 2 — bottom center, deep blue */}
      <div style={{
        position:  'absolute',
        bottom:    '-60px',
        left:      '50%',
        transform: 'translateX(-50%)',
        width:     '300px',
        height:    '300px',
        borderRadius: '50%',
        background: 'rgba(59,130,246,0.09)',
        filter:    'blur(80px)',
        animation: 'orb-drift-2 22s ease-in-out infinite',
      }} />
    </div>
  );
}
