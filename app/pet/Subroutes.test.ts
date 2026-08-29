import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';
import CasaPage from './casa/page';
import TiendaPage from './casa/tienda/page';
import DiaryPage from './diary/page';
import MissionsPage from './misiones/page';
import NotificacionesPage from './notificaciones/page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('Pet Sub-routes Deep Linking & Redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('/pet/casa redirects to /pet', async () => {
    await CasaPage();
    expect(redirect).toHaveBeenCalledWith('/pet');
  });

  it('/pet/casa/tienda redirects to /pet?modal=tienda', async () => {
    await TiendaPage();
    expect(redirect).toHaveBeenCalledWith('/pet?modal=tienda');
  });

  it('/pet/diary redirects to /pet?modal=diario', async () => {
    await DiaryPage();
    expect(redirect).toHaveBeenCalledWith('/pet?modal=diario');
  });

  it('/pet/misiones redirects to /pet?modal=misiones', async () => {
    await MissionsPage();
    expect(redirect).toHaveBeenCalledWith('/pet?modal=misiones');
  });

  it('/pet/notificaciones redirects to /pet?modal=notificaciones', async () => {
    await NotificacionesPage();
    expect(redirect).toHaveBeenCalledWith('/pet?modal=notificaciones');
  });
});
