import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PetGameStage,
  usePetGameStage,
  type PetModalType,
  type PetGameStageContextValue,
} from './PetGameStage';

describe('PetGameStage Component', () => {
  it('renders correctly with default slots and classes', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        hud: React.createElement('div', { id: 'test-hud' }, 'HUD Content'),
        room: React.createElement('div', { id: 'test-room' }, 'Room Content'),
        dock: React.createElement('div', { id: 'test-dock' }, 'Dock Content'),
      })
    );

    expect(html).toContain('pet-sky-bg');
    expect(html).toContain('pet-wood-frame');
    expect(html).toContain('HUD Content');
    expect(html).toContain('Room Content');
    expect(html).toContain('Dock Content');
    expect(html).toContain('data-testid="pet-game-hud"');
    expect(html).toContain('data-testid="pet-game-room"');
    expect(html).toContain('data-testid="pet-game-dock"');
  });

  it('renders children inside the main room area', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        PetGameStage,
        null,
        React.createElement('div', { id: 'child-element' }, 'Child Element')
      )
    );

    expect(html).toContain('Child Element');
  });

  it('renders modal overlay when activeModal is set and modal prop is provided', () => {
    const htmlWithModal = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: 'tienda',
        modal: React.createElement('div', { id: 'test-tienda-modal' }, 'Tienda Modal Popup'),
      })
    );

    expect(htmlWithModal).toContain('data-testid="pet-game-modal-overlay"');
    expect(htmlWithModal).toContain('Tienda Modal Popup');
  });

  it('does not render modal overlay when modal is not set', () => {
    const htmlWithoutModal = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        initialModal: null,
        modal: React.createElement('div', { id: 'test-tienda-modal' }, 'Tienda Modal Popup'),
      })
    );

    expect(htmlWithoutModal).not.toContain('data-testid="pet-game-modal-overlay"');
    expect(htmlWithoutModal).not.toContain('Tienda Modal Popup');
  });

  it('applies custom className to the stage frame', () => {
    const html = renderToStaticMarkup(
      React.createElement(PetGameStage, {
        className: 'custom-test-class',
      })
    );

    expect(html).toContain('custom-test-class');
  });

  it('supports all modal types', () => {
    const validModals: PetModalType[] = [
      'tienda',
      'diario',
      'misiones',
      'notificaciones',
      'decorar',
      'streak_reward',
    ];

    for (const modalType of validModals) {
      const html = renderToStaticMarkup(
        React.createElement(PetGameStage, {
          initialModal: modalType,
          modal: React.createElement('div', null, `Modal for ${modalType}`),
        })
      );
      expect(html).toContain(`Modal for ${modalType}`);
    }
  });

  it('provides context value to child consumers', () => {
    const holder: { context: PetGameStageContextValue | null } = { context: null };

    function TestConsumer() {
      holder.context = usePetGameStage();
      return React.createElement('span', null, `Active: ${holder.context.activeModal ?? 'none'}`);
    }

    const html = renderToStaticMarkup(
      React.createElement(
        PetGameStage,
        { initialModal: 'diario' },
        React.createElement(TestConsumer)
      )
    );

    expect(html).toContain('Active: diario');
    expect(holder.context).not.toBeNull();
    expect(holder.context?.activeModal).toBe('diario');
    expect(holder.context?.isModalOpen).toBe(true);
    expect(typeof holder.context?.openModal).toBe('function');
    expect(typeof holder.context?.closeModal).toBe('function');
    expect(typeof holder.context?.setActiveModal).toBe('function');
  });

  it('throws error when usePetGameStage is used outside provider', () => {
    function InvalidConsumer() {
      usePetGameStage();
      return null;
    }

    expect(() => {
      renderToStaticMarkup(React.createElement(InvalidConsumer));
    }).toThrow('usePetGameStage must be used within a PetGameStage');
  });
});
