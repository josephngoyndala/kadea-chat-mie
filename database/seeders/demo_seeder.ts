import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import User from '#models/user'

/**
 * Mot de passe commun des comptes de démonstration.
 */
export const DEMO_PASSWORD = 'Kadea@2026'

type DemoKey = 'alice' | 'bob' | 'chloe' | 'david' | 'esther'

const DEMO_USERS: { key: DemoKey; fullName: string; email: string }[] = [
  { key: 'alice', fullName: 'Alice Mbuyi', email: 'alice@kadea.cd' },
  { key: 'bob', fullName: 'Bob Kabongo', email: 'bob@kadea.cd' },
  { key: 'chloe', fullName: 'Chloé Ilunga', email: 'chloe@kadea.cd' },
  { key: 'david', fullName: 'David Tshibanda', email: 'david@kadea.cd' },
  { key: 'esther', fullName: 'Esther Kalala', email: 'esther@kadea.cd' },
]

/**
 * Données de démonstration : cinq comptes déjà confirmés, des discussions
 * privées, un groupe et quelques messages.
 *
 * Le seeder peut être relancé sans danger : les comptes sont mis à jour et les
 * discussions déjà créées ne sont pas dupliquées.
 *
 *   node ace db:seed --files database/seeders/demo_seeder.ts
 */
export default class DemoSeeder extends BaseSeeder {
  async run() {
    const users = await this.createUsers()

    await this.seedAliceAndBob(users.alice, users.bob)
    await this.seedAliceAndDavid(users.alice, users.david)
    await this.seedWebTeam(users.alice, [users.bob, users.chloe, users.david])

    /**
     * Esther n'a aucune discussion : elle sert à montrer qu'un utilisateur
     * extérieur ne peut pas ouvrir les conversations des autres.
     */
  }

  /**
   * Crée (ou met à jour) les comptes. Leur adresse e-mail est déjà confirmée,
   * ils peuvent donc se connecter tout de suite.
   */
  private async createUsers() {
    const users = {} as Record<DemoKey, User>

    for (const demo of DEMO_USERS) {
      users[demo.key] = await User.updateOrCreate(
        { email: demo.email },
        { fullName: demo.fullName, password: DEMO_PASSWORD, emailVerifiedAt: DateTime.now() }
      )
    }

    return users
  }

  /**
   * Discussion privée entièrement lue : traits bleus chez Alice et Bob.
   */
  private async seedAliceAndBob(alice: User, bob: User) {
    const { conversation, created } = await this.privateConversation(alice, bob)
    if (!created) {
      return
    }

    await this.say(conversation, alice, 'Salut Bob, tu as fini la partie base de données ?', 1500)
    await this.say(conversation, bob, 'Salut Alice ! Oui, les migrations sont prêtes.', 1490)
    await this.say(conversation, alice, 'Super. On teste le temps réel cet après-midi ?', 1480)
    await this.say(conversation, bob, 'Avec plaisir, je prépare deux navigateurs.', 60)
    await this.say(conversation, alice, 'Parfait, à tout de suite 👍', 55)

    await this.markRead(conversation, [alice, bob])
  }

  /**
   * Discussion avec des messages non lus : Alice voit un badge de messages non
   * lus, et David voit ses messages avec un seul trait.
   */
  private async seedAliceAndDavid(alice: User, david: User) {
    const { conversation, created } = await this.privateConversation(david, alice)
    if (!created) {
      return
    }

    await this.say(conversation, david, 'Bonjour Alice, tu peux relire mon dossier ?', 6)
    await this.say(conversation, david, 'Il est dans le groupe Équipe Web.', 4)

    await this.markRead(conversation, [david])
  }

  /**
   * Groupe dont Alice est administratrice.
   */
  private async seedWebTeam(admin: User, members: User[]) {
    const existing = await Conversation.query()
      .where('type', 'group')
      .where('name', 'Équipe Web')
      .first()
    if (existing) {
      return
    }

    const group = await Conversation.create({
      type: 'group',
      name: 'Équipe Web',
      createdBy: admin.id,
    })

    await ConversationMember.createMany([
      { conversationId: group.id, userId: admin.id, role: 'admin' },
      ...members.map((member) => ({
        conversationId: group.id,
        userId: member.id,
        role: 'member',
      })),
    ])

    const [bob, chloe, david] = members

    await this.say(group, admin, 'Bienvenue dans le groupe Équipe Web !', 300)
    await this.say(group, bob, 'Merci Alice, ravi de travailler avec vous.', 290)
    await this.say(group, chloe, 'Bonjour à tous, on fait le point demain ?', 280)
    await this.say(group, david, 'Oui, la nouvelle interface est prête.', 270)
    await this.say(group, admin, 'Excellent travail, merci à tous !', 260)

    await this.markRead(group, [admin, ...members])
  }

  /**
   * Discussion privée entre deux utilisateurs, ou celle qui existe déjà.
   */
  private async privateConversation(first: User, second: User) {
    const privateKey = [first.id, second.id].sort((a, b) => a - b).join('-')

    const existing = await Conversation.findBy('private_key', privateKey)
    if (existing) {
      return { conversation: existing, created: false }
    }

    const conversation = await Conversation.create({
      type: 'private',
      privateKey,
      createdBy: first.id,
    })

    await ConversationMember.createMany([
      { conversationId: conversation.id, userId: first.id, role: 'member' },
      { conversationId: conversation.id, userId: second.id, role: 'member' },
    ])

    return { conversation, created: true }
  }

  /**
   * Enregistre un message envoyé il y a `minutesAgo` minutes. Les messages
   * doivent être créés du plus ancien au plus récent.
   */
  private async say(conversation: Conversation, sender: User, body: string, minutesAgo: number) {
    const sentAt = DateTime.now().minus({ minutes: minutesAgo }).toJSDate()

    const message = await Message.create({
      conversationId: conversation.id,
      senderId: sender.id,
      body,
    })

    await Message.query().where('id', message.id).update({ created_at: sentAt })
    await Conversation.query().where('id', conversation.id).update({ last_message_at: sentAt })

    return message
  }

  /**
   * Marque tous les messages de la conversation comme reçus et lus par ces
   * utilisateurs.
   */
  private async markRead(conversation: Conversation, readers: User[]) {
    const latest = await Message.query()
      .where('conversation_id', conversation.id)
      .orderBy('id', 'desc')
      .first()
    if (!latest) {
      return
    }

    await ConversationMember.query()
      .where('conversation_id', conversation.id)
      .whereIn(
        'user_id',
        readers.map((reader) => reader.id)
      )
      .update({ last_read_message_id: latest.id, last_delivered_message_id: latest.id })
  }
}
