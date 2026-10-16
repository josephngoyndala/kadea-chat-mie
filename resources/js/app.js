import Alpine from 'alpinejs'
import '@fontsource-variable/plus-jakarta-sans'
import { getTransmit } from './realtime.js'

Alpine.data('alert', function () {
  return {
    isVisible: false,
    dismiss() {
      this.isVisible = false
    },
    init() {
      setTimeout(() => {
        this.isVisible = true
      }, 80)
      setTimeout(() => {
        this.dismiss()
      }, 5000)
    },
  }
})

/**
 * Fenêtre d'agrandissement des photos, unique pour toute l'application.
 * Elle s'ouvre quand l'événement « photo-zoom » est émis (voir plus bas).
 */
Alpine.data('photoLightbox', function () {
  return {
    open: false,
    src: '',
    alt: '',
    trigger: null,

    show(detail) {
      this.src = detail.src
      this.alt = detail.alt || 'Photo'
      this.trigger = document.activeElement
      this.open = true
      this.$nextTick(() => this.$refs.close?.focus())
    },

    close() {
      if (!this.open) {
        return
      }
      this.open = false
      this.trigger?.focus?.()
    },
  }
})

/**
 * Un seul écouteur pour tous les clics : tout élément portant l'attribut
 * data-zoom-src ouvre la fenêtre, même s'il a été ajouté après le chargement
 * de la page (messages reçus en temps réel, par exemple).
 */
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-zoom-src]') : null
  if (!target) {
    return
  }

  event.preventDefault()
  window.dispatchEvent(
    new CustomEvent('photo-zoom', {
      detail: { src: target.dataset.zoomSrc, alt: target.dataset.zoomAlt },
    })
  )
})

/**
 * Appel au serveur utilisé par la messagerie : le serveur répond par le
 * morceau de HTML à insérer dans la page.
 */
function postToServer(form) {
  return fetch(form.action, {
    method: 'POST',
    headers: { 'X-Chat-Fetch': '1', Accept: 'application/json' },
    body: new URLSearchParams(new FormData(form)),
  })
}

/**
 * Sélecteur de membres d'un nouveau groupe : filtre la liste (sans tenir
 * compte des accents) et vérifie qu'un nom et au moins un membre sont
 * renseignés avant d'activer le bouton de création.
 */
Alpine.data('groupPicker', function () {
  return {
    query: '',
    name: '',
    selected: [],

    normalize(text) {
      return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
    },

    visible(searchText) {
      const words = this.normalize(this.query).split(/\s+/).filter(Boolean)
      return words.every((word) => searchText.includes(word))
    },

    get canSubmit() {
      return this.name.trim().length >= 2 && this.selected.length > 0
    },
  }
})

/**
 * Une bulle de message : un appui ouvre le menu d'actions (modifier,
 * supprimer pour moi ou pour tous). Le mode « edit » remplace la bulle par
 * un petit éditeur.
 */
Alpine.data('messageBubble', function () {
  return {
    menu: false,
    mode: 'actions',

    toggle() {
      if (this.mode === 'edit') {
        return
      }
      this.menu = !this.menu
      this.mode = 'actions'
    },

    close() {
      this.menu = false
      this.mode = 'actions'
    },

    startEdit() {
      this.menu = false
      this.mode = 'edit'
      this.$nextTick(() => {
        const field = this.$refs.editField
        field?.focus()
        field?.setSelectionRange(field.value.length, field.value.length)
      })
    },

    cancelEdit() {
      this.mode = 'actions'
    },
  }
})

/**
 * Une conversation ouverte : champ de saisie, envoi sans recharger la page,
 * réception en temps réel, modification et suppression.
 */
