
import io
import json
import os

import numpy as np
from PIL import Image

MIN_CONFIDENCE = float(os.getenv('MIN_CONFIDENCE', '80'))     # percent (cautious default)
DEMO_VERSION = 'demo-placeholder'

# Display name, severity bucket, description, typical signs, general guidance.
# General information only - never a diagnosis. Items must not contain commas.
CLASS_INFO = {
    'clear_skin': ('Clear skin', 'Benign', 'No obvious skin condition was detected in this image.',
                   ['No visible lesion or rash detected'],
                   ['Keep using sunscreen SPF 30+ daily', 'Moisturise and keep skin clean',
                    'Re-scan or see a doctor if you notice a new or changing spot']),
    'pimple': ('Acne / pimple', 'Mild', 'Acne forms when hair follicles block with oil and dead skin, causing pimples, blackheads or inflamed spots.',
               ['Red bumps or whiteheads', 'Blackheads', 'Oily skin', 'Tender inflamed spots'],
               ['Wash gently twice daily and avoid picking', 'Over-the-counter benzoyl peroxide or salicylic acid may help',
                'See a doctor if acne is painful or scarring or not improving after 6-8 weeks']),
    'boil': ('Boil (skin abscess)', 'Moderate', 'A boil is a painful pus-filled infection of a hair follicle, usually caused by bacteria.',
             ['Red painful lump', 'Swelling that grows over days', 'White or yellow pus point', 'Warmth around the lump'],
             ['Apply warm compresses and never squeeze or lance it yourself', 'See a doctor if it is large or on the face or spine or if you have fever',
              'Wash hands well to avoid spreading infection']),
    'cold_urticaria': ('Cold urticaria', 'Moderate', 'Cold urticaria is a type of hives that appears after skin is exposed to cold air, water or objects.',
                       ['Raised itchy welts after cold exposure', 'Redness and swelling', 'Welts fading within hours'],
                       ['Avoid sudden cold exposure and cold water swimming alone', 'An antihistamine may help (ask a pharmacist)',
                        'See a doctor to confirm the diagnosis; seek emergency care for breathing difficulty or faintness']),
    'papular_urticaria': ('Papular urticaria', 'Mild', 'Papular urticaria is an itchy reaction to insect bites (often fleas or mosquitoes), common in children.',
                          ['Clusters of itchy red bumps', 'Often on arms and legs', 'Scratch marks or crusts'],
                          ['Avoid scratching and keep nails short', 'Treat bedding and pets for fleas if relevant',
                           'See a doctor if bites look infected or keep returning']),
    'eczema': ('Eczema (dermatitis)', 'Mild', 'Eczema is a long-term condition that makes skin dry, itchy, red and inflamed.',
               ['Dry scaly patches', 'Intense itching', 'Redness', 'Small blisters or cracked skin'],
               ['Moisturise several times a day with a fragrance-free emollient', 'Avoid known triggers such as harsh soaps',
                'See a doctor for prescription creams if it is widespread or not improving']),
    'herpes': ('Herpes (viral blisters)', 'Moderate', 'Herpes simplex is a viral infection that causes clusters of painful blisters, commonly around the mouth or genitals.',
               ['Tingling or burning before blisters appear', 'Clusters of small fluid-filled blisters', 'Crusting as it heals'],
               ['See a doctor promptly; antiviral treatment works best when started early', 'Avoid touching the sores and avoid close contact while blisters are present',
                'Seek urgent care if blisters are near the eyes']),
    'impetigo': ('Impetigo', 'Moderate', 'Impetigo is a contagious bacterial skin infection, common in children, causing sores and honey-coloured crusts.',
                 ['Red sores that burst and crust', 'Honey-coloured crusts', 'Often around nose and mouth'],
                 ['See a doctor: it usually needs an antibiotic cream or tablets', 'Keep sores covered and wash hands and towels separately',
                  'Keep the child home from school until treated as advised']),
    'cutaneous_lupus': ('Cutaneous lupus', 'Moderate', 'Cutaneous lupus is an autoimmune skin condition that causes red scaly patches, often made worse by sunlight.',
                        ['Red scaly ring-shaped or disc-shaped patches', 'Sun-sensitive rash', 'Possible scarring or colour change'],
                        ['See a doctor or dermatologist for a proper diagnosis', 'Protect skin from sun with SPF 50+ and clothing',
                         'Mention any joint pain fatigue or fever to your doctor']),
    'dermatofibroma': ('Dermatofibroma', 'Benign', 'A dermatofibroma is a common harmless firm skin nodule, often on the legs.',
                       ['Small firm round bump', 'Brown or pink colour', 'Dimples when pinched'],
                       ['Usually needs no treatment', 'See a doctor if it grows quickly bleeds or changes appearance',
                        'A doctor can confirm it is not something else']),
    'nonmelanoma_skin_cancer': ('Possible non-melanoma skin cancer', 'Moderate', 'Non-melanoma skin cancers (such as basal cell and squamous cell carcinoma) are common, usually slow-growing and treatable when found early.',
                                ['Pearly or waxy bump', 'Scaly or crusted sore that does not heal', 'Bleeding spot', 'A changing mole or spot'],
                                ['See a doctor or dermatologist promptly for examination', 'Avoid sun exposure and use SPF 30+ daily',
                                 'Only a doctor can diagnose skin cancer; this tool cannot']),
    'periodontal_abscess': ('Dental / gum abscess', 'Moderate', 'This looks like a swelling in the mouth, which may be a dental or gum infection rather than a skin condition.',
                            ['Swollen red gum', 'Pus or bad taste', 'Tooth or jaw pain'],
                            ['See a dentist as soon as possible; abscesses need treatment', 'Rinse with warm salt water for comfort',
                             'Go to emergency care for facial swelling fever or trouble swallowing or breathing']),
}

