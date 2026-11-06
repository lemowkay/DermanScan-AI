from .conftest import auth, register


def test_register_login_profile(client):
    assert register(client).status_code == 201
    r = client.post('/api/auth/login', json={'email': 'PAT@example.com', 'password': 'Password1', 'role': 'user'})
    assert r.status_code == 200
    tok = r.get_json()['token']
    p = client.get('/api/auth/profile', headers=auth(tok))
    assert p.status_code == 200 and p.get_json()['user']['role'] == 'user'


def test_register_validation(client):
    assert client.post('/api/auth/register', json={'name': 'A', 'email': 'bad', 'password': '123', 'accepted_terms': False}).status_code == 400
    assert register(client, password='short1').status_code == 400
    assert register(client, password='nodigitshere').status_code == 400
    assert client.post('/api/auth/register', json={'name': 'Pat', 'email': 'a@b.co', 'password': 'Password1', 'confirm_password': 'Password1'}).status_code == 400  # no consent
    assert register(client).status_code == 201
    assert register(client).status_code == 409


def test_cannot_self_register_as_admin(client):
    r = client.post('/api/auth/register', json={'name': 'Evil', 'email': 'e@e.co', 'password': 'Password1', 'confirm_password': 'Password1', 'accepted_terms': True, 'role': 'admin'})
    assert r.status_code == 400


def test_bad_login_and_rate_limit(client):
    register(client)
    r = client.post('/api/auth/login', json={'email': 'pat@example.com', 'password': 'wrong', 'role': 'user'})
    assert r.status_code == 401 and 'Incorrect' in r.get_json()['message']
    for _ in range(10):
        r = client.post('/api/auth/login', json={'email': 'pat@example.com', 'password': 'wrong', 'role': 'user'})
    assert r.status_code == 429


def test_protected_routes_need_token(client):
    assert client.get('/api/scan/history').status_code == 401
    assert client.get('/api/auth/profile', headers=auth('garbage')).status_code == 401


def test_password_reset_flow(client, app):
    register(client)
    client.post('/api/auth/forgot-password', json={'email': 'pat@example.com'})
    msg = app.extensions['outbox'][0]            # link is EMAILED, not returned by the API
    body = msg.get_body(preferencelist=('plain',)).get_content()
    token = body.split('token=')[1].split()[0]
    assert client.post('/api/auth/reset-password', json={'token': token, 'password': 'NewPass99'}).status_code == 200
    assert client.post('/api/auth/reset-password', json={'token': token, 'password': 'Another99'}).status_code == 400  # single use
    assert client.post('/api/auth/login', json={'email': 'pat@example.com', 'password': 'NewPass99', 'role': 'user'}).status_code == 200
    # unknown email gives same generic answer
    assert client.post('/api/auth/forgot-password', json={'email': 'nobody@x.co'}).status_code == 200


def test_reset_link_dev_fallback_when_mail_not_configured(client, app):
    app.config.update(MAIL_BACKEND='smtp')
    register(client)
    r = client.post('/api/auth/forgot-password', json={'email': 'pat@example.com'}).get_json()
    assert r['email_delivery'] == 'not_configured' and 'dev_reset_link' in r
