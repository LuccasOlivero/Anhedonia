export function CatSprite({ facing, walking }: { facing: 'left' | 'right'; walking: boolean }) {
  return (
    <div className={`relative h-16 w-16 ${walking ? 'animate-[cat-bob_0.3s_ease-in-out_infinite]' : ''}`}>
      <svg
        viewBox="0 0 64 64"
        className="h-full w-full drop-shadow-md"
        style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined }}
      >
        {/* body */}
        <ellipse cx="32" cy="42" rx="18" ry="14" fill="#F4A651" />
        {/* head */}
        <circle cx="32" cy="22" r="14" fill="#F4A651" />
        {/* ears */}
        <polygon points="20,14 24,2 28,14" fill="#F4A651" />
        <polygon points="36,14 40,2 44,14" fill="#F4A651" />
        <polygon points="22,12 24,6 26,12" fill="#FBCB8B" />
        <polygon points="38,12 40,6 42,12" fill="#FBCB8B" />
        {/* face */}
        <circle cx="27" cy="22" r="2" fill="#3A2417" />
        <circle cx="37" cy="22" r="2" fill="#3A2417" />
        <path d="M 30 27 Q 32 29 34 27" stroke="#3A2417" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* tail */}
        <path
          d="M 48 44 Q 58 40 56 28"
          stroke="#F4A651"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        {/* contact shadow */}
        <ellipse cx="32" cy="58" rx="14" ry="3" fill="#000000" opacity="0.15" />
      </svg>
    </div>
  );
}
