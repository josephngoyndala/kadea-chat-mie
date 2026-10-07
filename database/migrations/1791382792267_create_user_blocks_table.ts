import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_blocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('blocker_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('blocked_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable()

      table.unique(['blocker_id', 'blocked_id'])
    })

    this.schema.raw(
      'ALTER TABLE user_blocks ADD CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
