import string from '@adonisjs/core/helpers/string'
import drive from '@adonisjs/drive/services/main'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type User from '#models/user'

/**
 * Gère la photo de profil : enregistrement du nouveau fichier, mise à jour
 * de l'utilisateur et suppression de l'ancienne photo.
 */
export default class AvatarService {
  /**
   * Enregistre la photo envoyée et remplace l'ancienne.
   * Seul le chemin du fichier est stocké en base (colonne avatar_path).
   */
  async replace(user: User, file: MultipartFile) {
    const previousKey = user.avatarPath

    /**
     * Nom unique : évite les collisions et force le navigateur à
     * recharger l'image quand elle change.
     */
    const key = `avatars/${user.id}-${string.uuid()}.${file.extname ?? 'jpg'}`
    await file.moveToDisk(key)

    user.avatarPath = key
    await user.save()

    if (previousKey) {
      await this.deleteQuietly(previousKey)
    }
  }

  /**
   * Supprime la photo de profil de l'utilisateur.
   */
  async remove(user: User) {
    const previousKey = user.avatarPath
    if (!previousKey) {
      return
    }

    user.avatarPath = null
    await user.save()

    await this.deleteQuietly(previousKey)
  }

  /**
   * Une photo déjà absente du disque ne doit pas faire échouer l'opération.
   */
  private async deleteQuietly(key: string) {
    try {
      await drive.use().delete(key)
    } catch {
      // Fichier introuvable ou stockage momentanément indisponible : on ignore.
    }
  }
}
