import type Conversation from '#models/conversation'
import type Message from '#models/message'
import type User from '#models/user'
import AvatarService from '#services/avatar_service'
import type { ConversationWithLastMessage } from '#services/conversation_service'
import { dayKey, formatDayLabel, formatListDate, formatMessageTime } from '#services/date_formatter'
import { isWithinEditWindow } from '#services/message_rules'

export type ConversationCard = {
  id: number
  title: string
  initials: string
  avatarUrl: string | null
  preview: string
  time: string
}

export type ConversationHeader = {
  title: string
  initials: string
  avatarUrl: string | null
}

export type MessageBubble = {
  id: number
  body: string
  isMine: boolean
  isDeleted: boolean
  isEdited: boolean
  canEdit: boolean
  canDeleteForEveryone: boolean
  time: string
}

export type MessageGroup = {
  label: string
  messages: MessageBubble[]
}

/**
 * Prépare les données affichées par les vues des conversations : titres,
 * aperçus, heures et regroupement des messages par jour.
 */
export default class ConversationPresenter {
  private avatars = new AvatarService()

  /**
   * Cartes de la liste des conversations.
   */
  async cards(items: ConversationWithLastMessage[], viewer: User): Promise<ConversationCard[]> {
    return Promise.all(
      items.map(async ({ conversation, lastMessage }) => {
        const identity = await this.identity(conversation, viewer)

        return {
          id: conversation.id,
          ...identity,
          preview: this.previewOf(lastMessage, viewer),
          time: lastMessage ? formatListDate(lastMessage.createdAt) : '',
        }
      })
    )
  }

  /**
   * En-tête d'une conversation ouverte.
   */
  async header(conversation: Conversation, viewer: User): Promise<ConversationHeader> {
    return this.identity(conversation, viewer)
  }

  /**
   * Une bulle de message, avec les actions que l'utilisateur peut faire
   * dessus. C'est le serveur qui fait respecter ces règles : l'interface ne
   * fait que cacher les boutons non permis.
   */
  bubble(message: Message, viewer: User): MessageBubble {
    const isDeleted = Boolean(message.deletedAt)
    const isMine = message.senderId === viewer.id

    return {
      id: message.id,
      body: isDeleted ? '' : (message.body ?? ''),
      isMine,
      isDeleted,
      isEdited: Boolean(message.editedAt) && !isDeleted,
      canEdit: isMine && !isDeleted && isWithinEditWindow(message.createdAt),
      canDeleteForEveryone: isMine && !isDeleted,
      time: formatMessageTime(message.createdAt),
    }
  }

  /**
   * Données du morceau de HTML renvoyé après une action sur un message : la
   * bulle et, si c'est le premier message du jour, l'intitulé du jour.
   */
  fragment(message: Message, viewer: User, startsNewDay: boolean) {
    return {
      message: this.bubble(message, viewer),
      dayLabel: startsNewDay ? formatDayLabel(message.createdAt) : null,
    }
  }

  /**
   * Messages regroupés par jour, avec un intitulé pour chaque jour.
   */
  groupMessages(messages: Message[], viewer: User): MessageGroup[] {
    const groups: MessageGroup[] = []
    let currentDay = ''

    for (const message of messages) {
      const day = dayKey(message.createdAt)

      if (day !== currentDay) {
        groups.push({ label: formatDayLabel(message.createdAt), messages: [] })
        currentDay = day
      }

      groups[groups.length - 1].messages.push(this.bubble(message, viewer))
    }

    return groups
  }

  /**
   * Nom, initiales et photo à afficher pour une conversation : l'autre
   * participant pour une conversation privée, le groupe sinon.
   */
  private async identity(conversation: Conversation, viewer: User) {
    if (conversation.type === 'group') {
      const title = conversation.name ?? 'Groupe'
      return {
        title,
        initials: this.initialsOf(title),
        avatarUrl: await this.avatars.urlForKey(conversation.avatarPath),
      }
    }

    const other = conversation.members.find((member) => member.userId !== viewer.id)?.user
    if (!other) {
      return { title: 'Utilisateur introuvable', initials: '?', avatarUrl: null }
    }

    return {
      title: other.fullName ?? other.email,
      initials: other.initials,
      avatarUrl: await this.avatars.urlFor(other),
    }
  }

  /**
   * Aperçu du dernier message, préfixé par « Vous : » s'il est de l'utilisateur.
   */
  private previewOf(message: Message | null, viewer: User) {
    if (!message) {
      return 'Aucun message'
    }
    if (message.deletedAt) {
      return 'Message supprimé'
    }

    const text = (message.body ?? '').replace(/\s+/g, ' ').trim()
    const clipped = text.length > 80 ? `${text.slice(0, 80)}…` : text

    return message.senderId === viewer.id ? `Vous : ${clipped}` : clipped
  }

  private initialsOf(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
  }
}
