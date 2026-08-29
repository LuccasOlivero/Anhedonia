import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage from './page';
import { LoginForm } from './LoginForm';

vi.mock('./actions', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

describe('Login Page & LoginForm Pet Society Theming', () => {
  it('renders LoginPage with sky background and gleaming logo plaque', () => {
    const html = renderToStaticMarkup(React.createElement(LoginPage));
    expect(html).toContain('pet-sky-bg');
    expect(html).toContain('Pets Forever');
    expect(html).toContain('🐾');
    expect(html).toContain('✨');
  });

  it('renders LoginForm with Pet Society wood frame and parchment styling', () => {
    const html = renderToStaticMarkup(React.createElement(LoginForm));
    expect(html).toContain('pet-wood-frame');
    expect(html).toContain('bg-[#FFF9EC]');
    expect(html).toContain('🔑 Iniciar sesión');
    expect(html).toContain('✨ Crear cuenta');
  });

  it('renders signin tab active by default with email and password inputs and 3D candy button', () => {
    const html = renderToStaticMarkup(React.createElement(LoginForm));
    expect(html).toContain('¡Qué lindo verte!');
    expect(html).toContain('name="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('pet-candy-btn');
    expect(html).toContain('Ingresar al juego');
  });
});
