import { validateImageFile, INVALID_TYPE_MESSAGE, TOO_LARGE_MESSAGE, sniffFormat } from '../utils/fileValidation';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const mk = (bytes, name, type) => new File([new Uint8Array(bytes)], name, { type });

beforeEach(() => {
  // jsdom cannot decode images: stub Image so "decodable" files load at 64x64.
  global.URL.createObjectURL = jest.fn(() => 'blob:x'); global.URL.revokeObjectURL = jest.fn();
  global.Image = class { set src(_) { this.naturalWidth = 64; this.naturalHeight = 64; setTimeout(() => this.onload()); } };
  Blob.prototype.arrayBuffer = function () { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsArrayBuffer(this); }); };
});

test('sniffs real formats', () => {
  expect(sniffFormat(new Uint8Array(PNG))).toBe('png');
  expect(sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
  expect(sniffFormat(new Uint8Array([0x4d, 0x5a, 0x90]))).toBeNull();
});

test('accepts valid png/jpg', async () => {
  expect((await validateImageFile(mk([...PNG, 1, 2, 3], 'a.png', 'image/png'))).valid).toBe(true);
  expect((await validateImageFile(mk([0xff, 0xd8, 0xff, 1], 'a.JPG', 'image/jpeg'))).valid).toBe(true);
});

test.each([
  ['virus.exe', 'application/x-msdownload'], ['a.zip', 'application/zip'], ['a.docx', 'application/msword'],
  ['a.pdf', 'application/pdf'], ['a.gif', 'image/gif'], ['noext', 'image/png'],
])('rejects %s', async (name, type) => {
  const r = await validateImageFile(mk([...PNG, 1], name, type));
  expect(r).toEqual({ valid: false, message: INVALID_TYPE_MESSAGE });
});

test('rejects disguised exe renamed .jpg and MIME mismatch', async () => {
  expect((await validateImageFile(mk([0x4d, 0x5a, 0x90, 0], 'x.jpg', 'image/jpeg'))).message).toBe(INVALID_TYPE_MESSAGE);
  expect((await validateImageFile(mk([...PNG, 1], 'x.jpg', 'image/jpeg'))).message).toBe(INVALID_TYPE_MESSAGE); // png bytes, jpg name
});

test('rejects empty and oversize', async () => {
  expect((await validateImageFile(mk([], 'a.png', 'image/png'))).message).toMatch(/empty/);
  const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'b.png', { type: 'image/png' });
  expect((await validateImageFile(big)).message).toBe(TOO_LARGE_MESSAGE);
});

test('corrupted image that fails to decode', async () => {
  global.Image = class { set src(_) { setTimeout(() => this.onerror()); } };
  expect((await validateImageFile(mk([...PNG, 1], 'a.png', 'image/png'))).message).toMatch(/corrupted/);
});

test('.jfif (Windows JPEG) is accepted, with or without a MIME type, but must really be a JPEG', async () => {
  const jpeg = [0xff, 0xd8, 0xff, 0xe0, 1, 2];
  expect((await validateImageFile(mk(jpeg, 'Boil.jfif', 'image/jpeg'))).valid).toBe(true);
  expect((await validateImageFile(mk(jpeg, 'Boil.jfif', ''))).valid).toBe(true);
  expect((await validateImageFile(mk([...PNG, 1], 'x.jfif', 'image/jpeg'))).message).toBe(INVALID_TYPE_MESSAGE);
  expect((await validateImageFile(mk([0x4d, 0x5a, 0, 0], 'x.jfif', ''))).message).toBe(INVALID_TYPE_MESSAGE);
});
