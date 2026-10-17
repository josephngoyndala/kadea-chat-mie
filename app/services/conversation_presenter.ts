import { DateTime } from 'luxon'
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
  isGroup: boolean
  unreadCount: number
}

export type ConversationHeader = {
  title: string
  initials: string
  avatarUrl: string | null
  isGroup: boolean
  memberCount: number
  otherUserId: number | null
  isOnline: boolean
}

export type MessageAttachmentView = {
  id: number
  originalName: string
  storagePath: string
  mimeType: string
  isImage: boolean
  sizeLabel: string
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
  authorName: string | null
  authorColor: number
  attachments: MessageAttachmentView[]
}

export type MessageGroup = {
  label: string
  messages: MessageBubble[]
}

export type GroupMemberView = {
  id: number
  name: string
  initials: string
  avatarUrl: string | null
  isAdmin: boolean
  isMe: boolean
}

/**
 * Prépare les données affichées par les vues des conversations : titres,
 * aperçus, heures, auteurs et regroupement des messages par jour.
 */
export default class ConversationPresenter {
  private avatars = new AvatarService()

  /**
   * Indique si les messages d'une conversation doivent afficher leur auteur.
   */
  showsAuthors(conversation: Conversation) {
    return conversation.type === 'group'
  }

  /**
   * Cartes de la liste des conversations.
   */
  async cards(items: ConversationWithLastMessage[], viewer: User): Promise<ConversationCard[]> {
    return Promise.all(
      items.map(async ({ conversation, lastMessage, unreadCount }) => {
        const identity = await this.identity(conversation, viewer)

        return {
          id: conversation.id,
          ...identity,
          preview: this.previewOf(lastMessage, viewer, this.showsAuthors(conversation)),
          time: lastMessage ? formatListDate(lastMessage.createdAt) : '',
          isGroup: conversation.type === 'group',
          unreadCount: unreadCount ?? 0,
        }
      })
    )
  }

  /**
   * En-tête d'une conversation ouverte.
   */
  async header(conversation: Conversation, viewer: User): Promise<ConversationHeader> {
    const isGroup = conversation.type === 'group'
    const otherMember = !isGroup
      ? conversation.members.find((member) => member.userId !== viewer.id)
      : null

    const otherUser = otherMember?.user
    const isOnline = Boolean(
      otherUser?.lastSeenAt &&
        DateTime.now().diff(otherUser.lastSeenAt, 'minutes').minutes < 2
    )

    return {
      ...(await this.identity(conversation, viewer)),
      isGroup,
      memberCount: conversation.members.length,
      otherUserId: otherUser?.id ?? null,
      isOnline,
    }
  }

  /**
   * Membres d'un groupe : les administrateurs d'abord, puis par ordre
   * alphabétique.
   */
  async members(conversation: Conversation, viewer: User): Promise<GroupMemberView[]> {
    const nameOf = (member: Conversation['members'][number]) =>
      member.user.fullName ?? member.user.email

    const sorted = [...conversation.members].sort((a, b) => {
      const byRole = (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1)
      return byRole !== 0 ? byRole : nameOf(a).localeCompare(nameOf(b), 'fr')
    })

    return Promise.all(
      sorted.map(async (member) => ({
        id: member.userId,
        name: nameOf(member),
        initials: member.user.initials,
        avatarUrl: await this.avatars.urlFor(member.user),
        isAdmin: member.role === 'admin',
        isMe: member.userId === viewer.id,
      }))
    )
  }

  /**
   * Une bulle de message, avec les actions que l'utilisateur peut faire
   * dessus. C'est le serveur qui fait respecter ces règles : l'interface ne
   * fait que cacher les boutons non permis. Dans un groupe, la bulle des
   * autres affiche le nom de son auteur (le message doit avoir son auteur
   * chargé).
   */
  bubble(message: Message, viewer: User, showAuthor: boolean): MessageBubble {
    const isDeleted = Boolean(message.deletedAt)
    const isMine = message.senderId === viewer.id

    return {
      id: message.id,
      body: isDeleted ? '' : (message.body ?? ''),
      isMine,
      isDeleted,
      isEdited: Boolean(message.editedAt) && !isDeleted,
      canEdit:
        isMine &&
        !isDeleted &&
        Boolean(message.body?.trim()) &&
        isWithinEditWindow(message.createdAt),
      canDeleteForEveryone: isMine && !isDeleted,
      time: formatMessageTime(message.createdAt),
      authorName: showAuthor && !isMine ? (message.sender?.fullName ?? 'Membre') : null,
      authorColor: message.senderId % 6,
      attachments: isDeleted ? [] : this.attachmentsOf(message),
    }
  }

  /**
   * Données du morceau de HTML renvoyé après une action sur un message : la
   * bulle et, si c'est le premier message du jour, l'intitulé du jour.
   */
  fragment(message: Message, viewer: User, startsNewDay: boolean, showAuthor: boolean) {
    return {
      message: this.bubble(message, viewer, showAuthor),
      dayLabel: startsNewDay ? formatDayLabel(message.createdAt) : null,
    }
  }

  /**
   * Messages regroupés par jour, avec un intitulé pour chaque jour.
   */
  groupMessages(messages: Message[], viewer: User, showAuthor: boolean): MessageGroup[] {
    const groups: MessageGroup[] = []
    let currentDay = ''

    for (const message of messages) {
      const day = dayKey(message.createdAt)

      if (day !== currentDay) {
        groups.push({ label: formatDayLabel(message.createdAt), messages: [] })
        currentDay = day
      }

      groups[groups.length - 1].messages.push(this.bubble(message, viewer, showAuthor))
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
   * Aperçu du dernier message : « Vous : … » pour l'utilisateur, et dans un
   * groupe « Alice : … » pour les autres.
   */
  private previewOf(message: Message | null, viewer: User, isGroup: boolean) {
    if (!message) {
      return 'Aucun message'
    }
    if (message.deletedAt) {
      return 'Message supprimé'
    }

    let text = (message.body ?? '').replace(/\s+/g, ' ').trim()
    if (!text && message.attachments && message.attachments.length > 0) {
      const hasImage = message.attachments.some((file) => file.mimeType.startsWith('image/'))
      text = hasImage ? '📷 Photo' : '📎 Fichier'
    }

    const clipped = text.length > 80 ? `${text.slice(0, 80)}…` : text

    if (message.senderId === viewer.id) {
      return `Vous : ${clipped}`
    }
    if (isGroup) {
      const firstName = message.sender?.fullName?.split(' ')[0] ?? 'Membre'
      return `${firstName} : ${clipped}`
    }
    return clipped
  }

  private attachmentsOf(message: Message): MessageAttachmentView[] {
    if (!message.attachments?.length) {
      return []
    }

    return message.attachments.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      storagePath: file.storagePath,
      mimeType: file.mimeType,
      isImage: file.mimeType.startsWith('image/'),
      sizeLabel: this.formatFileSize(file.sizeBytes),
    }))
  }

  private formatFileSize(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} o`
    }
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} Ko`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
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
