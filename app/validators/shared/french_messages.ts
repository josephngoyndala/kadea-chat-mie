import { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Messages d'erreur de validation en français, partagés par tous les
 * validateurs de l'application.
 */
export function frenchMessages() {
  return new SimpleMessagesProvider(
    {
      'required': 'Le champ {{ field }} est obligatoire.',
      'string': 'Le champ {{ field }} doit être un texte.',
      'email': 'Saisissez une adresse e-mail valide.',
      'minLength': 'Le champ {{ field }} doit contenir au moins {{ min }} caractères.',
      'maxLength': 'Le champ {{ field }} ne doit pas dépasser {{ max }} caractères.',
      'accepted': 'Vous devez accepter les {{ field }}.',
      'database.unique': 'Cette valeur de {{ field }} est déjà utilisée.',
      'email.database.unique': 'Cette adresse e-mail est déjà utilisée.',
      'passwordConfirmation.sameAs': 'Les mots de passe ne correspondent pas.',
    },
    {
      fullName: 'nom complet',
      email: 'adresse e-mail',
      password: 'mot de passe',
      passwordConfirmation: 'confirmation du mot de passe',
      acceptTerms: "conditions d'utilisation",
    }
  )
}
