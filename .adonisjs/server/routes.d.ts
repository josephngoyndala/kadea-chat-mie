import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'email_verification.notice': { paramsTuple?: []; params?: {} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'email_verification.resend': { paramsTuple?: []; params?: {} }
    'password_reset.create': { paramsTuple?: []; params?: {} }
    'password_reset.store': { paramsTuple?: []; params?: {} }
    'password_reset.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'password_reset.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'session.ping': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.card': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.typing': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.store': { paramsTuple?: []; params?: {} }
    'groups.create': { paramsTuple?: []; params?: {} }
    'groups.store': { paramsTuple?: []; params?: {} }
    'group_members.index': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'group_members.store': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'group_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'userId': ParamValue} }
    'messages.index': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'messages.show': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'messageId': ParamValue} }
    'messages.store': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'messages.update': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'messageId': ParamValue} }
    'messages.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'messageId': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.update_avatar': { paramsTuple?: []; params?: {} }
    'profile.destroy_avatar': { paramsTuple?: []; params?: {} }
    'profile.update_password': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'email_verification.notice': { paramsTuple?: []; params?: {} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'password_reset.create': { paramsTuple?: []; params?: {} }
    'password_reset.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.card': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.create': { paramsTuple?: []; params?: {} }
    'group_members.index': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'messages.index': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'messages.show': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'messageId': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'email_verification.notice': { paramsTuple?: []; params?: {} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'password_reset.create': { paramsTuple?: []; params?: {} }
    'password_reset.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.card': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.create': { paramsTuple?: []; params?: {} }
    'group_members.index': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'messages.index': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'messages.show': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'messageId': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'email_verification.resend': { paramsTuple?: []; params?: {} }
    'password_reset.store': { paramsTuple?: []; params?: {} }
    'password_reset.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'session.ping': { paramsTuple?: []; params?: {} }
    'conversations.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.typing': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.store': { paramsTuple?: []; params?: {} }
    'groups.store': { paramsTuple?: []; params?: {} }
    'group_members.store': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'group_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'userId': ParamValue} }
    'messages.store': { paramsTuple: [ParamValue]; params: {'conversationId': ParamValue} }
    'messages.update': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'messageId': ParamValue} }
    'messages.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'conversationId': ParamValue,'messageId': ParamValue} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.update_avatar': { paramsTuple?: []; params?: {} }
    'profile.destroy_avatar': { paramsTuple?: []; params?: {} }
    'profile.update_password': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}