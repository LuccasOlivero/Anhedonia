import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusGauge, STAT_CONFIGS } from './StatusGauge';
import { PetHUD, computePetLevel } from './PetHUD';
import type { PetStats } from '@/lib/pet-engine';
import type { BondTierInfo } from '@/lib/bond';

describe('StatusGauge Component', () => {
  it('renders progressive horizontal bar with correct progress attributes', () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusGauge, {
        stat: 'hunger',
        value: 75,
        label: 'Hambre',
      })
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="75"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-label="Hambre: 75%"');
    expect(html).toContain('🍖');
    expect(html).toContain('Hambre: 75%');
    expect(html).toContain('75%');
    expect(html).toContain('width:75%');
  });

  it('clamps values below 0 to 0% and above 100 to 100%', () => {
    const htmlUnder = renderToStaticMarkup(
      React.createElement(StatusGauge, {
        stat: 'happiness',
        value: -20,
      })
    );
    expect(htmlUnder).toContain('aria-valuenow="0"');
    expect(htmlUnder).toContain('width:0%');
    expect(htmlUnder).toContain('0%');

    const htmlOver = renderToStaticMarkup(
      React.createElement(StatusGauge, {
        stat: 'energy',
        value: 150,
      })
    );
    expect(htmlOver).toContain('aria-valuenow="100"');
    expect(htmlOver).toContain('width:100%');
    expect(htmlOver).toContain('100%');
  });

  it('computes bar progress width correctly for 0%, 50%, and 100%', () => {
    const html0 = renderToStaticMarkup(
      React.createElement(StatusGauge, {
        stat: 'hunger',
        value: 0,
      })
    );
    expect(html0).toContain('width:0%');

    const html50 = renderToStaticMarkup(
      React.createElement(StatusGauge, {
        stat: 'hunger',
        value: 50,
      })
    );
    expect(html50).toContain('width:50%');

    const html100 = renderToStaticMarkup(
      React.createElement(StatusGauge, {
        stat: 'hunger',
        value: 100,
      })
    );
    expect(html100).toContain('width:100%');
  });

  it('renders exact gradient colors per stat type', () => {
    // Hambre: #FFA07A to #FF6347
    const htmlHambre = renderToStaticMarkup(
      React.createElement(StatusGauge, { stat: 'hambre', value: 80 })
    );
    expect(htmlHambre).toContain('#FFA07A');
    expect(htmlHambre).toContain('#FF6347');
    expect(htmlHambre).toContain('🍖');

    // Felicidad: #FFB6C1 to #FF69B4
    const htmlFelicidad = renderToStaticMarkup(
      React.createElement(StatusGauge, { stat: 'felicidad', value: 90 })
    );
    expect(htmlFelicidad).toContain('#FFB6C1');
    expect(htmlFelicidad).toContain('#FF69B4');
    expect(htmlFelicidad).toContain('😊');

    // Energía: #C4B5FD to #8B5CF6
    const htmlEnergia = renderToStaticMarkup(
      React.createElement(StatusGauge, { stat: 'energia', value: 60 })
    );
    expect(htmlEnergia).toContain('#C4B5FD');
    expect(htmlEnergia).toContain('#8B5CF6');
    expect(htmlEnergia).toContain('⚡');

    // Higiene: #7EE8DB to #20B2AA
    const htmlHigiene = renderToStaticMarkup(
      React.createElement(StatusGauge, { stat: 'higiene', value: 100 })
    );
    expect(htmlHigiene).toContain('#7EE8DB');
    expect(htmlHigiene).toContain('#20B2AA');
    expect(htmlHigiene).toContain('✨');
  });

  it('supports English stat keys (hunger, happiness, energy, cleanliness)', () => {
    expect(STAT_CONFIGS.hunger.gradientFrom).toBe('#FFA07A');
    expect(STAT_CONFIGS.happiness.gradientFrom).toBe('#FFB6C1');
    expect(STAT_CONFIGS.energy.gradientFrom).toBe('#C4B5FD');
    expect(STAT_CONFIGS.cleanliness.gradientFrom).toBe('#7EE8DB');
  });

  it('allows custom icon and label overrides', () => {
    const htmlCustom = renderToStaticMarkup(
      React.createElement(StatusGauge, {
        stat: 'hunger',
        value: 50,
        icon: '🍕',
        label: 'Comidita',
      })
    );
    expect(htmlCustom).toContain('🍕');
    expect(htmlCustom).toContain('Comidita: 50%');
    expect(htmlCustom).toContain('aria-label="Comidita: 50%"');
  });
});

