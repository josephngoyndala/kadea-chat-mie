import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /**
       * Rempli quand le message a été envoyé par un utilisateur bloqué par le
       * destinataire : il est enregistré, mais ne sera jamais remis (un seul
       * trait pour son auteur, comme sur WhatsApp).
       */
      table.timestamp('silenced_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('silenced_at')
    })
  }
}
