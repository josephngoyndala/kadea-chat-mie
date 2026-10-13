import Alpine from 'alpinejs'
import '@fontsource-variable/plus-jakarta-sans'

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
 * défilement vers le dernier message, modification et suppression.
 */
Alpine.data('conversationChat', function () {
  return {
    draft: '',
    sending: false,
    error: '',

    init() {
      this.$nextTick(() => this.scrollToBottom(false))
    },

    get canSend() {
      return this.draft.trim().length > 0 && !this.sending
    },

    scrollToBottom(smooth = true) {
      const list = this.$refs.list
      list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
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

      try {
        const response = await postToServer(event.target)

        if (response.status === 201) {
          this.$refs.list.querySelector('[data-empty]')?.remove()
          this.$refs.messages.insertAdjacentHTML('beforeend', await response.text())
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

Alpine.start()