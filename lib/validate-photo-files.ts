export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export function validatePhotoFiles(files: File[]): string | null {
  if (files.length < 1 || files.length > MAX_PHOTOS) {
    return `Seleccioná entre 1 y ${MAX_PHOTOS} fotos.`;
  }
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return `"${file.name}" no es una imagen válida.`;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return `"${file.name}" pesa más de 5MB.`;
    }
  }
  return null;
}
