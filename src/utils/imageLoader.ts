/**
 * 加载文件生成预览图 URL 并获取原始尺寸
 */
export function loadImagePreview(file: File): Promise<{
  url: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法加载图片预览'));
    };
    img.src = url;
  });
}