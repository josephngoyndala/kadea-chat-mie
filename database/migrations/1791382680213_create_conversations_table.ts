import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'conversations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.enum('type', ['private', 'group']).notNullable()
      table.string('name', 100).nullable()
      table.string('avatar_path').nullable()
      table
        .integer('created_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('private_key', 50).nullable().unique()
      table.timestamp('last_message_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
