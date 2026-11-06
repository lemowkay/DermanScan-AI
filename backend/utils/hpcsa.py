"""HPCSA (Health Professions Council of South Africa) registration handling.

IMPORTANT - what this does and does not do
------------------------------------------
* It validates the FORMAT of a registration number (e.g. "MP 0729515":
  a 2-3 letter profession prefix followed by digits). A well-formed number
  is NOT proof that the person is registered.
* HPCSA publishes registration status through its public *iRegister*
  lookup (www.hpcsa.co.za). No documented public API was found, so the
  number is never auto-trusted: every doctor account stays `pending` until an
  administrator checks iRegister and approves it (see routes/admin.py).
.
"""
import os
import re

HPCSA_RE = re.compile(r'^[A-Z]{2,3}\d{5,8}$')
PRACTICE_RE = re.compile(r'^[A-Za-z0-9\-/ ]{3,20}$')
IREGISTER_URL = 'https://www.hpcsa.co.za'


def normalize_hpcsa(value):
    """'mp 0729515' / 'MP-0729515' -> 'MP0729515'."""
    return re.sub(r'[\s\-]+', '', (value or '')).upper()


def is_valid_hpcsa_format(normalized):
    return bool(HPCSA_RE.match(normalized or ''))


def is_valid_practice_number(value):
    return bool(PRACTICE_RE.match(value or ''))


class LookupResult:
    def __init__(self, status, detail=''):
        self.status = status      # 'verified' | 'not_found' | 'unavailable'
        self.detail = detail


class HpcsaVerifier:
    """Extension point for an official HPCSA verification service."""

    def lookup(self, hpcsa_number, full_name):
        return LookupResult('unavailable', 'No automatic HPCSA lookup is configured; manual review required.')


def get_verifier():
    # Only the manual (null) provider ships. Add real providers here.
    provider = os.getenv('HPCSA_VERIFY_PROVIDER', 'none').lower()
    if provider not in ('none', ''):
        raise RuntimeError('HPCSA_VERIFY_PROVIDER=%s is not implemented. See utils/hpcsa.py.' % provider)
    return HpcsaVerifier()