Alpine.data('conversationChat', function () {
  return {
    conversationId: null,
    userId: null,
    otherUserId: null,
    isOnline: false,
    messageUrlTemplate: '',
    catchUpUrl: '',
    draft: '',
    sending: false,
    error: '',
    offline: false,
    unseen: 0,
    typingUser: null,
    typingTimer: null,
    lastTypingSent: 0,
    heartbeatTimer: null,

    init() {
      this.conversationId = this.$el.dataset.conversationId
      this.userId = parseInt(this.$el.dataset.userId || '0', 10)
      this.otherUserId = this.$el.dataset.otherUserId ? parseInt(this.$el.dataset.otherUserId, 10) : null
      this.isOnline = this.$el.dataset.isOnline === '1'
      this.messageUrlTemplate = this.$el.dataset.messageUrl || ''
      this.catchUpUrl = this.$el.dataset.catchUpUrl || ''

      this.$nextTick(() => this.scrollToBottom(false))
      this.listen()
      this.startHeartbeat()
    },

    get canSend() {
      return this.draft.trim().length > 0 && !this.sending
    },

    /**
     * Abonnement au canal temps réel de la conversation et de présence.
     * À la reconnexion, on va chercher les messages manqués.
     */
    async listen() {
      const transmit = getTransmit()

      transmit.on('connected', () => {
        if (this.offline) {
          this.catchUp()
        }
        this.offline = false
      })
      transmit.on('disconnected', () => {
        this.offline = true
      })
      transmit.on('reconnecting', () => {
        this.offline = true
      })

      // 1. Canal de la conversation (messages et indicateur de saisie)
      if (this.conversationId) {
        const conversationSub = transmit.subscription(
          `conversations/${this.conversationId}`
        )
        await conversationSub.create()

        conversationSub.onMessage((event) => {
          if (event.type === 'message.created') {
            this.typingUser = null
            if (this.typingTimer) clearTimeout(this.typingTimer)
            this.onCreated(event.messageId)
          } else if (event.type === 'message.updated') {
            this.onUpdated(event.messageId)
          } else if (event.type === 'user.typing') {
            this.onTyping(event)
          }
        })
      }

      // 2. Canal de présence (en ligne / hors ligne)
      const presenceSub = transmit.subscription('presence')
      await presenceSub.create()

      presenceSub.onMessage((event) => {
        if (event.type === 'user.presence') {
          if (this.otherUserId && event.userId === this.otherUserId) {
            this.isOnline = Boolean(event.isOnline)
          }
        }
      })
    },

    /**
     * Maintient le statut actif de l'utilisateur sur le serveur.
     */
    startHeartbeat() {
      this.heartbeatTimer = setInterval(() => {
        this.sendPing()
      }, 45000)

      window.addEventListener('beforeunload', () => {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
      })
    },

    sendPing() {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content
      if (!csrf) return
      fetch('/presence/ping', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrf,
          'X-Chat-Fetch': '1',
        },
      }).catch(() => {})
    },

    /**
     * Adresse de la bulle d'un message : le modèle fourni par la page se
     * termine par /0, que l'on remplace par l'identifiant.
     */
    messageUrl(messageId) {
      return (this.messageUrlTemplate || this.$el.dataset.messageUrl || '').replace(/\/0$/, `/${messageId}`)
    },

    /**
     * Un message vient d'être envoyé par quelqu'un (peut-être nous-même, dans
     * ce cas la bulle est déjà là).
     */
    async onCreated(messageId) {
      if (document.getElementById(`message-${messageId}`)) {
        return
      }

      try {
        const response = await fetch(this.messageUrl(messageId), {
          headers: { 'X-Chat-Fetch': '1' },
        })
        if (response.ok) {
          this.receive(await response.text())
        }
      } catch {
        // Réseau coupé : le rattrapage se fera à la reconnexion.
      }
    },

    /**
     * Un message affiché a été modifié ou supprimé pour tous : on remplace sa
     * bulle par la version à jour.
     */
    async onUpdated(messageId) {
      if (!document.getElementById(`message-${messageId}`)) {
        return
      }

      try {
        const response = await fetch(`${this.messageUrl(messageId)}?bare=1`, {
          headers: { 'X-Chat-Fetch': '1' },
        })
        const current = document.getElementById(`message-${messageId}`)

        if (response.ok && current) {
          current.outerHTML = await response.text()
        }
      } catch {
        // Réseau coupé : la bulle sera à jour au prochain chargement.
      }
    },

    /**
     * Va chercher les messages manqués pendant une coupure de connexion.
     */
    async catchUp() {
      const bubbles = this.$refs.messages.querySelectorAll('[data-message-id]')
      const lastId = bubbles.length > 0 ? bubbles[bubbles.length - 1].dataset.messageId : 0
      const url = this.catchUpUrl || this.$el.dataset.catchUpUrl

      try {
        const response = await fetch(`${url}?after=${lastId}`, {
          headers: { 'X-Chat-Fetch': '1' },
        })
        if (response.ok) {
          this.receive(await response.text())
        }
      } catch {
        // Toujours hors ligne : un nouvel essai aura lieu à la prochaine reconnexion.
      }
    },

    /**
     * Ajoute des messages reçus. Si l'utilisateur lisait déjà le bas de la
     * conversation, on le suit ; sinon on lui signale les nouveaux messages.
     */
    receive(html) {
      const followNewMessages = this.isNearBottom()
      const inserted = this.insertHtml(html)

      if (inserted === 0) {
        return
      }

      if (followNewMessages) {
        this.scrollToBottom()
        this.markAsRead()
      } else {
        this.unseen += inserted
      }
    },

    markAsRead() {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content
      const convId = this.conversationId || this.$el.dataset.conversationId
      if (!csrf || !convId) return
      fetch(`/conversations/${convId}/read`, {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrf,
          'X-Chat-Fetch': '1',
        },
      }).catch(() => {})
    },

    onTyping(event) {
      if (event.userId === this.userId) {
        return
      }

      this.typingUser = event.userName
      if (this.typingTimer) {
        clearTimeout(this.typingTimer)
      }

      if (this.isNearBottom()) {
        this.$nextTick(() => this.scrollToBottom())
      }

      this.typingTimer = setTimeout(() => {
        this.typingUser = null
      }, 3500)
    },

    onInput() {
      this.autosize()
      const now = Date.now()
      if (now - this.lastTypingSent > 2000) {
        this.lastTypingSent = now
        this.sendTypingSignal()
      }
    },

    sendTypingSignal() {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content
      const convId = this.conversationId || this.$el.dataset.conversationId
      if (!csrf || !convId) return
      fetch(`/conversations/${convId}/typing`, {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrf,
          'X-Chat-Fetch': '1',
        },
      }).catch(() => {})
    },

    /**
     * Insère des bulles dans la conversation, sans jamais dupliquer une bulle
     * déjà affichée. Renvoie le nombre de messages réellement ajoutés.
     */
    insertHtml(html) {
      const template = document.createElement('template')
      template.innerHTML = html.trim()

      let inserted = 0
      let dayLabel = null

      for (const node of [...template.content.children]) {
        if (node.matches('[data-day-label]')) {
          dayLabel = node
          continue
        }

        const messageId = node.dataset.messageId
        if (messageId && document.getElementById(`message-${messageId}`)) {
          dayLabel = null
          continue
        }

        if (dayLabel) {
          this.$refs.messages.append(dayLabel)
          dayLabel = null
        }
        this.$refs.messages.append(node)
        inserted += 1
      }

      if (inserted > 0) {
        this.$refs.list.querySelector('[data-empty]')?.remove()
      }

      return inserted
    },

    scrollToBottom(smooth = true) {
      const list = this.$refs.list
      list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
      this.unseen = 0
    },

    isNearBottom() {
      const list = this.$refs.list
      return list.scrollHeight - list.scrollTop - list.clientHeight < 120
    },

    onScroll() {
      if (this.isNearBottom()) {
        this.unseen = 0
      }
    },

    /**
     * Le champ grandit avec le texte, jusqu'à six lignes environ.
     */
    autosize() {
      const field = this.$refs.field
      field.style.height = 'auto'
      field.style.height = `${Math.min(field.scrollHeight, 144)}px`
    },

    /**
     * Sur ordinateur, Entrée envoie et Maj + Entrée passe à la ligne. Sur
     * téléphone (écran tactile), Entrée passe toujours à la ligne.
     */
    onKeydown(event) {
      const isDesktop = window.matchMedia('(pointer: fine)').matches
      if (event.key === 'Enter' && !event.shiftKey && isDesktop) {
        event.preventDefault()
        this.$refs.form.requestSubmit()
      }
    },

    async send(event) {
      if (!this.canSend) {
        return
      }

      this.sending = true
      this.error = ''
      this.typingUser = null
      if (this.typingTimer) clearTimeout(this.typingTimer)

      try {
        const response = await postToServer(event.target)

        if (response.status === 201) {
          this.insertHtml(await response.text())
          this.draft = ''
          this.$nextTick(() => {
            this.autosize()
            this.scrollToBottom()
          })
        } else {
          await this.handleFailure(response, "Le message n'a pas pu être envoyé. Réessayez.")
        }
      } catch {
        this.error = 'Connexion impossible. Vérifiez votre réseau et réessayez.'
      } finally {
        this.sending = false
        this.$refs.field.focus()
      }
    },

    /**
     * Point d'entrée des formulaires de la page envoyés dans la conversation :
     * seuls ceux des bulles (modification, suppression) sont pris en charge
     * ici, celui du champ de saisie a son propre gestionnaire.
     */
    async handleSubmit(event) {
      const form = event.target

      if (form.matches?.('[data-message-delete]')) {
        await this.deleteMessage(event, form)
      } else if (form.matches?.('[data-message-edit]')) {
        await this.editMessage(event, form)
      }
    },

    /**
     * Supprime un message : « me » le retire de l'écran, « everyone » le
     * remplace par sa version « supprimée ».
     */
    async deleteMessage(event, form) {
      event.preventDefault()
      this.error = ''

      try {
        const response = await postToServer(form)

        if (response.ok) {
          const bubble = form.closest('[data-message-id]')

          if (form.dataset.messageDelete === 'me') {
            bubble.remove()
          } else {
            bubble.outerHTML = await response.text()
          }
        } else {
          await this.handleFailure(response, "Le message n'a pas pu être supprimé. Réessayez.")
        }
      } catch {
        this.error = 'Connexion impossible. Vérifiez votre réseau et réessayez.'
      }
    },

    /**
     * Enregistre la modification d'un message et remplace la bulle.
     */
    async editMessage(event, form) {
      event.preventDefault()
      this.error = ''

      try {
        const response = await postToServer(form)

        if (response.ok) {
          form.closest('[data-message-id]').outerHTML = await response.text()
        } else {
          await this.handleFailure(response, "Le message n'a pas pu être modifié. Réessayez.")
        }
      } catch {
        this.error = 'Connexion impossible. Vérifiez votre réseau et réessayez.'
      }
    },

    /**
     * Affiche l'erreur renvoyée par le serveur, ou recharge la page si la
     * session a expiré.
     */
    async handleFailure(response, fallbackMessage) {
      if (response.status === 401 || response.status === 403) {
        window.location.reload()
        return
      }

      if (response.status === 422) {
        const data = await response.json()
        this.error = data.errors?.[0]?.message ?? fallbackMessage
        return
      }

      this.error = fallbackMessage
    },
  }
})

