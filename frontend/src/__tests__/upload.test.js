import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageDropzone, ImageFileList, useImageFiles } from '../components/common/ImageUpload';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2];
beforeEach(() => {
  global.URL.createObjectURL = jest.fn(() => 'blob:x'); global.URL.revokeObjectURL = jest.fn();
  global.Image = class { set src(_) { this.naturalWidth = 64; this.naturalHeight = 64; setTimeout(() => this.onload()); } };
  Blob.prototype.arrayBuffer = function () { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsArrayBuffer(this); }); };
});

const Harness = ({ multiple }) => {
  const f = useImageFiles({ multiple, maxFiles: 3 });
  return (<div>
    <ImageDropzone id="up" label="Upload" onFiles={f.addFiles} multiple={multiple} maxFiles={3} />
    <ImageFileList items={f.items} onRemove={f.remove} />
    <p data-testid="valid">{f.validFiles.map((x) => x.name).join(',')}</p>
  </div>);
};

test('input has accept attribute and hint text lists limits', () => {
  render(<Harness />);
  const input = document.getElementById('up');
  expect(input.getAttribute('accept')).toContain('.png');
  expect(input.getAttribute('accept')).not.toContain('pdf');
  expect(screen.getByText(/Max 10 MB/)).toBeInTheDocument();
});

test('single mode: valid file previews, invalid file is rejected with message and never counted valid', async () => {
  render(<Harness />);
  const input = document.getElementById('up');
  await userEvent.upload(input, new File([new Uint8Array(PNG)], 'ok.png', { type: 'image/png' }), { applyAccept: false });
  await waitFor(() => expect(screen.getByTestId('valid')).toHaveTextContent('ok.png'));
  expect(screen.getByAltText('Preview of ok.png')).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Remove ok.png'));
  expect(screen.getByTestId('valid')).toHaveTextContent('');
  await userEvent.upload(input, new File([new Uint8Array([0x4d, 0x5a, 0, 0])], 'evil.exe', { type: 'application/x-msdownload' }), { applyAccept: false });
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid file type. Please upload a PNG, JPG, JPEG, or WebP image.');
  expect(screen.getByTestId('valid')).toHaveTextContent('');
});

test('multiple mode validates each file individually', async () => {
  render(<Harness multiple />);
  const input = document.getElementById('up');
  await userEvent.upload(input, [
    new File([new Uint8Array(PNG)], 'a.png', { type: 'image/png' }),
    new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'doc.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(PNG)], 'b.png', { type: 'image/png' }),
  ], { applyAccept: false });
  await waitFor(() => expect(screen.getByTestId('valid')).toHaveTextContent('a.png,b.png'));
  expect(screen.getAllByRole('alert')).toHaveLength(1);
});
