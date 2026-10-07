import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'conversation_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('conversation_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('conversations')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.enum('role', ['admin', 'member']).notNullable().defaultTo('member')
      table
        .integer('last_delivered_message_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('messages')
        .onDelete('SET NULL')
      table
        .integer('last_read_message_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('messages')
        .onDelete('SET NULL')
      table.timestamp('joined_at').notNullable().defaultTo(this.now())

      table.unique(['conversation_id', 'user_id'])
      table.index('user_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
