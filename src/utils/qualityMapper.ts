/**
 * 将用户质量（0-100）转换为各格式编码器期望的质量参数
 */
export function mapQualityToCanvas(format: string, userQuality: number): number | undefined {
  if (format === 'png' || format === 'bmp' || format === 'ico') return undefined;
  return userQuality / 100;
}

export function mapQualityForGifJs(userQuality: number): number {
  // gif.js quality: 1 (best) - 30 (worst)
  return Math.max(1, Math.min(30, Math.round(31 - (userQuality / 100) * 30)));
}

export function mapQualityForBrowserCompression(userQuality: number, fileSizeMB: number): {
  maxSizeMB: number;
  initialQuality: number;
} {
  return {
    maxSizeMB: fileSizeMB * (userQuality / 100 + 0.1),
    initialQuality: userQuality / 100,
  };
}