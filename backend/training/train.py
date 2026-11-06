"""Train the skin-condition CNN.

    python training/train.py                       # MobileNetV2 transfer learning (recommended)
    python training/train.py --epochs 40 --fine-tune
    python training/train.py --arch small --weights none   # tiny CNN, no download (smoke tests)

Reads   training/dataset/<class_name>/*.jpg   (see prepare_dataset.py)
Writes  models/skin_disease_model.keras, models/class_names.json, models/training_metadata.json

HONESTY BUILT IN
* With very few images per class the network memorises its training photos
  (and any watermarks in them). The script detects this, says so, and marks the
  model "experimental" so the app labels every result accordingly.
* Accuracy is only reported on images the model never trained on. If there are
  not enough images to hold any back, NO accuracy is claimed.
* The preprocessing is baked into the saved model (inputs are raw 0-255 pixels)
  so training and the web app can never disagree.
"""
import argparse
import datetime
import json
import os
import random
import sys
from collections import Counter

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
EXTS = ('.jpg', '.jpeg', '.jfif', '.png', '.webp', '.bmp')
MIN_PER_CLASS_FOR_VAL = 5          # need at least this many images to hold some back
RECOMMENDED_PER_CLASS = 200


def parse_args():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--data', default=os.path.join(HERE, 'dataset'))
    ap.add_argument('--out', default=os.path.join(BACKEND, 'models'))
    ap.add_argument('--arch', choices=['mobilenetv2', 'vgg16', 'small'], default='mobilenetv2')
    ap.add_argument('--weights', default='imagenet',
                    help="'imagenet' (downloads pretrained weights on first use), 'none', or a path to a weights .h5 file")
    ap.add_argument('--img-size', type=int, default=224)
    ap.add_argument('--epochs', type=int, default=30)
    ap.add_argument('--batch', type=int, default=16)
    ap.add_argument('--lr', type=float, default=1e-3)
    ap.add_argument('--val-split', type=float, default=0.2)
    ap.add_argument('--fine-tune', action='store_true', help='after the head is trained, unfreeze the top of the backbone')
    ap.add_argument('--seed', type=int, default=42)
    return ap.parse_args()


def scan_dataset(root):
    if not os.path.isdir(root):
        sys.exit('Dataset folder not found: %s\nRun training/prepare_dataset.py first.' % root)
    classes = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)))
    files = {c: sorted(os.path.join(root, c, f) for f in os.listdir(os.path.join(root, c)) if f.lower().endswith(EXTS)) for c in classes}
    files = {c: v for c, v in files.items() if v}
    if len(files) < 2:
        sys.exit('Need at least 2 classes with images in %s' % root)
    return sorted(files), files


def stratified_split(files, classes, val_split, seed):
    rnd = random.Random(seed)
    train, val = [], []
    for ci, c in enumerate(classes):
        items = files[c][:]
        rnd.shuffle(items)
        n_val = int(round(len(items) * val_split)) if len(items) >= MIN_PER_CLASS_FOR_VAL else 0
        n_val = min(n_val, len(items) - 1)
        val += [(p, ci) for p in items[:n_val]]
        train += [(p, ci) for p in items[n_val:]]
    return train, val


def build_dataset(pairs, size, batch, training, tf, seed):
    paths = [p for p, _ in pairs]
    labels = [l for _, l in pairs]

    def load(path, label):
        img = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
        img = tf.image.resize(img, (size, size))
        return tf.cast(img, tf.float32), label          # raw 0-255; model rescales internally

    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    if training:
        ds = ds.shuffle(len(paths), seed=seed, reshuffle_each_iteration=True)
    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE).batch(batch)
    return ds.prefetch(tf.data.AUTOTUNE)


