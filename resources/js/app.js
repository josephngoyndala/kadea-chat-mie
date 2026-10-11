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

Alpine.start()