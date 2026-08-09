import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { createConversionWorker } from '../utils/workerBridge';

export function useFileConverter() {
  const updateFileStatus = useStore(s => s.updateFileStatus);

  const convertSingle = useCallback(async (fileId: string) => {
    const fileItem = useStore.getState().files.find(f => f.id === fileId);
    if (!fileItem) return;
    updateFileStatus(fileId, 'converting', 0);

    try {
      const worker = createConversionWorker();
      const arrayBuf = await fileItem.file.arrayBuffer();

      // 向 Worker 传递用户自定义的输出尺寸
      worker.postMessage({
        type: 'convert',
        payload: {
          fileId,
          data: arrayBuf,
          originalName: fileItem.file.name,
          targetFormat: fileItem.targetFormat,
          quality: fileItem.quality,
          outputWidth: fileItem.outputWidth,     // 新增
          outputHeight: fileItem.outputHeight,   // 新增
        },
      });

      worker.onmessage = (e) => {
        const { type, fileId: msgId, progress, blob, mimeType, error } = e.data;
        if (msgId !== fileId) return;
        if (type === 'progress') {
          updateFileStatus(fileId, 'converting', progress);
        } else if (type === 'done') {
          const resultBlob = new Blob([blob], { type: mimeType || 'application/octet-stream' });
          updateFileStatus(fileId, 'done', 100, resultBlob);
          worker.terminate();
        } else if (type === 'error') {
          updateFileStatus(fileId, 'error', 0, null, error);
          worker.terminate();
        }
      };
    } catch (err: any) {
      updateFileStatus(fileId, 'error', 0, null, err.message);
    }
  }, []);

  const convertAll = useCallback(async () => {
    const pending = useStore.getState().files.filter(f => f.status === 'pending' || f.status === 'error');
    for (const item of pending) {
      await convertSingle(item.id);
    }
  }, [convertSingle]);

  return { convertSingle, convertAll };
}