describe('computePetLevel helper', () => {
  it('computes level correctly across bond score intervals (1 to 10)', () => {
    expect(computePetLevel(0)).toBe(1);
    expect(computePetLevel(5)).toBe(1);
    expect(computePetLevel(9)).toBe(1);
    expect(computePetLevel(10)).toBe(2);
    expect(computePetLevel(19)).toBe(2);
    expect(computePetLevel(20)).toBe(3);
    expect(computePetLevel(49)).toBe(5);
    expect(computePetLevel(50)).toBe(6);
    expect(computePetLevel(89)).toBe(9);
    expect(computePetLevel(90)).toBe(10);
    expect(computePetLevel(100)).toBe(10);
  });

  it('clamps invalid / out-of-range bond scores', () => {
    expect(computePetLevel(-20)).toBe(1);
    expect(computePetLevel(150)).toBe(10);
    expect(computePetLevel(NaN)).toBe(1);
  });
});

describe('PetHUD Component', () => {
  const mockStats: PetStats = {
    hunger: 85,
    happiness: 90,
    energy: 70,
    cleanliness: 95,
  };

  const mockBondTier: BondTierInfo = {
    tier: 'inseparables',
    label: 'Inseparables',
    message: '¡Sos parte de mi día! 🥰',
  };

  it('renders all HUD elements: Level Badge, Nameplate, 4 Gauges, and Coin Capsule', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetHUD, {
        petName: 'Mishi',
        coins: 420,
        bondScore: 80,
        bondTier: mockBondTier,
        stats: mockStats,
      })
    );

    // Header container
    expect(html).toContain('data-testid="pet-hud"');

    // Level Badge
    expect(html).toContain('data-testid="pet-hud-level"');
    expect(html).toContain('Niv. 9'); // 80 -> Math.floor(80/10) + 1 = 9
    expect(html).toContain('Inseparables');

    // Carved Nameplate
    expect(html).toContain('data-testid="pet-hud-nameplate"');
    expect(html).toContain('Mishi');

    // 4 Gauges
    expect(html).toContain('data-testid="status-gauge-hunger"');
    expect(html).toContain('data-testid="status-gauge-happiness"');
    expect(html).toContain('data-testid="status-gauge-energy"');
    expect(html).toContain('data-testid="status-gauge-cleanliness"');
    expect(html).toContain('85%');
    expect(html).toContain('90%');
    expect(html).toContain('70%');
    expect(html).toContain('95%');

    // Coin Capsule
    expect(html).toContain('data-testid="pet-hud-coins"');
    expect(html).toContain('420');
    expect(html).toContain('🪙');
  });

  it('computes bond tier automatically if bondTier is not explicitly provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetHUD, {
        petName: 'Pelusa',
        coins: 100,
        bondScore: 10, // Conociéndose (0-24)
        stats: mockStats,
      })
    );

    expect(html).toContain('Pelusa');
    expect(html).toContain('Niv. 2');
    expect(html).toContain('Conociéndose');
  });

  it('handles empty / default props gracefully', () => {
    const html = renderToStaticMarkup(React.createElement(PetHUD, {}));

    expect(html).toContain('data-testid="pet-hud"');
    expect(html).toContain('Mi Mascota');
    expect(html).toContain('Niv. 1');
    expect(html).toContain('0');
  });

  it('supports individual stat props (hunger, happiness, energy, cleanliness)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetHUD, {
        petName: 'Tom',
        coins: 50,
        bondScore: 35,
        hunger: 40,
        happiness: 60,
        energy: 80,
        cleanliness: 100,
      })
    );

    expect(html).toContain('Tom');
    expect(html).toContain('40%');
    expect(html).toContain('60%');
    expect(html).toContain('80%');
    expect(html).toContain('100%');
  });
});
