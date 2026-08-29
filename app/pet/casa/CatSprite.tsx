import React from 'react';

export interface CatSpriteProps {
  facing: 'left' | 'right';
  walking: boolean;
  mood?: string;
  isSick?: boolean;
  isSleeping?: boolean;
  lifeStage?: 'egg' | 'baby' | 'adult';
}

export function CatSprite({
  facing,
  walking,
  mood,
  isSick = false,
  isSleeping = false,
  lifeStage,
}: CatSpriteProps) {
  const sleeping = isSleeping || mood === 'sleeping';
  const sick = isSick || mood === 'sick';
  const sad = mood === 'sad';
  const dirty = mood === 'dirty';
  const isBaby = lifeStage === 'baby';

  return (
    <div
      className={`relative ${isBaby ? 'h-14 w-14 scale-90' : 'h-16 w-16'} ${
        walking ? 'animate-[cat-bob_0.3s_ease-in-out_infinite]' : ''
      }`}
      data-testid="cat-sprite"
    >
      <svg
        viewBox="0 0 64 64"
        className="h-full w-full drop-shadow-md"
        style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined }}
      >
        {/* body */}
        <ellipse cx="32" cy="42" rx="18" ry="14" fill="#F4A651" />
        {/* dirty spots */}
        {dirty && (
          <>
            <circle cx="26" cy="42" r="3" fill="#8B5A2B" opacity="0.6" />
            <circle cx="36" cy="45" r="2.5" fill="#8B5A2B" opacity="0.6" />
            <circle cx="40" cy="38" r="2" fill="#8B5A2B" opacity="0.5" />
          </>
        )}
        {/* head */}
        <circle cx="32" cy="22" r="14" fill="#F4A651" />
        {/* ears */}
        <polygon points="20,14 24,2 28,14" fill="#F4A651" />
        <polygon points="36,14 40,2 44,14" fill="#F4A651" />
        <polygon points="22,12 24,6 26,12" fill="#FBCB8B" />
        <polygon points="38,12 40,6 42,12" fill="#FBCB8B" />

        {/* face expressions */}
        {sleeping ? (
          <>
            {/* closed sleeping eyes */}
            <path d="M 24 23 Q 27 26 30 23" stroke="#3A2417" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 34 23 Q 37 26 40 23" stroke="#3A2417" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </>
        ) : sick ? (
          <>
            {/* dizzy/sick eyes and fever blush */}
            <circle cx="27" cy="22" r="2.5" fill="#3A2417" />
            <circle cx="37" cy="22" r="2.5" fill="#3A2417" />
            <ellipse cx="23" cy="26" rx="3" ry="1.5" fill="#84CC16" opacity="0.6" />
            <ellipse cx="41" cy="26" rx="3" ry="1.5" fill="#84CC16" opacity="0.6" />
          </>
        ) : sad ? (
          <>
            {/* sad watery eyes */}
            <circle cx="27" cy="22" r="2.5" fill="#3A2417" />
            <circle cx="37" cy="22" r="2.5" fill="#3A2417" />
            <circle cx="28" cy="24" r="1" fill="#60A5FA" />
          </>
        ) : (
          <>
            {/* happy eyes */}
            <circle cx="27" cy="22" r="2.5" fill="#3A2417" />
            <circle cx="37" cy="22" r="2.5" fill="#3A2417" />
            {/* cute cheek blush */}
            <ellipse cx="23" cy="25" rx="2.5" ry="1.5" fill="#F87171" opacity="0.5" />
            <ellipse cx="41" cy="25" rx="2.5" ry="1.5" fill="#F87171" opacity="0.5" />
          </>
        )}

        {/* mouth */}
        {sad || sick ? (
          <path d="M 30 28 Q 32 26 34 28" stroke="#3A2417" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M 30 27 Q 32 29 34 27" stroke="#3A2417" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        )}

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
