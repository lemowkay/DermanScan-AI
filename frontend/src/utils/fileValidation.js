export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_DIMENSION = 32;
export const ACCEPTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'jfif', 'webp'];
export const ACCEPT_ATTR = '.png,.jpg,.jpeg,.jfif,.webp,image/png,image/jpeg,image/webp';
export const DROPZONE_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg', '.jfif'],
  'image/webp': ['.webp'],
};
export const INVALID_TYPE_MESSAGE = 'Invalid file type. Please upload a PNG, JPG, JPEG, or WebP image.';
export const TOO_LARGE_MESSAGE = `File is too large. The maximum size is ${MAX_FILE_BYTES / (1024 * 1024)} MB per image.`;
export const ALLOWED_TEXT = 'PNG, JPG/JPEG (including .jfif) or WebP';

const MIME_FOR_EXT = {
  png: ['image/png'],
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  jfif: ['image/jpeg', 'image/pjpeg', ''],   
  webp: ['image/webp'],
};

const startsWith = (bytes, sig, offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

export const sniffFormat = (bytes) => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  return null;
};

const decodeImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });

export const formatBytes = (n) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);


export const validateImageFile = async (file) => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!file.name.includes('.') || !ACCEPTED_EXTENSIONS.includes(ext)) return { valid: false, message: INVALID_TYPE_MESSAGE };
  if (!MIME_FOR_EXT[ext].includes((file.type || '').toLowerCase())) return { valid: false, message: INVALID_TYPE_MESSAGE };
  if (file.size === 0) return { valid: false, message: 'The file is empty. Please choose a valid image.' };
  if (file.size > MAX_FILE_BYTES) return { valid: false, message: TOO_LARGE_MESSAGE };

  let head;
  try {
    head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    return { valid: false, message: 'This file could not be read. Please choose another one.' };
  }
  const real = sniffFormat(head);
  const expected = ext === 'jpg' || ext === 'jfif' ? 'jpeg' : ext;
  if (!real || real !== expected) return { valid: false, message: INVALID_TYPE_MESSAGE };

  try {
    const { width, height } = await decodeImage(file);
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      return { valid: false, message: `The image is too small (minimum ${MIN_DIMENSION} x ${MIN_DIMENSION} pixels).` };
    }
  } catch {
    return { valid: false, message: 'This image appears to be corrupted or unreadable. Please choose another file.' };
  }
  return { valid: true };
};

export const messageForRejection = (rejection) => {
  const codes = rejection.errors.map((e) => e.code);
  if (codes.includes('file-too-large')) return TOO_LARGE_MESSAGE;
  if (codes.includes('too-many-files')) return 'Please select only one image at a time.';
  return INVALID_TYPE_MESSAGE;
};
