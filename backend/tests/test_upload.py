import io
import os

from PIL import Image

from .conftest import auth, make_image, upload


def err(r):
    return r.get_json()['code']


def test_valid_formats_accepted(client, patient):
    assert upload(client, patient, make_image('PNG'), 'a.png', 'image/png').status_code == 201
    assert upload(client, patient, make_image('JPEG'), 'a.jpg', 'image/jpeg').status_code == 201
    assert upload(client, patient, make_image('JPEG'), 'a.JPEG', 'image/jpeg').status_code == 201
    assert upload(client, patient, make_image('WEBP'), 'a.webp', 'image/webp').status_code == 201


def test_rejects_wrong_extensions(client, patient):
    for name, mime in [('virus.exe', 'application/octet-stream'), ('a.zip', 'application/zip'), ('a.docx', 'application/msword'),
                       ('a.pdf', 'application/pdf'), ('a.gif', 'image/gif'), ('noext', 'image/png'), ('a.svg', 'image/svg+xml')]:
        r = upload(client, patient, make_image(), name, mime)
        assert r.status_code == 415 and err(r) == 'invalid_type', name
        assert 'Invalid file type' in r.get_json()['message']


def test_rejects_disguised_files(client, patient):
    # exe/zip/pdf content renamed to .jpg with a lying MIME type
    for payload in [b'MZ\x90\x00' + b'\x00' * 200, b'PK\x03\x04' + b'\x00' * 200, b'%PDF-1.4' + b'\x00' * 200, b'<?php echo 1;?>' * 20]:
        r = upload(client, patient, payload, 'photo.jpg', 'image/jpeg')
        assert r.status_code == 415, payload[:4]
    # real PNG renamed .jpg
    assert upload(client, patient, make_image('PNG'), 'x.jpg', 'image/jpeg').status_code == 415
    # real PNG but MIME claims jpeg for .png
    assert upload(client, patient, make_image('PNG'), 'x.png', 'application/pdf').status_code == 415


def test_empty_and_corrupt(client, patient):
    assert err(upload(client, patient, b'', 'e.png', 'image/png')) == 'empty_file'
    good = make_image('PNG', (256, 256))
    assert err(upload(client, patient, good[: len(good) // 2], 't.png', 'image/png')) == 'corrupted_file'
    assert err(upload(client, patient, b'\x89PNG\r\n\x1a\n' + os.urandom(100), 'c.png', 'image/png')) == 'corrupted_file'


def test_size_and_dimensions(client, patient):
    big = make_image('PNG') + b'\0' * (10 * 1024 * 1024 + 10)
    r = upload(client, patient, big, 'big.png', 'image/png')
    assert r.status_code == 413 and err(r) == 'file_too_large'
    assert err(upload(client, patient, make_image('PNG', (8, 8)), 's.png', 'image/png')) == 'image_too_small'


def test_no_file_and_multiple(client, patient):
    assert client.post('/api/scan/upload', headers=auth(patient), data={}, content_type='multipart/form-data').status_code == 400
    r = client.post('/api/scan/upload', headers=auth(patient), content_type='multipart/form-data',
                    data={'image': [(io.BytesIO(make_image()), 'a.png', 'image/png'), (io.BytesIO(make_image()), 'b.png', 'image/png')]})
    assert r.status_code == 400 and err(r) == 'too_many_files'


def test_requires_auth(client):
    r = client.post('/api/scan/upload', data={'image': (io.BytesIO(make_image()), 'a.png', 'image/png')}, content_type='multipart/form-data')
    assert r.status_code == 401


def test_nothing_saved_for_invalid(client, patient, app):
    upload(client, patient, b'MZ' * 100, 'a.jpg', 'image/jpeg')
    folder = app.config['UPLOAD_FOLDER']
    assert not os.path.isdir(folder) or os.listdir(folder) == []
    assert client.get('/api/scan/history', headers=auth(patient)).get_json()['total'] == 0


def test_exif_stripped_and_random_name(client, patient, app):
    buf = io.BytesIO()
    img = Image.new('RGB', (64, 64), 'red')
    exif = Image.Exif(); exif[0x010E] = 'SECRET-GPS-DESC'
    img.save(buf, 'JPEG', exif=exif)
    assert b'SECRET-GPS-DESC' in buf.getvalue()
    r = upload(client, patient, buf.getvalue(), '../../etc/passwd.jpg', 'image/jpeg')
    assert r.status_code == 201
    files = os.listdir(app.config['UPLOAD_FOLDER'])
    assert len(files) == 1 and '..' not in files[0] and files[0].endswith('.jpg')
    assert b'SECRET-GPS-DESC' not in open(os.path.join(app.config['UPLOAD_FOLDER'], files[0]), 'rb').read()
    assert 'image_path' not in r.get_json()['scan']


def test_image_access_control(client, patient, scan_id):
    ok = client.get('/api/scan/results/%s/image' % scan_id, headers=auth(patient))
    assert ok.status_code == 200 and ok.mimetype == 'image/png'
    assert client.get('/api/scan/results/%s/image' % scan_id).status_code == 401
    other = client.post('/api/auth/register', json={'name': 'Other', 'email': 'o@o.co', 'password': 'Password1', 'confirm_password': 'Password1', 'role': 'user', 'accepted_terms': True}).get_json()['token']
    assert client.get('/api/scan/results/%s/image' % scan_id, headers=auth(other)).status_code == 404
    assert client.get('/api/scan/results/%s' % scan_id, headers=auth(other)).status_code == 404
