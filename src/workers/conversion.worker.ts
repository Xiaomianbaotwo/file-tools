// 转换 Worker —— 支持自定义输出尺寸
import { mapQualityToCanvas } from '../utils/qualityMapper';
import { formatRegistry } from '../utils/formatRegistry';

interface WorkerMessage {
  type: 'convert';
  payload: {
    fileId: string;
    data: ArrayBuffer;
    originalName: string;
    targetFormat: string;
    quality: number;
    outputWidth?: number;   // 新增
    outputHeight?: number;  // 新增
  };
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data;
  if (type !== 'convert') return;

  const { fileId, data, targetFormat, quality, outputWidth, outputHeight } = payload;

  try {
    self.postMessage({ type: 'progress', fileId, progress: 10 });

    // 1. 解码图片
    const blob = new Blob([data]);
    const imgBitmap = await createImageBitmap(blob);

    // 2. 确定目标尺寸
    const width = outputWidth && outputWidth > 0 ? outputWidth : imgBitmap.width;
    const height = outputHeight && outputHeight > 0 ? outputHeight : imgBitmap.height;

    // 3. 绘制到指定尺寸的离屏 Canvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 2D 上下文');
    ctx.drawImage(imgBitmap, 0, 0, width, height);

    self.postMessage({ type: 'progress', fileId, progress: 30 });

    // 4. 根据目标格式转换
    let outputBlob: Blob;
    const ext = targetFormat.toLowerCase();

    if (ext === 'bmp') {
      outputBlob = await convertToBMP(canvas);
    } else if (ext === 'ico') {
      outputBlob = await convertToICO(canvas);
    } else if (['svg','heic','tga','psd','raw','jxl'].includes(ext)) {
      throw new Error(`输出格式 ${ext} 暂不支持，建议使用 PNG/JPG/WEBP`);
    } else {
      const mime = formatRegistry[ext]?.mime || 'image/png';
      const canvasQuality = ext === 'png' ? undefined : mapQualityToCanvas(ext, quality);
      outputBlob = await canvas.convertToBlob({ type: mime, quality: canvasQuality });
    }

    self.postMessage({ type: 'progress', fileId, progress: 90 });

    // 5. 回传结果
    const resultArrayBuffer = await outputBlob.arrayBuffer();
    self.postMessage({ type: 'done', fileId, blob: resultArrayBuffer, mimeType: outputBlob.type });
  } catch (error: any) {
    self.postMessage({ type: 'error', fileId, error: error.message || '转换失败' });
  }
};

// ========== BMP 生成（使用当前 canvas 尺寸） ==========
async function convertToBMP(canvas: OffscreenCanvas): Promise<Blob> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取上下文');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height } = canvas;
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const buffer = new ArrayBuffer(54 + pixelDataSize);
  const view = new DataView(buffer);
  let off = 0;
  view.setUint8(off++, 0x42); view.setUint8(off++, 0x4D);
  view.setUint32(off, 54 + pixelDataSize, true); off += 4;
  view.setUint16(off, 0, true); off += 2;
  view.setUint16(off, 0, true); off += 2;
  view.setUint32(off, 54, true); off += 4;
  view.setUint32(off, 40, true); off += 4;
  view.setInt32(off, width, true); off += 4;
  view.setInt32(off, -height, true); off += 4;
  view.setUint16(off, 1, true); off += 2;
  view.setUint16(off, 24, true); off += 2;
  view.setUint32(off, 0, true); off += 4;
  view.setUint32(off, pixelDataSize, true); off += 4;
  view.setInt32(off, 2835, true); off += 4;
  view.setInt32(off, 2835, true); off += 4;
  view.setUint32(off, 0, true); off += 4;
  view.setUint32(off, 0, true); off += 4;
  const pixelOffset = off;
  const data = imageData.data;
  for (let y = 0; y < height; y++) {
    const rowOff = pixelOffset + y * rowSize;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      view.setUint8(rowOff + x * 3, data[src + 2]);     // B
      view.setUint8(rowOff + x * 3 + 1, data[src + 1]); // G
      view.setUint8(rowOff + x * 3 + 2, data[src]);     // R
    }
    for (let p = width * 3; p < rowSize; p++) view.setUint8(rowOff + p, 0);
  }
  return new Blob([buffer], { type: 'image/bmp' });
}

// ========== ICO 生成 ==========
async function convertToICO(canvas: OffscreenCanvas): Promise<Blob> {
  const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  const pngArrayBuffer = await pngBlob.arrayBuffer();
  const pngBytes = new Uint8Array(pngArrayBuffer);
  let w = canvas.width, h = canvas.height;
  if (w > 256) w = 256;
  if (h > 256) h = 256;
  if (w > 255) w = 0; // ICO 用 0 表示 256
  if (h > 255) h = 0;
  const icoSize = 6 + 16 + pngBytes.length;
  const buf = new ArrayBuffer(icoSize);
  const view = new DataView(buf);
  let off = 0;
  view.setUint16(off, 0, true); off += 2;          // reserved
  view.setUint16(off, 1, true); off += 2;          // type: 1 = icon
  view.setUint16(off, 1, true); off += 2;          // count
  view.setUint8(off++, w); view.setUint8(off++, h); // width, height
  view.setUint8(off++, 0); view.setUint8(off++, 0); // colors/palette
  view.setUint16(off, 1, true); off += 2;          // planes
  view.setUint16(off, 32, true); off += 2;         // bits per pixel
  view.setUint32(off, pngBytes.length, true); off += 4; // image size
  view.setUint32(off, 22, true); off += 4;         // offset to image data (6+16=22)
  new Uint8Array(buf).set(pngBytes, off);
  return new Blob([buf], { type: 'image/x-icon' });
}