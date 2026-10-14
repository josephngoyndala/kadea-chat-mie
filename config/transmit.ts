import { defineConfig } from '@adonisjs/transmit'

export default defineConfig({
  /**
   * Un signal toutes les 30 secondes garde la connexion ouverte à travers
   * les serveurs intermédiaires de l'hébergeur.
   */
  pingInterval: '30s',

  /**
   * Une seule instance de l'application : pas besoin de transport. Avec
   * plusieurs instances, il faudrait Redis.
   */
  transport: null,
})
