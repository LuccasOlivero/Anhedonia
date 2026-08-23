export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export function validatePhotoFiles(files: File[]): string | null {
  if (files.length < 1 || files.length > MAX_PHOTOS) {
    return `Please select 1 to ${MAX_PHOTOS} photos.`;
  }
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return `"${file.name}" is not an image file.`;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return `"${file.name}" is larger than 5MB.`;
    }
  }
  return null;
}
