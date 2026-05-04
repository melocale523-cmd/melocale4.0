export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getCroppedBlob(
  imageSrc: string,
  cropAreaPx: CropArea,
  outputSize = 400,
  quality = 0.85,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    cropAreaPx.x,
    cropAreaPx.y,
    cropAreaPx.width,
    cropAreaPx.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      quality,
    ),
  );
}
