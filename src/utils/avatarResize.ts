import { sanitizeAvatarDataUrl } from './firestoreSanitize';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB raw file limit before client square resize

export function getUserInitials(name?: string | null, email?: string | null): string {
  const cleanName = (name || '').trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }
  const cleanEmail = (email || '').trim();
  if (cleanEmail) {
    return cleanEmail.slice(0, 2).toUpperCase();
  }
  return 'OP';
}

export function resizeAvatarImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_IMAGE_MIME.has(file.type)) {
      reject(new Error('Format non supporté. Utilisez uniquement JPG, PNG ou WebP.'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('Image trop volumineuse (maximum 8 Mo avant compression).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Fichier image invalide ou corrompu.'));
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Compression image indisponible sur ce navigateur.'));
          return;
        }

        // Center-crop square
        const minDim = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - minDim) / 2);
        const sy = Math.floor((img.height - minDim) / 2);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        // Try quality levels to stay strictly under 40,000 chars (~30 KB)
        for (const quality of [0.82, 0.7, 0.55, 0.4]) {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const validated = sanitizeAvatarDataUrl(dataUrl);
          if (validated && validated.length <= 42000) {
            resolve(validated);
            return;
          }
        }
        reject(new Error('Impossible de compresser cette photo sous la limite Cloud.'));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