def build_model(tf, n_classes, size, arch, weights, lr):
    from tensorflow.keras import layers, models
    inputs = layers.Input((size, size, 3))
    x = layers.RandomFlip('horizontal_and_vertical')(inputs)         # active only while training
    x = layers.RandomRotation(0.15)(x)
    x = layers.RandomZoom(0.2)(x)
    x = layers.RandomTranslation(0.1, 0.1)(x)
    x = layers.RandomContrast(0.2)(x)
    x = layers.RandomBrightness(0.2, value_range=(0, 255))(x)
    backbone = None
    w = None if weights == 'none' else weights
    if arch == 'mobilenetv2':
        x = layers.Rescaling(1 / 127.5, offset=-1)(x)                # what MobileNetV2 expects
        backbone = tf.keras.applications.MobileNetV2(input_shape=(size, size, 3), include_top=False, weights=w)
        backbone.trainable = False
        x = backbone(x, training=False)
        x = layers.GlobalAveragePooling2D()(x)
    elif arch == 'vgg16':
        # VGG16 expects BGR order minus the ImageNet mean. A fixed 1x1 convolution does exactly
        # that, so the preprocessing lives inside the saved model (no custom code / Lambda layer).
        pre = layers.Conv2D(3, 1, name='caffe_preprocess', trainable=False)
        x = pre(x)
        kernel = np.zeros((1, 1, 3, 3), dtype='float32')
        for out_ch in range(3):
            kernel[0, 0, 2 - out_ch, out_ch] = 1.0
        pre.set_weights([kernel, -np.array([103.939, 116.779, 123.68], dtype='float32')])
        backbone = tf.keras.applications.VGG16(input_shape=(size, size, 3), include_top=False, weights=w)
        backbone.trainable = False
        x = backbone(x, training=False)
        x = layers.GlobalAveragePooling2D()(x)
    else:
        x = layers.Rescaling(1 / 255.0)(x)
        for f in (32, 64, 128):
            x = layers.Conv2D(f, 3, padding='same', activation='relu')(x)
            x = layers.MaxPooling2D()(x)
        x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(n_classes, activation='softmax')(x)
    model = models.Model(inputs, outputs)
    model.compile(optimizer=tf.keras.optimizers.Adam(lr), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    return model, backbone


def evaluate(model, ds, classes):
    y_true, y_pred = [], []
    for xb, yb in ds:
        y_pred += list(np.argmax(model.predict(xb, verbose=0), axis=1))
        y_true += list(yb.numpy())
    n = len(classes)
    cm = np.zeros((n, n), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[t][p] += 1
    acc = float(np.trace(cm) / max(cm.sum(), 1))
    print('\nPer-class results on images the model never trained on:')
    print('%-28s %9s %9s %8s' % ('class', 'precision', 'recall', 'support'))
    for i, c in enumerate(classes):
        tp, fp, fn = cm[i][i], cm[:, i].sum() - cm[i][i], cm[i].sum() - cm[i][i]
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        print('%-28s %9.2f %9.2f %8d' % (c, prec, rec, cm[i].sum()))
    return acc, cm.tolist()


def main():
    a = parse_args()
    random.seed(a.seed); np.random.seed(a.seed)
    try:
        import tensorflow as tf
    except ImportError:
        sys.exit('TensorFlow is not installed. Run:  pip install -r requirements-ml.txt   (Python 3.9-3.12)')
    tf.keras.utils.set_random_seed(a.seed)

    classes, files = scan_dataset(a.data)
    counts = {c: len(files[c]) for c in classes}
    smallest = min(counts.values())
    print('\nDataset: %d classes, %d images' % (len(classes), sum(counts.values())))
    for c in classes:
        print('  %-28s %5d' % (c, counts[c]))

    tiny = smallest < RECOMMENDED_PER_CLASS
    if tiny:
        bar = '!' * 78
        print('\n%s\nWARNING: the smallest class has only %d image(s). Aim for %d+ per class.\n'
              'With this little data the model MEMORISES its photos (including watermarks and\n'
              'backgrounds) and will NOT reliably recognise new photos. The result will be saved\n'
              'as EXPERIMENTAL and the app will label it that way. Do not use it for health decisions.\n%s'
              % (bar, smallest, RECOMMENDED_PER_CLASS, bar))

    train, val = stratified_split(files, classes, a.val_split, a.seed)
    print('\nTrain images: %d   Held-out validation images: %d' % (len(train), len(val)))
    if not val:
        print('No images could be held back (need >= %d per class), so NO real accuracy can be measured.' % MIN_PER_CLASS_FOR_VAL)

    train_ds = build_dataset(train, a.img_size, a.batch, True, tf, a.seed)
    val_ds = build_dataset(val, a.img_size, a.batch, False, tf, a.seed) if val else None

    # With tiny datasets, repeat the (augmented) data so each epoch has enough steps to learn from.
    steps = max(1, len(train) // a.batch)
    repeat = max(1, int(np.ceil(64 / max(len(train), 1)))) if len(train) < 64 else 1
    if repeat > 1:
        train_ds = train_ds.repeat(repeat)

    cnt = Counter(l for _, l in train)
    class_weight = {i: len(train) / (len(classes) * cnt[i]) for i in cnt}
    model, backbone = build_model(tf, len(classes), a.img_size, a.arch, a.weights, a.lr)

    monitor = 'val_loss' if val_ds is not None else 'loss'
    cb = [tf.keras.callbacks.EarlyStopping(monitor=monitor, patience=6, restore_best_weights=True),
          tf.keras.callbacks.ReduceLROnPlateau(monitor=monitor, factor=0.5, patience=3)]
    model.fit(train_ds, validation_data=val_ds, epochs=a.epochs, class_weight=class_weight, callbacks=cb, verbose=2)

    if a.fine_tune and backbone is not None:
        print('\nFine-tuning the top of the backbone...')
        backbone.trainable = True
        for layer in backbone.layers[:-30]:
            layer.trainable = False
        model.compile(optimizer=tf.keras.optimizers.Adam(a.lr / 10), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
        model.fit(train_ds, validation_data=val_ds, epochs=max(5, a.epochs // 3), class_weight=class_weight, callbacks=cb, verbose=2)

    val_acc, cm = None, None
    if val_ds is not None:
        val_acc, cm = evaluate(model, val_ds, classes)
        print('\nHeld-out accuracy: %.1f%%  (on %d images)' % (val_acc * 100, len(val)))
    else:
        print('\n(Training-set accuracy would be meaningless here: the model has seen every image.)')

    os.makedirs(a.out, exist_ok=True)
    model_path = os.path.join(a.out, 'skin_disease_model.keras')
    model.save(model_path)
    json.dump(classes, open(os.path.join(a.out, 'class_names.json'), 'w'), indent=2)
    meta = {
        'trained_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'arch': a.arch, 'weights': a.weights,
        'img_size': a.img_size, 'epochs_requested': a.epochs, 'tensorflow': tf.__version__,
        'classes': classes, 'images_per_class': counts, 'train_images': len(train), 'val_images': len(val),
        'heldout_accuracy': val_acc, 'confusion_matrix': cm,
        'experimental': bool(tiny or not val),
        'note': 'experimental = too little data or no held-out evaluation; not clinically validated',
    }
    json.dump(meta, open(os.path.join(a.out, 'training_metadata.json'), 'w'), indent=2)
    print('\nSaved: %s\n       class_names.json, training_metadata.json\nRestart the backend to use the new model.' % model_path)


if __name__ == '__main__':
    main()
