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
      'number': 'La valeur du champ {{ field }} est invalide.',
      'positive': 'La valeur du champ {{ field }} est invalide.',
      'enum': 'La valeur du champ {{ field }} est invalide.',
      'array': 'La valeur du champ {{ field }} est invalide.',
      'email': 'Saisissez une adresse e-mail valide.',
      'minLength': 'Le champ {{ field }} doit contenir au moins {{ min }} caractères.',
      'maxLength': 'Le champ {{ field }} ne doit pas dépasser {{ max }} caractères.',
      'accepted': 'Vous devez accepter les {{ field }}.',
      'file': 'Sélectionnez une image valide.',
      'file.size': 'La photo est trop lourde (2 Mo maximum).',
      'file.extname': 'La photo doit être au format JPG, PNG ou WEBP.',
      'database.unique': 'Cette valeur de {{ field }} est déjà utilisée.',
      'email.database.unique': 'Cette adresse e-mail est déjà utilisée.',
      'passwordConfirmation.sameAs': 'Les mots de passe ne correspondent pas.',
      'memberIds.required': 'Choisissez au moins un membre.',
      'memberIds.array': 'Choisissez au moins un membre.',
      'memberIds.minLength': 'Choisissez au moins un membre.',
      'memberIds.maxLength': 'Un groupe ne peut pas dépasser 50 membres.',
    },
    {
      fullName: 'nom complet',
      email: 'adresse e-mail',
      password: 'mot de passe',
      currentPassword: 'mot de passe actuel',
      passwordConfirmation: 'confirmation du mot de passe',
      acceptTerms: "conditions d'utilisation",
      avatar: 'photo',
      userId: 'utilisateur',
      q: 'recherche',
      body: 'message',
      scope: 'type de suppression',
      name: 'nom du groupe',
      memberIds: 'membres',
    }
  )
}
