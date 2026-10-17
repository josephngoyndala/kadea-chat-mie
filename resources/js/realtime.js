import { Transmit } from '@adonisjs/transmit-client'

let transmit = null

/**
 * Connexion temps réel unique pour toute la page, créée à la première
 * utilisation. Les demandes d'abonnement sont des requêtes POST : elles
 * portent le jeton de sécurité (CSRF) fourni par la page.
 */
export function getTransmit() {
  if (transmit) {
    return transmit
  }

  const token = document.querySelector('meta[name="csrf-token"]')?.content
  const addToken = (request) => {
    if (token) {
      request.headers.set('X-CSRF-TOKEN', token)
    }
  }

  transmit = new Transmit({
    baseUrl: window.location.origin,
    maxReconnectAttempts: 30,
    beforeSubscribe: addToken,
    beforeUnsubscribe: addToken,
  })

  return transmit
}