/**
 * La liste des conversations : quand une conversation change (nouveau
 * message, modification, suppression, ajout ou retrait d'un membre), sa carte
 * est rafraîchie et remonte en haut de la liste, sans recharger la page.
 */
Alpine.data('conversationList', function () {
  return {
    search: '',
    filter: 'all',
    unreadDirectCount: 0,
    unreadGroupCount: 0,

    async init() {
      this.updateUnreadCounts()

      const subscription = getTransmit().subscription(`users/${this.$el.dataset.userId}`)
      await subscription.create()

      subscription.onMessage((event) => {
        if (event.type === 'conversation.updated') {
          this.refreshCard(event.conversationId)
        }
      })
    },

    updateUnreadCounts() {
      if (!this.$refs.items) return
      let direct = 0
      let group = 0

      this.$refs.items.querySelectorAll('[data-conversation-id]').forEach((card) => {
        const count = parseInt(card.dataset.unreadCount || '0', 10)
        const isGroup = card.dataset.isGroup === '1'
        if (count > 0) {
          if (isGroup) {
            group += count
          } else {
            direct += count
          }
        }
      })

      this.unreadDirectCount = direct
      this.unreadGroupCount = group
    },

    applyFilter() {
      if (!this.$refs.items) return
      const cards = this.$refs.items.querySelectorAll('[data-conversation-id]')
      const q = (this.search || '').trim().toLowerCase()
      let visibleCount = 0

      cards.forEach((card) => {
        const title = (card.dataset.title || card.textContent || '').toLowerCase()
        const isGroup = card.dataset.isGroup === '1'

        let matchesSearch = !q || title.includes(q)
        let matchesFilter = true
        if (this.filter === 'groups') matchesFilter = isGroup
        if (this.filter === 'direct') matchesFilter = !isGroup

        if (matchesSearch && matchesFilter) {
          card.classList.remove('hidden')
          visibleCount++
        } else {
          card.classList.add('hidden')
        }
      })

      if (this.$refs.noMatch) {
        if (visibleCount === 0 && cards.length > 0) {
          this.$refs.noMatch.classList.remove('hidden')
          this.$refs.noMatch.classList.add('flex')
        } else {
          this.$refs.noMatch.classList.remove('flex')
          this.$refs.noMatch.classList.add('hidden')
        }
      }

      this.updateUnreadCounts()
    },

    async refreshCard(conversationId) {
      const path = this.$el.dataset.cardUrl.replace('/0/', `/${conversationId}/`)
      const url = new URL(path, window.location.origin)
      url.searchParams.set('active', this.$el.dataset.activeId || '')

      try {
        const response = await fetch(url, { headers: { 'X-Chat-Fetch': '1' } })

        if (response.status === 404) {
          this.removeCard(conversationId)
          return
        }
        if (!response.ok) {
          return
        }

        const template = document.createElement('template')
        template.innerHTML = (await response.text()).trim()
        const card = template.content.firstElementChild
        if (!card) {
          return
        }

        const items = this.$refs.items
        const existing = items.querySelector(`[data-conversation-id="${conversationId}"]`)
        const hadUnread = existing ? parseInt(existing.dataset.unreadCount || '0', 10) : 0
        const hasUnread = parseInt(card.dataset.unreadCount || '0', 10)

        existing?.remove()
        items.prepend(card)

        // Signal visuel instantané aux yeux si un nouveau message arrive
        if (hasUnread > hadUnread) {
          card.classList.add('bg-brand-50/80', 'transition-colors', 'duration-700')
          setTimeout(() => {
            if (card.dataset.conversationId !== this.$el.dataset.activeId) {
              card.classList.remove('bg-brand-50/80')
            }
          }, 2500)
        }

        items.classList.remove('hidden')
        items.classList.add('min-h-0', 'flex-1')
        this.$el.querySelector('[data-list-empty]')?.remove()
        this.applyFilter()
        this.updateUnreadCounts()
      } catch {
        // Réseau coupé : la liste sera à jour au prochain chargement.
      }
    },

    /**
     * L'utilisateur n'a plus accès à cette conversation (retiré d'un groupe) :
     * on retire sa carte, et on le renvoie à la liste s'il la regardait.
     */
    removeCard(conversationId) {
      this.$refs.items.querySelector(`[data-conversation-id="${conversationId}"]`)?.remove()
      this.applyFilter()
      this.updateUnreadCounts()

      if (String(conversationId) === this.$el.dataset.activeId) {
        window.location.assign(this.$el.dataset.dashboardUrl)
      }
    },
  }
})

Alpine.start()