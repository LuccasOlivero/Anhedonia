import { describe, it, expect } from 'vitest';
import { validatePhotoFiles } from './validate-photo-files';

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('validatePhotoFiles', () => {
  it('accepts 1 to 3 valid image files', () => {
    expect(validatePhotoFiles([makeFile('a.jpg', 'image/jpeg', 1024)])).toBeNull();
  });

  it('rejects zero files', () => {
    expect(validatePhotoFiles([])).toBe('Seleccioná entre 1 y 3 fotos.');
  });

  it('rejects more than 3 files', () => {
    const files = [
      makeFile('a.jpg', 'image/jpeg', 1024),
      makeFile('b.jpg', 'image/jpeg', 1024),
      makeFile('c.jpg', 'image/jpeg', 1024),
      makeFile('d.jpg', 'image/jpeg', 1024),
    ];
    expect(validatePhotoFiles(files)).toBe('Seleccioná entre 1 y 3 fotos.');
  });

  it('rejects a non-image file', () => {
    expect(validatePhotoFiles([makeFile('a.pdf', 'application/pdf', 1024)])).toBe(
      '"a.pdf" no es una imagen válida.'
    );
  });

  it('rejects a file larger than 5MB', () => {
    expect(validatePhotoFiles([makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024)])).toBe(
      '"big.jpg" pesa más de 5MB.'
    );
  });
});
