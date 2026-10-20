import type Conversation from '#models/conversation'
import type ConversationMember from '#models/conversation_member'
import type Message from '#models/message'
import type User from '#models/user'
import AvatarService from '#services/avatar_service'
import BlockService from '#services/block_service'
import type { ConversationWithLastMessage } from '#services/conversation_service'
import { attachmentKind, attachmentMimeType } from '#services/attachment_kind'
import { dayKey, formatDayLabel, formatListDate, formatMessageTime } from '#services/date_formatter'
import { isWithinEditWindow } from '#services/message_rules'
import type { MessageHit } from '#services/message_search_service'
import { isUserOnline } from '#services/presence'

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

export type MessageSearchResult = {
  messageId: number
  conversationId: number
  title: string
  initials: string
  avatarUrl: string | null
  isGroup: boolean
  author: string | null
  time: string
  before: string
  match: string
  after: string
}

export type MessageAttachmentView = {
  id: number
  originalName: string
  storagePath: string
  mimeType: string
  isImage: boolean
  isVideo: boolean
  sizeLabel: string
}

/**
 * Statut d'un message que l'on a envoyé :
 * - sent : envoyé, pas encore reçu (le destinataire est hors ligne) → un trait ;
 * - delivered : reçu (le destinataire est connecté) → deux traits gris ;
 * - read : lu (le destinataire a ouvert la conversation) → deux traits bleus.
 */
