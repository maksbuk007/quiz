import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getDatabase } from "firebase/database"
import { getAuth } from "firebase/auth"

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()

// Initialize services with proper error handling
let db: any = null
let realtimeDb: any = null
let auth: any = null

try {
  // Initialize Firestore
  db = getFirestore(app)
  console.log("Firestore инициализирован успешно")

  // Initialize Realtime Database
  realtimeDb = getDatabase(app)
  console.log("Realtime Database инициализирован успешно")

  // Initialize Auth
  auth = getAuth(app)
  console.log("Auth инициализирован успешно")

  // Set up emulators in development (only if not already connected)
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    // Uncomment these lines if you want to use Firebase emulators
    // try {
    //   connectFirestoreEmulator(db, 'localhost', 8080)
    //   connectDatabaseEmulator(realtimeDb, 'localhost', 9000)
    //   connectAuthEmulator(auth, 'http://localhost:9099')
    // } catch (error) {
    //   console.log("Emulators already connected or not available")
    // }
  }
} catch (error) {
  console.error("Firebase initialization error:", error)

  // Fallback initialization
  try {
    db = getFirestore()
    realtimeDb = getDatabase()
    auth = getAuth()
  } catch (fallbackError) {
    console.error("Fallback Firebase initialization failed:", fallbackError)
  }
}

// Ensure services are available
if (!db) {
  console.error("Firestore не удалось инициализировать")
}
if (!realtimeDb) {
  console.error("Realtime Database не удалось инициализировать")
}
if (!auth) {
  console.error("Auth не удалось инициализировать")
}

export { db, realtimeDb, auth }
export default app
