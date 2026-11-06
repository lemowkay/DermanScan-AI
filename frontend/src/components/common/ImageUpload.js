import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiX, FiAlertCircle, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import {
  ACCEPT_ATTR, ALLOWED_TEXT, DROPZONE_ACCEPT, MAX_FILE_BYTES,
  formatBytes, messageForRejection, validateImageFile,
} from '../../utils/fileValidation';

let counter = 0;
const nextId = () => `f${Date.now()}-${counter++}`;


export const useImageFiles = ({ multiple = false, maxFiles = 1 } = {}) => {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => () => itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl)), []);

  const release = (list) => list.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));

  const addFiles = useCallback(async (accepted = [], rejections = []) => {
    const rejectedItems = rejections.map((r) => ({
      id: nextId(), name: r.file.name, size: r.file.size, status: 'invalid', message: messageForRejection(r),
    }));
    let incoming = accepted;
    if (!multiple) incoming = accepted.slice(0, 1);
    else {
      const room = Math.max(0, maxFiles - itemsRef.current.filter((i) => i.status !== 'invalid').length);
      incoming = accepted.slice(0, room);
    }
    const pending = incoming.map((file) => ({ id: nextId(), file, name: file.name, size: file.size, status: 'checking' }));

    setItems((prev) => {
      const base = multiple ? prev : [];
      if (!multiple) release(prev);
      return [...base, ...pending, ...rejectedItems];
    });

    await Promise.all(pending.map(async (p) => {
      const result = await validateImageFile(p.file);
      setItems((prev) => prev.map((i) => {
        if (i.id !== p.id) return i;
        return result.valid
          ? { ...i, status: 'valid', previewUrl: URL.createObjectURL(p.file) }
          : { ...i, status: 'invalid', message: result.message };
      }));
    }));
  }, [multiple, maxFiles]);

  const remove = useCallback((id) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clear = useCallback(() => { setItems((prev) => { release(prev); return []; }); }, []);

  return {
    items, addFiles, remove, clear,
    validItems: items.filter((i) => i.status === 'valid'),
    validFiles: items.filter((i) => i.status === 'valid').map((i) => i.file),
    checking: items.some((i) => i.status === 'checking'),
  };
};

export const ImageDropzone = ({ id, label, onFiles, multiple = false, maxFiles = 1, disabled = false, describedBy, compact = false }) => {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: onFiles,
    accept: DROPZONE_ACCEPT,
    multiple,
    maxFiles: multiple ? maxFiles : 1,
    maxSize: MAX_FILE_BYTES,
    disabled,
    noClick: true,       
    noKeyboard: true,
  });
  const hintId = `${id}-hint`;
  const inputProps = getInputProps({ id, accept: ACCEPT_ATTR, 'aria-describedby': [hintId, describedBy].filter(Boolean).join(' ') });

  return (
    <div
      {...getRootProps()}
      className={
        'relative border-2 border-dashed rounded-3xl text-center transition-all duration-300 ' +
        (compact ? 'p-6 ' : 'p-8 sm:p-12 lg:p-16 ') +
        (isDragActive
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.01]'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800') +
        (disabled ? ' opacity-60' : '')
      }
    >
      <input {...inputProps} />
      {!compact && (
        <div className={'w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary-100 to-sky-100 dark:from-primary-900/30 dark:to-sky-900/30 flex items-center justify-center mb-5 transition-transform ' + (isDragActive ? 'scale-110' : '')}>
          <FiUpload className="text-2xl sm:text-3xl text-primary-500" aria-hidden="true" />
        </div>
      )}
      <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">
        {isDragActive ? 'Drop your image here' : label}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">drag &amp; drop, or</p>
      <button type="button" onClick={open} disabled={disabled} className="btn-primary py-3 px-6 inline-flex items-center space-x-2">
        <FiUpload aria-hidden="true" />
        <span>Browse files</span>
      </button>
      <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        Accepted: {ALLOWED_TEXT} · Max {MAX_FILE_BYTES / (1024 * 1024)} MB{multiple ? ' per file' : ''}. Other file types are rejected.
      </p>
    </div>
  );
};

export const ImageFileList = ({ items, onRemove, onReplace, hideValid = false }) => {
  const shown = hideValid ? items.filter((i) => i.status !== 'valid') : items;
  if (shown.length === 0) return null;
  return (
    <ul className="space-y-3 mt-4" aria-label="Selected files">
      {shown.map((item) => (
        <li
          key={item.id}
          className={'flex items-center gap-3 p-3 rounded-xl border ' +
            (item.status === 'invalid'
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800')}
        >
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            {item.previewUrl ? <img src={item.previewUrl} alt={`Preview of ${item.name}`} className="w-full h-full object-cover" />
              : item.status === 'checking' ? <FiRefreshCw className="animate-spin text-gray-400" aria-hidden="true" />
              : <FiAlertCircle className="text-red-500 text-xl" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(item.size)}</p>
            {item.status === 'invalid' && (
              <p className="text-sm text-red-700 dark:text-red-400 mt-1 flex items-start gap-1" role="alert">
                <FiAlertCircle className="mt-0.5 flex-shrink-0" aria-hidden="true" /><span>{item.message}</span>
              </p>
            )}
            {item.status === 'valid' && (
              <p className="text-xs text-medical-700 dark:text-medical-400 mt-1 flex items-center gap-1">
                <FiCheckCircle aria-hidden="true" /> Ready to upload
              </p>
            )}
            {item.status === 'checking' && <p className="text-xs text-gray-500 mt-1" role="status">Checking file…</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onReplace && (
              <button type="button" onClick={onReplace} className="text-sm font-medium text-primary-600 dark:text-primary-400 px-2 py-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20">
                Replace
              </button>
            )}
            <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
              <FiX aria-hidden="true" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};
