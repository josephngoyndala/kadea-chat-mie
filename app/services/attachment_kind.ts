export type AttachmentKind = 'image' | 'video' | 'file'

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
}

type AttachmentLike = {
  mimeType: string
  storagePath: string
}

function extensionOf(file: AttachmentLike) {
  return file.storagePath.split('.').pop()?.toLowerCase() ?? ''
}

/**
 * Type d'une pièce jointe : image, vidéo ou autre fichier. L'extension du
 * fichier fait foi, ce qui reconnaît aussi les anciennes pièces jointes
 * enregistrées avec un type incomplet (« image » au lieu de « image/png »).
 */
export function attachmentKind(file: AttachmentLike): AttachmentKind {
  const extension = extensionOf(file)

  if (extension in IMAGE_MIME_BY_EXTENSION || file.mimeType.startsWith('image/')) {
    return 'image'
  }
  if (extension in VIDEO_MIME_BY_EXTENSION || file.mimeType.startsWith('video/')) {
    return 'video'
  }
  return 'file'
}

/**
 * Type MIME complet d'une pièce jointe (« image/png »), reconstitué depuis
 * l'extension quand le type enregistré est incomplet.
 */
export function attachmentMimeType(file: AttachmentLike) {
  if (file.mimeType.includes('/')) {
    return file.mimeType
  }

  const extension = extensionOf(file)
  return IMAGE_MIME_BY_EXTENSION[extension] ?? VIDEO_MIME_BY_EXTENSION[extension] ?? file.mimeType
}
