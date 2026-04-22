# Настройка Firebase для MaxQuiz

## 1. Настройка Realtime Database

### Правила безопасности

В консоли Firebase перейдите в Realtime Database > Правила и установите следующие правила:

```json
{
  "rules": {
    "sessions": {
      "$gameId": {
        ".read": true,
        ".write": true,
        "players": {
          "$playerId": {
            ".read": true,
            ".write": true
          }
        },
        "chat": {
          ".read": true,
          ".write": true,
          "$messageId": {
            ".read": true,
            ".write": true
          }
        }
      }
    }
  }
}
```

## 2. Настройка Firestore

### Правила безопасности

В консоли Firebase перейдите в Firestore Database > Правила и установите следующие правила:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Правила для игр
    match /games/{gameId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Правила для пользователей
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 3. Настройка Authentication

Включите следующие провайдеры аутентификации:
- Email/Password
- Google

## 4. Переменные окружения

Создайте файл `.env.local` в корне проекта:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
