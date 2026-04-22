import { db } from "@/lib/firebase/config"
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import type { UserSession } from "@/types/game"

class UserSessionService {
  async createSession(userId: string, sessionData: Partial<UserSession>): Promise<void> {
    try {
      const sessionRef = doc(db, "userSessions", userId)
      await setDoc(sessionRef, {
        ...sessionData,
        userId,
        createdAt: Date.now(),
        lastActive: Date.now(),
      })
    } catch (error) {
      console.error("Error creating session:", error)
      throw error
    }
  }

  async updateSession(userId: string, updates: Partial<UserSession>): Promise<void> {
    try {
      const sessionRef = doc(db, "userSessions", userId)
      await updateDoc(sessionRef, {
        ...updates,
        lastActive: Date.now(),
      })
    } catch (error) {
      console.error("Error updating session:", error)
      throw error
    }
  }

  async getSession(userId: string): Promise<UserSession | null> {
    try {
      const sessionRef = doc(db, "userSessions", userId)
      const sessionDoc = await getDoc(sessionRef)

      if (sessionDoc.exists()) {
        return sessionDoc.data() as UserSession
      }
      return null
    } catch (error) {
      console.error("Error getting session:", error)
      return null
    }
  }

  async endSession(userId: string): Promise<void> {
    try {
      const sessionRef = doc(db, "userSessions", userId)
      await updateDoc(sessionRef, {
        active: false,
        endedAt: Date.now(),
      })
    } catch (error) {
      console.error("Error ending session:", error)
      throw error
    }
  }
}

export default new UserSessionService()
