# Schéma de la base de données

Kadea Chat utilise **PostgreSQL**. Le schéma est géré par les migrations AdonisJS (`database/migrations`) ;
le fichier `database/schema.ts` est généré automatiquement à partir d'elles.

## Diagramme

```mermaid
erDiagram
    USERS ||--o{ AUTH_TOKENS : "possède"
    USERS ||--o{ REMEMBER_ME_TOKENS : "possède"
    USERS ||--o{ CONVERSATION_MEMBERS : "participe à"
    CONVERSATIONS ||--o{ CONVERSATION_MEMBERS : "regroupe"
    USERS ||--o{ CONVERSATIONS : "crée"
    CONVERSATIONS ||--o{ MESSAGES : "contient"
    USERS ||--o{ MESSAGES : "envoie"
    MESSAGES ||--o{ MESSAGE_ATTACHMENTS : "porte"
    MESSAGES ||--o{ MESSAGE_DELETIONS : "est masqué par"
    USERS ||--o{ MESSAGE_DELETIONS : "masque pour lui"
    USERS ||--o{ USER_BLOCKS : "bloque"
    USERS ||--o{ USER_BLOCKS : "est bloqué"

    USERS {
        int id PK
        string full_name
        string email UK
        string password "haché"
        string avatar_path
        timestamp email_verified_at "null = non confirmé"
        timestamp last_seen_at "sert à la présence en ligne"
        timestamp created_at
        timestamp updated_at
    }

    AUTH_TOKENS {
        int id PK
        int user_id FK
        string type "confirmation e-mail ou réinitialisation"
        string token_hash
        timestamp expires_at
        timestamp used_at
        timestamp created_at
    }

    REMEMBER_ME_TOKENS {
        int id PK
        int tokenable_id FK
        string hash
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }

    CONVERSATIONS {
        int id PK
        string type "private ou group"
        string name "nom du groupe"
        string private_key UK "ex. 3-7, une seule discussion privée par paire"
        string avatar_path "photo du groupe"
        int created_by FK
        timestamp last_message_at "sert au tri de la liste"
        timestamp created_at
        timestamp updated_at
    }

    CONVERSATION_MEMBERS {
        int id PK
        int conversation_id FK
        int user_id FK
        string role "admin ou member"
        int last_delivered_message_id "dernier message reçu"
        int last_read_message_id "dernier message lu"
        timestamp joined_at
    }

    MESSAGES {
        int id PK
        int conversation_id FK
        int sender_id FK
        text body
        timestamp edited_at
        timestamp deleted_at "supprimé pour tous"
        timestamp silenced_at "message d'un utilisateur bloqué, jamais remis"
        timestamp created_at
        timestamp updated_at
    }

    MESSAGE_ATTACHMENTS {
        int id PK
        int message_id FK
        string original_name
        string storage_path
        string mime_type
        int size_bytes
        timestamp created_at
    }

    MESSAGE_DELETIONS {
        int id PK
        int message_id FK
        int user_id FK
        timestamp created_at
    }

    USER_BLOCKS {
        int id PK
        int blocker_id FK "celui qui bloque"
        int blocked_id FK "celui qui est bloqué"
        timestamp created_at
    }

    RATE_LIMITS {
        string key PK
        int points
        bigint expire
    }
```

## Rôle des tables

| Table                  | Rôle                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                | Les comptes. Le mot de passe est haché ; `email_verified_at` reste vide tant que l'adresse n'est pas confirmée (connexion refusée).            |
| `auth_tokens`          | Jetons à usage unique pour la confirmation de l'e-mail et la réinitialisation du mot de passe. Seul le hachage du jeton est conservé.          |
| `remember_me_tokens`   | Jetons de la case « se souvenir de moi ».                                                                                                      |
| `conversations`        | Une ligne par discussion, privée ou groupe. `private_key` (unique) empêche deux discussions privées entre les mêmes personnes.                 |
| `conversation_members` | Les membres d'une conversation, avec leur rôle (`admin` / `member`) et deux repères (dernier message reçu, dernier message lu) pour les traits. |
| `messages`             | Les messages. La suppression « pour tous » est logique (`deleted_at`) : le texte est vidé et une indication apparaît à sa place.               |
| `message_attachments`  | Les fichiers joints (images, vidéos, PDF, TXT, ZIP) ; le fichier lui-même est dans le stockage S3.                                             |
| `message_deletions`    | « Supprimer pour moi » : le message est masqué pour un seul utilisateur. Sert aussi à cacher les messages d'un utilisateur bloqué.             |
| `user_blocks`          | Les blocages : `blocker_id` a bloqué `blocked_id`.                                                                                             |
| `rate_limits`          | Compteurs du limiteur de requêtes (protection contre les abus).                                                                                |

## Règles d'accès

- Une conversation n'est accessible qu'à ses membres (`conversation_members`). Pour tout autre utilisateur, la réponse est « page introuvable », comme si la conversation n'existait pas.
- Chaque lecture de messages ignore les messages masqués par l'utilisateur (`message_deletions`).
