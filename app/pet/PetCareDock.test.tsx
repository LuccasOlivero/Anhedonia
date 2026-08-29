import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PetCareDock } from './PetCareDock';
import { ActionButtons } from './ActionButtons';

describe('PetCareDock Component', () => {
  it('renders the toolbar container with proper role, testids, and carved wood styling', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetCareDock, {
        isSleeping: false,
        isSick: false,
        isDecorating: false,
      })
    );

    expect(html).toContain('role="toolbar"');
    expect(html).toContain('aria-label="Barra de Herramientas de Cuidado y Navegación"');
    expect(html).toContain('data-testid="pet-care-dock"');
    expect(html).toContain('bg-gradient-to-b from-[#804A26] via-[#6B4226] to-[#58331A]');
  });

  it('renders all 5 primary care tools with proper testids, IDs, and emojis', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetCareDock, {
        isSleeping: false,
        isSick: false,
      })
    );

    // Group testid
    expect(html).toContain('data-testid="care-tools-group"');

    // 🍖 Alimentar
    expect(html).toContain('id="action-feed"');
    expect(html).toContain('data-testid="dock-feed-btn"');
    expect(html).toContain('🍖');
    expect(html).toContain('Alimentar');

    // 🎮 Jugar
    expect(html).toContain('id="action-play"');
    expect(html).toContain('data-testid="dock-play-btn"');
    expect(html).toContain('🎮');
    expect(html).toContain('Jugar');

    // 🛁 Bañar
    expect(html).toContain('id="action-bathe"');
    expect(html).toContain('data-testid="dock-bathe-btn"');
    expect(html).toContain('🛁');
    expect(html).toContain('Bañar');

    // 💤 Dormir
    expect(html).toContain('id="action-sleep"');
    expect(html).toContain('data-testid="dock-sleep-btn"');
    expect(html).toContain('💤');
    expect(html).toContain('Dormir');

    // 💊 Medicina
    expect(html).toContain('id="action-medicine"');
    expect(html).toContain('data-testid="dock-medicine-btn"');
    expect(html).toContain('💊');
    expect(html).toContain('Medicina');
  });

  it('renders carved wooden divider between care tools and navigation tools', () => {
    const html = renderToStaticMarkup(React.createElement(PetCareDock));
    expect(html).toContain('data-testid="dock-divider"');
  });

  it('renders all 5 navigation and modal trigger tools with proper testids and IDs', () => {
    const html = renderToStaticMarkup(React.createElement(PetCareDock));

    // Group testid
    expect(html).toContain('data-testid="nav-tools-group"');

    // 🎨 Decorar
    expect(html).toContain('id="action-decorate"');
    expect(html).toContain('data-testid="dock-decorate-btn"');
    expect(html).toContain('🎨');
    expect(html).toContain('Decorar');

    // 🏬 Tienda
    expect(html).toContain('id="action-tienda"');
    expect(html).toContain('data-testid="dock-tienda-btn"');
    expect(html).toContain('🏬');
    expect(html).toContain('Tienda');

    // 📔 Diario
    expect(html).toContain('id="action-diario"');
    expect(html).toContain('data-testid="dock-diario-btn"');
    expect(html).toContain('📔');
    expect(html).toContain('Diario');

    // 🎯 Misiones
    expect(html).toContain('id="action-misiones"');
    expect(html).toContain('data-testid="dock-misiones-btn"');
    expect(html).toContain('🎯');
    expect(html).toContain('Misiones');

    // ✉️ Notificaciones
    expect(html).toContain('id="action-notificaciones"');
    expect(html).toContain('data-testid="dock-notificaciones-btn"');
    expect(html).toContain('✉️');
    expect(html).toContain('Notificaciones');
  });

  it('toggles sleep and wake state correctly', () => {
    // When awake (isSleeping: false) -> button shows 💤 "Dormir"
    const htmlAwake = renderToStaticMarkup(
      React.createElement(PetCareDock, { isSleeping: false })
    );
    expect(htmlAwake).toContain('💤');
    expect(htmlAwake).toContain('Dormir');
    expect(htmlAwake).not.toContain('☀️');

    // When sleeping (isSleeping: true) -> button shows ☀️ "Despertar"
    const htmlAsleep = renderToStaticMarkup(
      React.createElement(PetCareDock, { isSleeping: true })
    );
    expect(htmlAsleep).toContain('☀️');
    expect(htmlAsleep).toContain('Despertar');
    expect(htmlAsleep).toContain('Durmiendo');
  });

  it('disables the Play button when pet is sleeping', () => {
    const htmlAsleep = renderToStaticMarkup(
      React.createElement(PetCareDock, { isSleeping: true })
    );
    // Play button should have disabled attribute when sleeping
    expect(htmlAsleep).toContain('id="action-play"');
    expect(htmlAsleep).toMatch(/<button[^>]*id="action-play"[^>]*disabled=""/);

    const htmlAwake = renderToStaticMarkup(
      React.createElement(PetCareDock, { isSleeping: false })
    );
    expect(htmlAwake).not.toMatch(/<button[^>]*id="action-play"[^>]*disabled=""/);
  });

  it('highlights the Medicine button with pulsing ring when pet is sick', () => {
    const htmlSick = renderToStaticMarkup(
      React.createElement(PetCareDock, { isSick: true })
    );
    expect(htmlSick).toContain('animate-pulse');
    expect(htmlSick).toContain('ring-2 ring-rose-400');
    expect(htmlSick).toContain('¡Curar!');

    const htmlHealthy = renderToStaticMarkup(
      React.createElement(PetCareDock, { isSick: false })
    );
    expect(htmlHealthy).not.toContain('animate-pulse');
  });

  it('highlights the Decorate button when isDecorating is true', () => {
    const htmlDecorating = renderToStaticMarkup(
      React.createElement(PetCareDock, { isDecorating: true })
    );
    expect(htmlDecorating).toContain('ring-2 ring-amber-300');
    expect(htmlDecorating).toContain('Listo');

    const htmlNotDecorating = renderToStaticMarkup(
      React.createElement(PetCareDock, { isDecorating: false })
    );
    expect(htmlNotDecorating).not.toContain('ring-amber-300');
    expect(htmlNotDecorating).toContain('Decorar');
  });

  it('applies custom className to the dock toolbar container', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetCareDock, { className: 'custom-dock-class' })
    );
    expect(html).toContain('custom-dock-class');
  });

  it('forwards props properly when rendered through ActionButtons backwards-compatibility adapter', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionButtons, {
        isSleeping: true,
        isSick: true,
        isDecorating: true,
        className: 'action-buttons-wrapper',
      })
    );

    expect(html).toContain('data-testid="pet-care-dock"');
    expect(html).toContain('action-buttons-wrapper');
    expect(html).toContain('id="action-feed"');
    expect(html).toContain('id="action-play"');
    expect(html).toContain('id="action-bathe"');
    expect(html).toContain('id="action-sleep"');
    expect(html).toContain('id="action-medicine"');
    expect(html).toContain('☀️');
    expect(html).toContain('animate-pulse');
  });

  it('renders complete accessible tooltips and titles for all dock buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetCareDock, {
        isSleeping: false,
        isSick: true,
        isDecorating: false,
      })
    );

    expect(html).toContain('title="Alimentar a tu mascota"');
    expect(html).toContain('title="Jugar con tu mascota"');
    expect(html).toContain('title="Bañar a tu mascota"');
    expect(html).toContain('title="Hacer dormir a tu mascota"');
    expect(html).toContain('title="¡Dar medicina a tu mascota enferma!"');
    expect(html).toContain('title="Decorar la habitación"');
    expect(html).toContain('title="Ir a la Tienda de muebles"');
    expect(html).toContain('title="Abrir el Diario de recuerdos"');
    expect(html).toContain('title="Ver Misiones y Recompensas"');
    expect(html).toContain('title="Ajustes de Notificaciones"');
  });

  it('handles default empty props gracefully without errors', () => {
    const html = renderToStaticMarkup(React.createElement(PetCareDock, {}));

    expect(html).toContain('data-testid="pet-care-dock"');
    expect(html).toContain('data-testid="dock-feed-btn"');
    expect(html).toContain('data-testid="dock-play-btn"');
    expect(html).toContain('data-testid="dock-bathe-btn"');
    expect(html).toContain('data-testid="dock-sleep-btn"');
    expect(html).toContain('data-testid="dock-medicine-btn"');
    expect(html).toContain('data-testid="dock-decorate-btn"');
    expect(html).toContain('data-testid="dock-tienda-btn"');
    expect(html).toContain('data-testid="dock-diario-btn"');
    expect(html).toContain('data-testid="dock-misiones-btn"');
    expect(html).toContain('data-testid="dock-notificaciones-btn"');
  });
});

