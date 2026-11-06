
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import TypeDecorator, Text
from sqlalchemy.dialects.mysql import LONGTEXT

_fernet = None


def _build_fernet():
    key = os.getenv('DATA_ENCRYPTION_KEY', '').strip()
    if not key:
        secret = os.getenv('SECRET_KEY', 'dev-secret-key').encode()
        key = base64.urlsafe_b64encode(hashlib.sha256(b'dermascan-data:' + secret).digest()).decode()
    return Fernet(key.encode())


def get_fernet():
    global _fernet
    if _fernet is None:
        _fernet = _build_fernet()
    return _fernet


def reset_fernet():
    """Used by tests / after config changes."""
    global _fernet
    _fernet = None


def encrypt_text(value):
    return get_fernet().encrypt(value.encode('utf-8')).decode('ascii')


def decrypt_text(token):
    try:
        return get_fernet().decrypt(token.encode('ascii')).decode('utf-8')
    except InvalidToken as exc:
        raise ValueError('Unable to decrypt stored data - is DATA_ENCRYPTION_KEY correct?') from exc


class EncryptedText(TypeDecorator):
    """TEXT column transparently encrypted at rest."""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'mysql':
            return dialect.type_descriptor(LONGTEXT())
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        return None if value is None else encrypt_text(value)

    def process_result_value(self, value, dialect):
        return None if value is None else decrypt_text(value)
