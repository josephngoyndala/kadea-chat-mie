import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'message_attachments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('message_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('messages')
        .onDelete('CASCADE')
      table.string('original_name').notNullable()
      table.string('storage_path').notNullable()
      table.string('mime_type', 100).notNullable()
      table.integer('size_bytes').unsigned().notNullable()
      table.timestamp('created_at').notNullable()

      table.index('message_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
