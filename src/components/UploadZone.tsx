import { useCallback, useState } from 'react';
import { useStore } from '../store/useStore';
import { Upload } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function UploadZone() {
  const addFiles = useStore((s) => s.addFiles);
  const [dragOver, setDragOver] = useState(false);
  const { messages: t } = useLang();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div
      className={`glass-panel p-8 text-center border-2 border-dashed transition-all duration-200 cursor-pointer ${
        dragOver
          ? 'border-purple-400 bg-gradient-to-br from-purple-100/60 to-purple-200/40 shadow-lg scale-[1.02]'
          : 'border-gray-300 hover:border-indigo-300'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
      <input
        id="fileInput"
        type="file"
        className="hidden"
        multiple
        accept="image/*,.heic,.heif,.tiff,.tif,.pdf,.svg,.psd,.tga,.raw,.cr2,.nef,.arw,.dng,.orf,.jxl"
        onChange={handleFileSelect}
      />
      <Upload className="mx-auto text-5xl text-indigo-400 mb-3" />
      <p className="text-lg font-medium text-gray-700">{t.upload.dragText}</p>
      <p className="text-sm text-gray-400 mt-1">{t.upload.clickHint}</p>
    </div>
  );
}