# Legacy descriptions (used by the demo placeholder)
DESCRIPTIONS = {
    'Actinic Keratosis': 'Actinic keratosis (AK) is a rough, scaly patch on the skin that develops from years of exposure to the sun.',
}

UNCERTAIN = ('Uncertain result', 'Unknown',
             'The model was not confident enough to name a condition for this image.',
             ['No condition could be named with enough confidence'],
             ['Try a clearer well-lit close-up photo', 'See a doctor if the area is painful changing or worrying you',
              'This tool cannot rule anything out'])


def _slug(name):
    return str(name).strip().lower().replace(' ', '_').replace('-', '_')


def info_for(label):
    return CLASS_INFO.get(_slug(label))


def describe(disease):
    """Description for a stored disease_name (display names OR demo names)."""
    for v in list(CLASS_INFO.values()) + [UNCERTAIN]:
        if v[0] == disease:
            return v[2]
    return DESCRIPTIONS.get(disease, '')


class SkinDiseaseModel:
    def __init__(self, model_path=None):
        self.model = None
        self.model_path = model_path
        self.class_names = []
        self.img_size = 224
        self.version = DEMO_VERSION
        self.metadata = {}

    # ----------------------------------------------------------- loading
    def _find_model_file(self):
        if not self.model_path:
            return None
        base = os.path.splitext(self.model_path)[0]
        for ext in ('.keras', '.h5'):
            if os.path.isfile(base + ext):
                return base + ext
        return None

    def load_model(self):
        path = self._find_model_file()
        if not path:
            return
        folder = os.path.dirname(path)
        try:
            self.class_names = json.load(open(os.path.join(folder, 'class_names.json'), encoding='utf-8'))
        except (OSError, ValueError):
            print('[model] class_names.json missing next to %s. Retrain with training/train.py. Using DEMO placeholder.' % path)
            return
        try:
            self.metadata = json.load(open(os.path.join(folder, 'training_metadata.json'), encoding='utf-8'))
        except (OSError, ValueError):
            self.metadata = {}
        try:
            import tensorflow as tf  # optional dependency
            self.model = tf.keras.models.load_model(path, compile=False)
            self.img_size = int(self.model.input_shape[1] or 224)
        except Exception as exc:  # ImportError, corrupt file, ...
            print('[model] Could not load %s (%s). Using DEMO placeholder results.' % (path, exc))
            self.model = None
            return
        experimental = self.metadata.get('experimental', True)       # unknown history -> treat as experimental
        self.version = ('experimental:' if experimental else 'keras:') + os.path.basename(path)

    # ----------------------------------------------------------- inference
    def preprocess_image(self, image_bytes):
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB').resize((self.img_size, self.img_size))
        # Raw 0-255 pixels: rescaling is part of the saved model.
        return np.expand_dims(np.asarray(image, dtype='float32'), axis=0)

    def _probabilities(self, image_bytes):
        return np.asarray(self.model.predict(self.preprocess_image(image_bytes), verbose=0)[0], dtype='float64')

    def predict(self, image_bytes):
        if self.model is None:
            return {
                'disease_name': 'Actinic Keratosis', 'confidence_score': 94.2, 'severity': 'Mild',
                'symptoms': 'Rough, dry skin patches,Flat or slightly raised,Pink or brown coloration,Itching sensation',
                'recommendations': 'Apply broad-spectrum sunscreen SPF 30+ daily,Schedule dermatologist consultation within 30 days,'
                                   'Monitor lesion for changes in size or color,Consider cryotherapy or topical treatment',
                'model_version': self.version,
            }
        return self.result_from_probabilities(self._probabilities(image_bytes))

    def result_from_probabilities(self, probs):
        idx = int(np.argmax(probs))
        confidence = float(probs[idx] * 100)
        label = self.class_names[idx]
        info = info_for(label)
        if confidence < MIN_CONFIDENCE:
            info = UNCERTAIN
        if info is None:   # class the app has no wording for: stay generic, never invent medical text
            info = (label.replace('_', ' ').title(), 'Moderate', '', ['Skin changes'],
                    ['See a doctor for an assessment', 'This tool cannot give a diagnosis'])
        name, severity, _desc, symptoms, recs = info
        return {
            'disease_name': name, 'confidence_score': round(confidence, 1), 'severity': severity,
            'symptoms': ','.join(symptoms), 'recommendations': ','.join(recs), 'model_version': self.version,
        }


_instance = None


def get_model(model_path=None):
    global _instance
    if _instance is None:
        _instance = SkinDiseaseModel(model_path)
        _instance.load_model()
    return _instance


def reset_model():
    global _instance
    _instance = None
