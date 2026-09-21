const MAX_EDGE = 2560;
const QUALITY = 0.86;

function waitForImage(image) {
  if (image.decode) return image.decode();
  return new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("图片无法解码"));
  });
}

function canvasBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片压缩失败")), mime, quality);
  });
}

export async function optimizeImage(file) {
  if (!file || file.size === 0) throw new Error("文件为空");
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  try {
    await waitForImage(image);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("图片没有有效尺寸");
    const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("当前浏览器无法处理图片");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let blob = await canvasBlob(canvas, "image/webp", QUALITY);
    if (blob.type !== "image/webp") blob = await canvasBlob(canvas, "image/jpeg", QUALITY);
    return {
      blob,
      width,
      height,
      mime: blob.type || "image/jpeg",
      originalName: file.name || "未命名照片",
    };
  } catch (error) {
    throw new Error(`无法读取“${file.name || "此文件"}”：${error.message || "请换一张图片重试"}`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