export type MessageStatus = 'sent' | 'delivered' | 'read'

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
  status: MessageStatus | null
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
  private blocks = new BlockService()

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
    const blockers = await this.blocks.blockerIdsOf(viewer)

    return Promise.all(
      items.map(async ({ conversation, lastMessage, unreadCount }) => {
        const identity = await this.identity(conversation, viewer, blockers)

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
   * Résultats de la recherche d'un mot dans les messages : la conversation
   * d'origine (nom et photo), l'auteur, l'heure et un extrait du message où le
   * mot trouvé est isolé pour être mis en évidence.
   */
  async searchResults(
    hits: MessageHit[],
    viewer: User,
    term: string
  ): Promise<MessageSearchResult[]> {
    const blockers = await this.blocks.blockerIdsOf(viewer)

    return Promise.all(
      hits.map(async ({ message, conversation }) => {
        const identity = await this.identity(conversation, viewer, blockers)
        const isGroup = conversation.type === 'group'

        let author: string | null = null
        if (message.senderId === viewer.id) {
          author = 'Vous'
        } else if (isGroup) {
          author = message.sender?.fullName?.split(' ')[0] ?? 'Membre'
        }

        return {
          messageId: message.id,
          conversationId: conversation.id,
          ...identity,
          isGroup,
          author,
          time: formatListDate(message.createdAt),
          ...this.excerptOf(message.body ?? '', term),
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

    const blockers = await this.blocks.blockerIdsOf(viewer)

    /**
     * Un utilisateur bloqué ne voit plus si l'autre est en ligne.
     */
    const otherUser = otherMember?.user
    const isOnline = otherUser && !blockers.has(otherUser.id) ? isUserOnline(otherUser) : false

    return {
      ...(await this.identity(conversation, viewer, blockers)),
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
   *
   * `members` sont les membres de la conversation (avec leurs pointeurs de
   * réception et de lecture) : ils servent à calculer les traits des messages
   * de l'utilisateur.
   */
  bubble(
    message: Message,
    viewer: User,
    showAuthor: boolean,
    members: ConversationMember[] = []
  ): MessageBubble {
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
      status: isMine && !isDeleted ? this.statusOf(message, members) : null,
    }
  }

  /**
   * Données du morceau de HTML renvoyé après une action sur un message : la
   * bulle et, si c'est le premier message du jour, l'intitulé du jour.
   */
  fragment(
    message: Message,
    viewer: User,
    startsNewDay: boolean,
    showAuthor: boolean,
    members: ConversationMember[] = []
  ) {
    return {
      message: this.bubble(message, viewer, showAuthor, members),
      dayLabel: startsNewDay ? formatDayLabel(message.createdAt) : null,
    }
  }

  /**
   * Messages regroupés par jour, avec un intitulé pour chaque jour.
   */
  groupMessages(
    messages: Message[],
    viewer: User,
    showAuthor: boolean,
    members: ConversationMember[] = []
  ): MessageGroup[] {
    const groups: MessageGroup[] = []
    let currentDay = ''

    for (const message of messages) {
      const day = dayKey(message.createdAt)

      if (day !== currentDay) {
        groups.push({ label: formatDayLabel(message.createdAt), messages: [] })
        currentDay = day
      }

      groups[groups.length - 1].messages.push(this.bubble(message, viewer, showAuthor, members))
    }

    return groups
  }

  /**
   * Statut d'un message envoyé par l'utilisateur. Dans un groupe, il faut que
   * tous les autres membres l'aient reçu (ou lu) pour que le statut avance.
   */
  private statusOf(message: Message, members: ConversationMember[]): MessageStatus {
    /**
     * Un message envoyé à quelqu'un qui a bloqué son auteur n'est jamais remis :
     * il reste à un seul trait, même si le destinataire est en ligne.
     */
    if (message.silencedAt) {
      return 'sent'
    }

    const recipients = members.filter((member) => member.userId !== message.senderId)
    if (recipients.length === 0) {
      return 'sent'
    }

    if (recipients.every((member) => (member.lastReadMessageId ?? 0) >= message.id)) {
      return 'read'
    }
    if (
      recipients.every(
        (member) =>
          Math.max(member.lastDeliveredMessageId ?? 0, member.lastReadMessageId ?? 0) >= message.id
      )
    ) {
      return 'delivered'
    }
    return 'sent'
  }

  /**
   * Nom, initiales et photo à afficher pour une conversation : l'autre
   * participant pour une conversation privée, le groupe sinon.
   */
  private async identity(conversation: Conversation, viewer: User, blockers: Set<number>) {
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

    /**
     * Un utilisateur bloqué ne voit plus la photo de celui qui l'a bloqué :
     * ses initiales s'affichent à la place, sans rien lui signaler.
     */
    return {
      title: other.fullName ?? other.email,
      initials: other.initials,
      avatarUrl: blockers.has(other.id) ? null : await this.avatars.urlFor(other),
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
      const hasVideo = message.attachments.some((file) => attachmentKind(file) === 'video')
      const hasImage = message.attachments.some((file) => attachmentKind(file) === 'image')
      if (hasVideo) {
        text = '🎬 Vidéo'
      } else if (hasImage) {
        text = '📷 Photo'
      } else {
        text = '📎 Fichier'
      }
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

  /**
   * Court extrait du message autour du mot cherché, découpé en trois parties
   * (avant, mot trouvé, après) pour que la vue puisse surligner le mot sans
   * insérer de HTML.
   */
  private excerptOf(body: string, term: string) {
    const text = body.replace(/\s+/g, ' ').trim()
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const found = escaped ? new RegExp(escaped, 'i').exec(text) : null

    if (!found) {
      return { before: text.slice(0, 80), match: '', after: '' }
    }

    const start = Math.max(0, found.index - 30)
    const matchEnd = found.index + found[0].length
    const end = Math.min(text.length, matchEnd + 50)

    return {
      before: `${start > 0 ? '…' : ''}${text.slice(start, found.index)}`,
      match: found[0],
      after: `${text.slice(matchEnd, end)}${end < text.length ? '…' : ''}`,
    }
  }

  private attachmentsOf(message: Message): MessageAttachmentView[] {
    if (!message.attachments?.length) {
      return []
    }

    return message.attachments.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      storagePath: file.storagePath,
      mimeType: attachmentMimeType(file),
      isImage: attachmentKind(file) === 'image',
      isVideo: attachmentKind(file) === 'video',
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
