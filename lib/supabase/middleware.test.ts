import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from './middleware';

describe('updateSession middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('gracefully returns response when env vars are completely missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await updateSession(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
  });

  it('gracefully returns response when env vars contain placeholder values', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';

    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await updateSession(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
  });

  it('gracefully returns response when SUPABASE_URL is an invalid URL format', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-valid-url';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-looking-key-12345';

    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await updateSession(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
  });

  it('gracefully returns response when SUPABASE_ANON_KEY is empty', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://myproject.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '  ';

    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await updateSession(request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
  });
});
