
import hashlib
import io
import os

from PIL import Image, UnidentifiedImageError


ALLOWED_IMAGE_TYPES = {
    'png': {'mime': {'image/png'}, 'pil_format': 'PNG'},
    'jpg': {'mime': {'image/jpeg', 'image/jpg', 'image/pjpeg'}, 'pil_format': 'JPEG'},
    'jpeg': {'mime': {'image/jpeg', 'image/jpg', 'image/pjpeg'}, 'pil_format': 'JPEG'},
    'webp': {'mime': {'image/webp'}, 'pil_format': 'WEBP'},
    # .jfif is what Windows/Edge saves for JPEG images. Content must still be a real JPEG
    # (magic bytes + full decode); some browsers send no MIME type for this extension.
    'jfif': {'mime': {'image/jpeg', 'image/jpg', 'image/pjpeg', 'application/octet-stream', ''}, 'pil_format': 'JPEG'},
}
CANONICAL_EXT = {'PNG': 'png', 'JPEG': 'jpg', 'WEBP': 'webp'}
CANONICAL_MIME = {'PNG': 'image/png', 'JPEG': 'image/jpeg', 'WEBP': 'image/webp'}

MAX_FILE_BYTES = 10 * 1024 * 1024          # 10 MB per file
MIN_DIMENSION = 32                          # px
MAX_DIMENSION = 12000                       # px (per side)
Image.MAX_IMAGE_PIXELS = 60_000_000         # decompression-bomb guard

INVALID_TYPE_MSG = 'Invalid file type. Please upload a PNG, JPG, JPEG, or WebP image.'


class FileValidationError(Exception):
    def __init__(self, code, message, status=400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


class ValidatedImage:
    def __init__(self, data, ext, mime, width, height, sha256, original_name):
        self.data = data
        self.ext = ext
        self.mime = mime
        self.width = width
        self.height = height
        self.sha256 = sha256
        self.original_name = original_name


def sniff_format(head):
    """Identify the format from magic bytes, ignoring name and headers."""
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'PNG'
    if head.startswith(b'\xff\xd8\xff'):
        return 'JPEG'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'WEBP'
    return None


def _extension(filename):
    name = os.path.basename(filename or '')
    if '.' not in name:
        return ''
    return name.rsplit('.', 1)[1].lower()


def validate_image_upload(file_storage, max_bytes=MAX_FILE_BYTES):
    """Validate a werkzeug FileStorage. Returns ValidatedImage or raises
    FileValidationError (never returns partially-validated data)."""
    if file_storage is None or not (file_storage.filename or '').strip():
        raise FileValidationError('no_file', 'No file was selected.')

    name = file_storage.filename
    ext = _extension(name)
    if ext not in ALLOWED_IMAGE_TYPES:
        raise FileValidationError('invalid_type', INVALID_TYPE_MSG, 415)

    declared = (file_storage.mimetype or '').lower().split(';')[0].strip()
    if declared not in ALLOWED_IMAGE_TYPES[ext]['mime']:
        raise FileValidationError('invalid_type', INVALID_TYPE_MSG, 415)

    # Read at most max_bytes + 1 so oversized uploads are rejected without
    # loading them fully into memory.
    raw = file_storage.stream.read(max_bytes + 1)
    if len(raw) == 0:
        raise FileValidationError('empty_file', 'The file is empty. Please choose a valid image.')
    if len(raw) > max_bytes:
        raise FileValidationError(
            'file_too_large',
            'File is too large. The maximum size is %d MB per image.' % (max_bytes // (1024 * 1024)),
            413,
        )

    sniffed = sniff_format(raw[:16])
    if sniffed is None or sniffed != ALLOWED_IMAGE_TYPES[ext]['pil_format']:
        # Content is not a PNG/JPEG/WebP, or it does not match its extension
        # (e.g. an .exe or .zip renamed to .jpg).
        raise FileValidationError('invalid_type', INVALID_TYPE_MSG, 415)

    # Decode fully: verify() alone misses truncated data.
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            probe.verify()
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Image.DecompressionBombError:
        raise FileValidationError('image_too_large', 'The image dimensions are too large to process.', 413)
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, EOFError):
        raise FileValidationError(
            'corrupted_file', 'This image appears to be corrupted or unreadable. Please choose another file.', 422
        )

    if img.format != ALLOWED_IMAGE_TYPES[ext]['pil_format']:
        raise FileValidationError('invalid_type', INVALID_TYPE_MSG, 415)

    width, height = img.size
    if width < MIN_DIMENSION or height < MIN_DIMENSION:
        raise FileValidationError(
            'image_too_small', 'The image is too small (minimum %d x %d pixels).' % (MIN_DIMENSION, MIN_DIMENSION), 422
        )
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise FileValidationError(
            'image_too_large', 'The image dimensions are too large (maximum %d pixels per side).' % MAX_DIMENSION, 413
        )

    # Re-encode: drops EXIF/GPS + any appended payload; first frame only.
    fmt = img.format
    try:
        if fmt == 'JPEG' and img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
        elif fmt == 'PNG' and img.mode not in ('RGB', 'RGBA', 'L', 'LA', 'P'):
            img = img.convert('RGBA')
        out = io.BytesIO()
        if fmt == 'JPEG':
            img.save(out, 'JPEG', quality=92, optimize=True)
        elif fmt == 'PNG':
            img.save(out, 'PNG', optimize=True)
        else:
            img.save(out, 'WEBP', quality=92)
        clean = out.getvalue()
    except Exception:
        raise FileValidationError('corrupted_file', 'This image could not be processed. Please choose another file.', 422)

    return ValidatedImage(
        data=clean,
        ext=CANONICAL_EXT[fmt],
        mime=CANONICAL_MIME[fmt],
        width=width,
        height=height,
        sha256=hashlib.sha256(clean).hexdigest(),
        original_name=os.path.basename(name)[:120],
    )
