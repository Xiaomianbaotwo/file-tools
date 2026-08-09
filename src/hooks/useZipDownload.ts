import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useStore } from '../store/useStore';

export function useZipDownload() {
  const files = useStore(s => s.files);
  const doneFiles = files.filter(f => f.status === 'done' && f.resultBlob);

  const downloadAllAsZip = async () => {
    if (doneFiles.length <= 1) return;
    const zip = new JSZip();
    for (const f of doneFiles) {
      const ext = f.targetFormat;
      const name = f.file.name.replace(/\.[^/.]+$/, '') + '.' + ext;
      zip.file(name, f.resultBlob!);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `converted_${new Date().toISOString().slice(0,10)}.zip`);
  };

  const downloadAllSequentially = () => {
    doneFiles.forEach((f, i) => {
      setTimeout(() => {
        const ext = f.targetFormat;
        const name = f.file.name.replace(/\.[^/.]+$/, '') + '.' + ext;
        saveAs(f.resultBlob!, name);
      }, i * 300);
    });
  };

  return { downloadAllAsZip, downloadAllSequentially };
}