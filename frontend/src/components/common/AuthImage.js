import React, { useEffect, useState } from 'react';
import { FiCamera, FiAlertCircle } from 'react-icons/fi';
import { scanService } from '../../services/api';


const AuthImage = ({ scanId, alt, className = '', hasImage = true }) => {
  const [src, setSrc] = useState(null);
  const [state, setState] = useState(hasImage ? 'loading' : 'none');

  useEffect(() => {
    if (!scanId || !hasImage) { setState('none'); return undefined; }
    let url; let cancelled = false;
    setState('loading');
    scanService.getImageBlob(scanId)
      .then((res) => { if (cancelled) return; url = URL.createObjectURL(res.data); setSrc(url); setState('ok'); })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [scanId, hasImage]);

  if (state === 'ok') return <img src={src} alt={alt} className={className} />;
  return (
    <div className={`flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 text-gray-400 ${className}`} role={state === 'error' ? 'alert' : 'status'}>
      <div className="text-center p-4">
        {state === 'error' ? <FiAlertCircle className="text-3xl mx-auto mb-2" aria-hidden="true" /> : <FiCamera className="text-3xl mx-auto mb-2" aria-hidden="true" />}
        <p className="text-xs">{state === 'loading' ? 'Loading image…' : state === 'error' ? 'Image unavailable' : 'No image'}</p>
      </div>
    </div>
  );
};

export default AuthImage;
