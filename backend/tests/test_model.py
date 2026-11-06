import io
import json
import os

import numpy as np
import pytest
from PIL import Image

from utils import model as m
from utils.model import CLASS_INFO, SkinDiseaseModel, describe, info_for
from .conftest import auth, make_image, upload


def stub(classes):
    sm = SkinDiseaseModel()
    sm.class_names = classes
    sm.version = 'experimental:test.keras'
    return sm


def test_every_trained_class_has_wording():
    for c in ['boil', 'clear_skin', 'cold_urticaria', 'cutaneous_lupus', 'dermatofibroma', 'eczema', 'herpes',
              'impetigo', 'nonmelanoma_skin_cancer', 'papular_urticaria', 'periodontal_abscess', 'pimple']:
        name, sev, desc, symptoms, recs = info_for(c)
        assert name and sev in ('Benign', 'Mild', 'Moderate', 'Severe') and desc and symptoms and recs
        assert all(',' not in x for x in symptoms + recs)           # joined with commas when stored
        assert describe(name) == desc


def test_confident_prediction_maps_to_class_info():
    sm = stub(['eczema', 'boil'])
    r = sm.result_from_probabilities(np.array([0.9, 0.1]))
    assert r['disease_name'] == 'Eczema (dermatitis)' and r['confidence_score'] == 90.0 and r['model_version'].startswith('experimental')
    assert 'Dry scaly patches' in r['symptoms']


def test_low_confidence_is_reported_as_uncertain_not_a_guess():
    sm = stub(['eczema', 'boil', 'herpes'])
    r = sm.result_from_probabilities(np.array([0.40, 0.35, 0.25]))
    assert r['disease_name'] == 'Uncertain result' and r['severity'] == 'Unknown'
    assert 'cannot rule anything out' in r['recommendations']


def test_unknown_class_gets_generic_safe_wording():
    r = stub(['mystery_rash']).result_from_probabilities(np.array([0.99]))
    assert r['disease_name'] == 'Mystery Rash' and 'doctor' in r['recommendations'].lower()


def test_demo_when_no_model_file(tmp_path):
    sm = SkinDiseaseModel(str(tmp_path / 'none.keras')); sm.load_model()
    assert sm.model is None and sm.predict(b'x')['model_version'] == 'demo-placeholder'


def test_experimental_model_is_flagged_in_scan_payload(client, patient, monkeypatch):
    class Fake(SkinDiseaseModel):
        def __init__(self):
            super().__init__(); self.model = object(); self.class_names = ['pimple']; self.version = 'experimental:x.keras'
        def _probabilities(self, b): return np.array([0.97])
    monkeypatch.setattr(m, '_instance', Fake())
    r = upload(client, patient)
    scan = r.get_json()['scan']
    assert scan['disease_name'] == 'Acne / pimple' and scan['is_demo'] is True and scan['description']


def test_jfif_upload_accepted_but_must_be_real_jpeg(client, patient):
    jpeg = make_image('JPEG')
    assert upload(client, patient, jpeg, 'Boil.jfif', 'image/jpeg').status_code == 201
    assert upload(client, patient, jpeg, 'Boil.jfif', '').status_code == 201                       # browsers that send no MIME
    assert upload(client, patient, b'MZ\x90\x00' * 50, 'evil.jfif', 'image/jpeg').status_code == 415   # disguised exe
    assert upload(client, patient, make_image('PNG'), 'x.jfif', 'image/jpeg').status_code == 415      # PNG pretending to be jfif


@pytest.mark.skipif(not os.environ.get('TEST_REAL_KERAS_MODEL'), reason='needs TensorFlow + a trained model folder')
def test_real_keras_model_loads_and_predicts():
    sm = SkinDiseaseModel(os.path.join(os.environ['TEST_REAL_KERAS_MODEL'], 'skin_disease_model.keras')); sm.load_model()
    assert sm.model is not None and sm.version.startswith('experimental')
    buf = io.BytesIO(); Image.new('RGB', (300, 300), (190, 120, 110)).save(buf, 'JPEG')
    r = sm.predict(buf.getvalue())
    assert r['disease_name'] and 0 <= r['confidence_score'] <= 100
