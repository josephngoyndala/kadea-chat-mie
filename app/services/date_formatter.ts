import { DateTime } from 'luxon'

/**
 * Fuseau et langue d'affichage des dates : ceux des utilisateurs de
 * Kadea Chat, quel que soit le fuseau du serveur.
 */
const ZONE = 'Africa/Kinshasa'
const LOCALE = 'fr'

function local(date: DateTime) {
  return date.setZone(ZONE).setLocale(LOCALE)
}

/**
 * Nombre de jours calendaires entre la date et aujourd'hui (0 = aujourd'hui).
 */
function daysAgo(date: DateTime) {
  const today = DateTime.now().setZone(ZONE).startOf('day')
  return Math.round(today.diff(local(date).startOf('day'), 'days').days)
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Heure d'un message : « 14:32 ».
 */
export function formatMessageTime(date: DateTime) {
  return local(date).toFormat('HH:mm')
}

/**
 * Date courte de la liste des conversations : l'heure aujourd'hui,
 * « Hier », le jour de la semaine, puis la date complète.
 */
export function formatListDate(date: DateTime) {
  const days = daysAgo(date)

  if (days <= 0) {
    return formatMessageTime(date)
  }
  if (days === 1) {
    return 'Hier'
  }
  if (days < 7) {
    return capitalize(local(date).toFormat('cccc'))
  }
  return local(date).toFormat('dd/MM/yyyy')
}

/**
 * Intitulé d'un jour dans l'historique d'une conversation.
 */
export function formatDayLabel(date: DateTime) {
  const days = daysAgo(date)

  if (days <= 0) {
    return "Aujourd'hui"
  }
  if (days === 1) {
    return 'Hier'
  }
  return capitalize(local(date).toFormat('cccc d LLLL yyyy'))
}

/**
 * Date courte et lisible : « 12 oct. 2026 ».
 */
export function formatShortDate(date: DateTime) {
  return local(date).toFormat('d LLL yyyy')
}

/**
 * Clé de regroupement par jour (dans le fuseau de l'application).
 */
export function dayKey(date: DateTime) {
  return local(date).toISODate() ?? ''
}
