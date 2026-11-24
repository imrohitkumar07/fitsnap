import imageCompression from 'browser-image-compression';

/**
 * Resize and compress an image for upload.
 *
 * - Max width: 1024px
 * - Quality: 0.8
 * - Max file size: 1MB
 *
 * @param file - Original image File
 * @returns Compressed File object
 */
export async function resizeImage(file: File): Promise<File> {
  const options = {
    maxWidthOrHeight: 1024,
    maxSizeMB: 1,
    initialQuality: 0.8,
    useWebWorker: true,
    fileType: file.type as string,
  };

  try {
    const compressedBlob = await imageCompression(file, options);

    // Convert Blob back to File to preserve name/type
    return new File([compressedBlob], file.name, {
      type: compressedBlob.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('Image compression failed, returning original:', error);
    return file;
  }
}

export const compressImage = resizeImage;
