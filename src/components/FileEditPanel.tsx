import React, { useEffect, useState } from 'react';
import { FileItem } from '../types';
import { useStore } from '../store/useStore';
import { useLang } from '../context/LangContext';

interface Props {
  fileItem: FileItem;
}

const PRESET_RATIOS = [
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '1:1', ratio: 1 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '2:3', ratio: 2 / 3 },
  { label: '3:2', ratio: 3 / 2 },
];

export default function FileEditPanel({ fileItem }: Props) {
  const { messages: t } = useLang();
  const updateFileDetails = useStore(s => s.updateFileDetails);
  const [customName, setCustomName] = useState(fileItem.customName || fileItem.file.name.replace(/\.[^/.]+$/, ''));
  const [width, setWidth] = useState<number>(fileItem.outputWidth || fileItem.originalWidth || 0);
  const [height, setHeight] = useState<number>(fileItem.outputHeight || fileItem.originalHeight || 0);
  const [keepAspectRatio, setKeepAspectRatio] = useState(fileItem.keepAspectRatio ?? true);

  const origW = fileItem.originalWidth || 1;
  const origH = fileItem.originalHeight || 1;
  const maxW = origW * 100;
  const maxH = origH * 100;

  useEffect(() => {
    setCustomName(fileItem.customName || fileItem.file.name.replace(/\.[^/.]+$/, ''));
  }, [fileItem.customName, fileItem.file.name]);

  useEffect(() => {
    setWidth(fileItem.outputWidth || fileItem.originalWidth || 0);
    setHeight(fileItem.outputHeight || fileItem.originalHeight || 0);
  }, [fileItem.outputWidth, fileItem.outputHeight, fileItem.originalWidth, fileItem.originalHeight]);

  const handleNameBlur = () => {
    updateFileDetails(fileItem.id, { customName: customName.trim() || undefined });
  };

  const applySize = (newWidth: number, newHeight: number) => {
    const clampedW = Math.min(Math.max(1, newWidth), maxW);
    const clampedH = Math.min(Math.max(1, newHeight), maxH);
    setWidth(clampedW);
    setHeight(clampedH);
    updateFileDetails(fileItem.id, { outputWidth: clampedW, outputHeight: clampedH });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w = parseInt(e.target.value) || 1;
    if (keepAspectRatio) {
      const h = Math.round(w / (origW / origH));
      applySize(w, h);
    } else {
      applySize(w, height);
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseInt(e.target.value) || 1;
    if (keepAspectRatio) {
      const w = Math.round(h * (origW / origH));
      applySize(w, h);
    } else {
      applySize(width, h);
    }
  };

  const handlePreset = (ratio: number) => {
    const landscape = ratio >= 1;
    let newW: number, newH: number;
    if (landscape) {
      newH = origH;
      newW = Math.round(newH * ratio);
      if (newW > maxW) {
        newW = maxW;
        newH = Math.round(newW / ratio);
      }
    } else {
      newW = origW;
      newH = Math.round(newW / ratio);
      if (newH > maxH) {
        newH = maxH;
        newW = Math.round(newH * ratio);
      }
    }
    applySize(newW, newH);
    setKeepAspectRatio(true);
    updateFileDetails(fileItem.id, { keepAspectRatio: true });
  };

  const toggleAspectRatio = () => {
    const next = !keepAspectRatio;
    setKeepAspectRatio(next);
    updateFileDetails(fileItem.id, { keepAspectRatio: next });
  };

  const resetSize = () => {
    setWidth(origW);
    setHeight(origH);
    updateFileDetails(fileItem.id, { outputWidth: undefined, outputHeight: undefined, keepAspectRatio: false });
  };

  return (
    <div className="mt-3 p-4 bg-gray-50/80 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex flex-col items-center gap-2">
        {fileItem.previewUrl ? (
          <img src={fileItem.previewUrl} alt="preview" className="max-w-[200px] max-h-[150px] object-contain rounded shadow" />
        ) : (
          <div className="w-[200px] h-[150px] flex items-center justify-center bg-gray-200 rounded text-gray-400 text-sm">⏳ 预览加载中...</div>
        )}
        <span className="text-xs text-gray-500">原始尺寸：{fileItem.originalWidth || '-'} × {fileItem.originalHeight || '-'}</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600">{t.fileEdit.nameLabel}</label>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onBlur={handleNameBlur}
            className="w-full mt-1 border rounded px-2 py-1 text-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">
              {t.fileEdit.sizeLabel} <span className="text-gray-400 font-normal">{t.fileEdit.maxScale}</span>
            </span>
            <button onClick={resetSize} className="text-xs text-indigo-500 hover:underline">{t.fileEdit.resetSize}</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs">W</span>
              <input type="number" value={width || ''} onChange={handleWidthChange} min={1} max={maxW} className="w-20 border rounded px-1 py-0.5 text-xs text-center" />
            </div>
            <span className="text-xs">×</span>
            <div className="flex items-center gap-1">
              <span className="text-xs">H</span>
              <input type="number" value={height || ''} onChange={handleHeightChange} min={1} max={maxH} className="w-20 border rounded px-1 py-0.5 text-xs text-center" />
            </div>
            <button onClick={toggleAspectRatio} className={`text-xs px-2 py-0.5 rounded ${keepAspectRatio ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`} title="保持比例">🔗</button>
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-500">{t.fileEdit.presetRatios || '预设比例：'}</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {PRESET_RATIOS.map(pr => (
                <button key={pr.label} onClick={() => handlePreset(pr.ratio)} className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-indigo-50 hover:border-indigo-300 transition">{pr.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}