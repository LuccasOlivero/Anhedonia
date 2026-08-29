import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ModalWrapper,
  TiendaModal,
  DiarioModal,
  MisionesModal,
  NotificacionesModal,
} from './index';
import { ITEMS } from '@/lib/items';
import { MISSIONS, type MissionProgress } from '@/lib/missions';
import type { TimelineEntry } from '@/lib/diary';

describe('In-Game Modals Test Suite', () => {
  describe('ModalWrapper Component', () => {
    it('renders the modal container with title, icon, and wood frame styling', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModalWrapper,
          {
            title: 'Mi Ventana',
            icon: '✨',
            onClose: () => {},
          },
          React.createElement('div', { id: 'modal-body-content' }, 'Contenido del modal')
        )
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('data-testid="modal-wrapper"');
      expect(html).toContain('Mi Ventana');
      expect(html).toContain('✨');
      expect(html).toContain('Contenido del modal');
      expect(html).toContain('border-[#58331A]');
      expect(html).toContain('bg-[#FFF9EC]');
      expect(html).toContain('animate-pet-pop');
    });

    it('renders red circular candy close button with proper labels and testid', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModalWrapper,
          {
            title: 'Test',
            onClose: () => {},
          },
          null
        )
      );

      expect(html).toContain('id="modal-close-btn"');
      expect(html).toContain('data-testid="modal-close-btn"');
      expect(html).toContain('aria-label="Cerrar"');
      expect(html).toContain('title="Cerrar"');
      expect(html).toContain('✕');
    });

    it('renders badge slot when provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModalWrapper,
          {
            title: 'Test con Badge',
            onClose: () => {},
            badge: React.createElement('span', { id: 'custom-badge' }, '🪙 500'),
          },
          null
        )
      );

      expect(html).toContain('custom-badge');
      expect(html).toContain('🪙 500');
    });

    it('applies custom maxWidth and className', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          ModalWrapper,
          {
            title: 'Test Custom',
            maxWidth: 'max-w-2xl',
            className: 'custom-modal-class',
            onClose: () => {},
          },
          null
        )
      );

      expect(html).toContain('max-w-2xl');
      expect(html).toContain('custom-modal-class');
    });
  });

  describe('TiendaModal Component', () => {
    it('renders catalog items from ITEMS with names, emojis, and prices', () => {
      const html = renderToStaticMarkup(
        React.createElement(TiendaModal, {
          coins: 100,
          ownedItems: [],
        })
      );

      expect(html).toContain('data-testid="tienda-modal"');
      expect(html).toContain('Tienda de Muebles');
      expect(html).toContain('🏬');
      expect(html).toContain('data-testid="tienda-coins-badge"');
      expect(html).toContain('100');

      for (const item of ITEMS) {
        expect(html).toContain(item.name);
        expect(html).toContain(item.emoji);
        expect(html).toContain(`data-testid="tienda-item-${item.id}"`);
      }
    });

    it('correctly identifies owned items and disables their buy buttons', () => {
      const html = renderToStaticMarkup(
        React.createElement(TiendaModal, {
          coins: 100,
          ownedItems: ['planta', 'vela'],
        })
      );

      expect(html).toContain('Ya lo tenés');
      // Planta and Vela should show as owned
      expect(html).toContain('aria-label="Planta ya comprado"');
      expect(html).toContain('aria-label="Vela ya comprado"');
    });

    it('disables purchase buttons when user cannot afford the item', () => {
      const html = renderToStaticMarkup(
        React.createElement(TiendaModal, {
          coins: 5, // Can only afford free items (price 0)
          ownedItems: [],
        })
      );

      // Cama costs 80 coins -> should be disabled
      expect(html).toContain('data-testid="buy-btn-cama"');
      expect(html).toMatch(/<button[^>]*disabled[^>]*data-testid="buy-btn-cama"|<button[^>]*data-testid="buy-btn-cama"[^>]*disabled/);
    });

    it('handles object-based owned items format gracefully', () => {
      const html = renderToStaticMarkup(
        React.createElement(TiendaModal, {
          coins: 50,
          ownedItems: [
            { id: '1', pet_id: 'p1', user_id: 'u1', item_id: 'canasta', acquired_at: '' },
          ],
        })
      );

      expect(html).toContain('aria-label="Canasta ya comprado"');
    });
  });

  describe('DiarioModal Component', () => {
    it('renders diary modal header with pet name and note creation form', () => {
      const html = renderToStaticMarkup(
        React.createElement(DiarioModal, {
          petName: 'Pelusa',
          timeline: [],
        })
      );

      expect(html).toContain('data-testid="diario-modal"');
      expect(html).toContain('Diario de Pelusa');
      expect(html).toContain('📔');
      expect(html).toContain('data-testid="diario-add-note-form"');
      expect(html).toContain('Sumar un recuerdo nuevo');
      expect(html).toContain('data-testid="diario-submit-btn"');
    });

    it('renders empty state when timeline has no entries', () => {
      const html = renderToStaticMarkup(
        React.createElement(DiarioModal, {
          petName: 'Pelusa',
          timeline: [],
        })
      );

      expect(html).toContain('data-testid="diario-empty-state"');
      expect(html).toContain('Todavía no hay recuerdos. ¡Escribí el primero!');
    });

    it('renders real note and virtual milestone entries in timeline', () => {
      const mockTimeline: TimelineEntry[] = [
        {
          kind: 'real',
          entry: {
            id: 'note-1',
            pet_id: 'p1',
            user_id: 'u1',
            entry_type: 'note',
            occurred_at: '2026-08-29T00:00:00.000Z',
            mood_snapshot: 'happy',
            text: '¡Hoy jugamos mucho en el parque!',
            created_at: '2026-08-29T00:00:00.000Z',
          },
        },
        {
          kind: 'virtual',
          entry: {
            entry_type: 'hatched',
            occurred_at: '2026-08-28T00:00:00.000Z',
          },
        },
        {
          kind: 'virtual',
          entry: {
            entry_type: 'grew_up',
            occurred_at: '2026-08-29T00:00:00.000Z',
          },
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(DiarioModal, {
          petName: 'Pelusa',
          timeline: mockTimeline,
        })
      );

      expect(html).toContain('data-testid="diario-entry-real"');
      expect(html).toContain('data-testid="diario-entry-virtual"');
      expect(html).toContain('Un recuerdo de Pelusa 📝');
      expect(html).toContain('¡Hoy jugamos mucho en el parque!');
      expect(html).toContain('Pelusa salió del huevo 🐣');
      expect(html).toContain('Pelusa creció y ya es adulto 🌟');
    });
  });

  describe('MisionesModal Component', () => {
    it('renders default mission catalog when missionProgress is not passed', () => {
      const html = renderToStaticMarkup(
        React.createElement(MisionesModal, {
          coins: 250,
          petName: 'Pelusa',
        })
      );

      expect(html).toContain('data-testid="misiones-modal"');
      expect(html).toContain('Misiones de Pelusa');
      expect(html).toContain('🎯');
      expect(html).toContain('data-testid="misiones-coins-badge"');
      expect(html).toContain('250');

      for (const mission of MISSIONS) {
        expect(html).toContain(mission.description);
        expect(html).toContain(`data-testid="mission-card-${mission.id}"`);
        expect(html).toContain(`+${mission.rewardCoins}`);
      }
    });

    it('renders progress counts, progress bars, and completion badges', () => {
      const customProgress: MissionProgress[] = [
        {
          mission: MISSIONS[0], // daily feed (threshold: 1)
          periodKey: '2026-08-29',
          count: 1,
          isCompleted: true,
        },
        {
          mission: MISSIONS[2], // weekly play (threshold: 5)
          periodKey: '2026-W35',
          count: 3,
          isCompleted: false,
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(MisionesModal, {
          missionProgress: customProgress,
          coins: 100,
        })
      );

      expect(html).toContain('✅ ¡Completada!');
      expect(html).toContain('data-testid="mission-count-daily-feed"');
      expect(html).toContain('1/1');
      expect(html).toContain('data-testid="mission-count-weekly-play"');
      expect(html).toContain('3/5');
      expect(html).toContain('data-testid="mission-progress-bar-weekly-play"');
    });
  });

  describe('NotificacionesModal Component', () => {
    it('renders notification toggle switches for daily bonus and streak surprise', () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificacionesModal, {
          dailyBonusEmailEnabled: true,
          streakSurpriseEmailEnabled: false,
          petName: 'Pelusa',
        })
      );

      expect(html).toContain('data-testid="notificaciones-modal"');
      expect(html).toContain('Notificaciones de Pelusa');
      expect(html).toContain('✉️');
      expect(html).toContain('data-testid="toggle-item-daily-bonus"');
      expect(html).toContain('data-testid="toggle-item-streak-surprise"');
      expect(html).toContain('Avisarme cuando mi bono diario esté listo');
      expect(html).toContain('Avisarme cuando mi mascota tenga un regalo o sorpresa');

      // Switches ARIA states
      expect(html).toContain('data-testid="daily-bonus-switch"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('data-testid="streak-surprise-switch"');
      expect(html).toContain('aria-checked="false"');
    });

    it('reads defaults from prefs object when passed', () => {
      const html = renderToStaticMarkup(
        React.createElement(NotificacionesModal, {
          prefs: {
            daily_bonus_email_enabled: false,
            last_daily_bonus_email_sent_date: null,
            streak_surprise_email_enabled: true,
            last_streak_surprise_email_sent_date: null,
          },
        })
      );

      expect(html).toContain('data-testid="notificaciones-modal"');
      expect(html).toContain('data-testid="daily-bonus-switch"');
      expect(html).toContain('data-testid="streak-surprise-switch"');
    });
  });
});
