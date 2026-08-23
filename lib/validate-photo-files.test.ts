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
    expect(validatePhotoFiles([])).toBe('Please select 1 to 3 photos.');
  });

  it('rejects more than 3 files', () => {
    const files = [
      makeFile('a.jpg', 'image/jpeg', 1024),
      makeFile('b.jpg', 'image/jpeg', 1024),
      makeFile('c.jpg', 'image/jpeg', 1024),
      makeFile('d.jpg', 'image/jpeg', 1024),
    ];
    expect(validatePhotoFiles(files)).toBe('Please select 1 to 3 photos.');
  });

  it('rejects a non-image file', () => {
    expect(validatePhotoFiles([makeFile('a.pdf', 'application/pdf', 1024)])).toBe(
      '"a.pdf" is not an image file.'
    );
  });

  it('rejects a file larger than 5MB', () => {
    expect(validatePhotoFiles([makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024)])).toBe(
      '"big.jpg" is larger than 5MB.'
    );
  });
});
