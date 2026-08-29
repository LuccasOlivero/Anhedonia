import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingForm } from './OnboardingForm';

vi.mock('./actions', () => ({
  createPet: vi.fn(),
}));

describe('OnboardingForm Pet Society Theming', () => {
  it('renders onboarding form container with wood frame and parchment styling', () => {
    const html = renderToStaticMarkup(React.createElement(OnboardingForm));
    expect(html).toContain('pet-wood-frame');
    expect(html).toContain('bg-[#FFF9EC]');
  });

  it('renders pet name input and photo upload dropzone', () => {
    const html = renderToStaticMarkup(React.createElement(OnboardingForm));
    expect(html).toContain('Nombre de tu mascota');
    expect(html).toContain('name="name"');
    expect(html).toContain('Fotos de tu mascota real');
    expect(html).toContain('name="photos"');
    expect(html).toContain('type="file"');
  });

  it('renders 3D candy button with "Crear mi mascota"', () => {
    const html = renderToStaticMarkup(React.createElement(OnboardingForm));
    expect(html).toContain('pet-candy-btn');
    expect(html).toContain('Crear mi mascota');
  });
});
