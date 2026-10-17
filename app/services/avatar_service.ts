import string from '@adonisjs/core/helpers/string'
import drive from '@adonisjs/drive/services/main'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type Conversation from '#models/conversation'
import type User from '#models/user'

/**
 * Gère la photo de profil : enregistrement du nouveau fichier, mise à jour
 * de l'utilisateur, suppression de l'ancienne photo et adresse d'affichage.
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
   * Photo d'un groupe : même logique que le profil utilisateur.
   */
  async replaceForConversation(conversation: Conversation, file: MultipartFile) {
    const previousKey = conversation.avatarPath
    const key = `group-avatars/${conversation.id}-${string.uuid()}.${file.extname ?? 'jpg'}`
    await file.moveToDisk(key)

    conversation.avatarPath = key
    await conversation.save()

    if (previousKey) {
      await this.deleteQuietly(previousKey)
    }
  }

  async removeForConversation(conversation: Conversation) {
    const previousKey = conversation.avatarPath
    if (!previousKey) {
      return
    }

    conversation.avatarPath = null
    await conversation.save()

    await this.deleteQuietly(previousKey)
  }

  /**
   * Adresse d'affichage de la photo d'un utilisateur, ou null s'il n'en a pas.
   */
  async urlFor(user: User) {
    return this.urlForKey(user.avatarPath)
  }

  /**
   * Adresse d'affichage d'un fichier enregistré, ou null si la clé est vide.
   */
  async urlForKey(key: string | null) {
    return key ? drive.use().getUrl(key) : null
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
