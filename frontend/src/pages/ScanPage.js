import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCamera, FiX, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import Webcam from 'react-webcam';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { ImageDropzone, ImageFileList, useImageFiles } from '../components/common/ImageUpload';
import { scanService, getErrorMessage } from '../services/api';
import { formatBytes } from '../utils/fileValidation';

const dataUrlToFile = (dataUrl, name) => {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
};

const ScanPage = () => {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const replaceInputRef = useRef(null);
  const { items, addFiles, remove, clear, validItems, checking } = useImageFiles({ multiple: false });
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitError, setSubmitError] = useState('');

  const selected = validItems[0];

  const handleCapture = async () => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) { setCameraError('Could not capture a photo. Please try again.'); return; }
    setShowCamera(false);
    await addFiles([dataUrlToFile(shot, 'camera-capture.jpg')], []);
  };

  const handleAnalyze = async () => {
    if (!selected || analyzing) return;
    setAnalyzing(true);
    setSubmitError('');
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append('image', selected.file);
      const res = await scanService.uploadImage(fd, (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); });
      navigate(`/results/${res.data.scan.scan_id}`);
    } catch (err) {
      // The server repeats validation; show exactly what it says.
      setSubmitError(getErrorMessage(err, 'Upload failed. Please try again.'));
      setAnalyzing(false);
    }
  };

  const resetImage = () => { clear(); setSubmitError(''); };
  const invalidItems = items.filter((i) => i.status !== 'valid');

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900">
      <Navbar />
      <div className="pt-20 lg:pt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Skin Analysis</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Upload a photo of your skin condition for AI-powered analysis</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {showCamera ? (
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <div className="relative rounded-2xl overflow-hidden mb-4">
                  <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="w-full rounded-2xl"
                    videoConstraints={{ facingMode: 'environment' }}
                    onUserMediaError={() => setCameraError('Camera access was denied or no camera was found. Please upload a file instead.')} />
                </div>
                {cameraError && <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center mb-3">{cameraError}</p>}
                <div className="flex items-center justify-center space-x-4">
                  <button type="button" onClick={() => setShowCamera(false)} className="btn-secondary py-3 px-6 flex items-center space-x-2">
                    <FiX aria-hidden="true" /><span>Cancel</span>
                  </button>
                  <button type="button" onClick={handleCapture} className="btn-primary py-3 px-8 flex items-center space-x-2">
                    <FiCamera aria-hidden="true" /><span>Capture</span>
                  </button>
                </div>
              </div>
            ) : !selected ? (
              <div className="space-y-6">
                <ImageDropzone id="skin-image" label="Upload your skin image" onFiles={addFiles} disabled={checking} />
                {checking && <p role="status" className="text-sm text-gray-500 text-center">Checking file…</p>}
                <div aria-live="polite"><ImageFileList items={invalidItems} onRemove={remove} /></div>

                <div className="flex items-center justify-center">
                  <div className="flex items-center space-x-4">
                    <div className="h-px w-16 bg-gray-200 dark:bg-gray-700" />
                    <span className="text-sm text-gray-400">or</span>
                    <div className="h-px w-16 bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>

                <button type="button" onClick={() => { setCameraError(''); setShowCamera(true); }}
                  className="w-full flex items-center justify-center space-x-3 p-5 sm:p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-lg transition-all group">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-100 to-primary-100 dark:from-sky-900/30 dark:to-primary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FiCamera className="text-2xl text-primary-500" aria-hidden="true" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">Use Camera</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Take a photo with your device camera</p>
                  </div>
                </button>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 flex items-start space-x-3">
                  <FiAlertCircle className="text-blue-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Image Guidelines</p>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                      <li>• Ensure good lighting conditions</li>
                      <li>• Focus on the affected area</li>
                      <li>• Avoid blurry or out-of-focus images</li>
                      <li>• Remove makeup or creams if possible</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6 lg:p-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="input-label mb-3">Selected image</p>
                    <div className="relative rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-700/50">
                      <img src={selected.previewUrl} alt={`Preview of ${selected.name}`} className="w-full h-64 sm:h-72 object-cover" />
                      <button type="button" onClick={resetImage} disabled={analyzing} aria-label="Remove image"
                        className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                        <FiX aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between">
                    <div>
                      <p className="input-label">Image Details</p>
                      <dl className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        {[['File name', selected.name], ['File size', formatBytes(selected.size)], ['Type', selected.file.type]].map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-3 text-sm">
                            <dt className="text-gray-500 dark:text-gray-400">{k}:</dt>
                            <dd className="font-medium text-gray-900 dark:text-white truncate">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                        Your image is checked again on our server and stored privately. Location and camera metadata are removed.
                      </p>
                    </div>
                    <div className="space-y-3 mt-4">
                      {submitError && (
                        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                          <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{submitError}</span>
                        </div>
                      )}
                      <button type="button" onClick={handleAnalyze} disabled={analyzing} className="btn-primary w-full py-4 text-lg flex items-center justify-center space-x-3">
                        {analyzing ? <><FiRefreshCw className="animate-spin" aria-hidden="true" /><span>Analyzing…</span></> : <><FiCamera aria-hidden="true" /><span>Analyze Image</span></>}
                      </button>
                      <button type="button" onClick={() => replaceInputRef.current?.click()} disabled={analyzing} className="btn-secondary w-full py-3">
                        Replace Image
                      </button>
                      <input ref={replaceInputRef} type="file" accept=".png,.jpg,.jpeg,.jfif,.webp,image/png,image/jpeg,image/webp" className="hidden" tabIndex={-1} aria-hidden="true"
                        onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) { setSubmitError(''); addFiles(f, []); } }} />
                    </div>
                  </div>
                </div>
                <div aria-live="polite"><ImageFileList items={invalidItems} onRemove={remove} /></div>
              </div>
            )}
          </motion.div>

          {analyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status" className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <FiRefreshCw className="text-primary-500 text-xl animate-spin" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden" aria-hidden="true">
                    <div className="h-full gradient-primary rounded-full transition-all duration-300" style={{ width: `${Math.max(progress, 8)}%` }} />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {progress < 100 ? `Uploading securely… ${progress}%` : 'Processing your image…'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              By uploading an image, you agree to our{' '}
              <a href="#privacy" className="text-primary-600 dark:text-primary-400 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#privacy" className="text-primary-600 dark:text-primary-400 hover:underline">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ScanPage;
