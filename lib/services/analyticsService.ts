import { db } from "@/lib/firebase/config"
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  query,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore"
import type { GameAnalytics, PlayerAnalytics } from "@/types/analytics"

class AnalyticsService {
  async trackGameStart(gameId: string, hostId: string): Promise<void> {
    try {
      const analyticsRef = doc(db, "analytics", gameId)
      await setDoc(analyticsRef, {
        gameId,
        hostId,
        startTime: Date.now(),
        totalPlayers: 0,
        completedPlayers: 0,
        averageScore: 0,
        questionStats: {},
        createdAt: Date.now(),
      })
    } catch (error) {
      console.error("Error tracking game start:", error)
    }
  }

  async trackGameEnd(gameId: string, stats: Partial<GameAnalytics>): Promise<void> {
    try {
      const analyticsRef = doc(db, "analytics", gameId)
      await updateDoc(analyticsRef, {
        ...stats,
        endTime: Date.now(),
        updatedAt: Date.now(),
      })
    } catch (error) {
      console.error("Error tracking game end:", error)
    }
  }

  async trackPlayerJoin(gameId: string, playerId: string): Promise<void> {
    try {
      const analyticsRef = doc(db, "analytics", gameId)
      await updateDoc(analyticsRef, {
        totalPlayers: increment(1),
        updatedAt: Date.now(),
      })
    } catch (error) {
      console.error("Error tracking player join:", error)
    }
  }

  async trackPlayerAnswer(
    gameId: string,
    playerId: string,
    questionId: string,
    isCorrect: boolean,
    responseTime: number,
  ): Promise<void> {
    try {
      const analyticsRef = doc(db, "analytics", gameId)
      const analyticsDoc = await getDoc(analyticsRef)

      if (analyticsDoc.exists()) {
        const data = analyticsDoc.data()
        const questionStats = data.questionStats || {}

        if (!questionStats[questionId]) {
          questionStats[questionId] = {
            totalAnswers: 0,
            correctAnswers: 0,
            averageTime: 0,
          }
        }

        const stats = questionStats[questionId]
        const newTotal = stats.totalAnswers + 1
        const newCorrect = isCorrect ? stats.correctAnswers + 1 : stats.correctAnswers
        const newAvgTime = (stats.averageTime * stats.totalAnswers + responseTime) / newTotal

        questionStats[questionId] = {
          totalAnswers: newTotal,
          correctAnswers: newCorrect,
          averageTime: newAvgTime,
        }

        await updateDoc(analyticsRef, {
          questionStats,
          updatedAt: Date.now(),
        })
      }
    } catch (error) {
      console.error("Error tracking player answer:", error)
    }
  }

  async getGameAnalytics(gameId: string): Promise<GameAnalytics | null> {
    try {
      const analyticsRef = doc(db, "analytics", gameId)
      const analyticsDoc = await getDoc(analyticsRef)

      if (analyticsDoc.exists()) {
        return analyticsDoc.data() as GameAnalytics
      }
      return null
    } catch (error) {
      console.error("Error getting game analytics:", error)
      return null
    }
  }

  async getPlayerAnalytics(playerId: string): Promise<PlayerAnalytics | null> {
    try {
      const playerRef = doc(db, "playerAnalytics", playerId)
      const playerDoc = await getDoc(playerRef)

      if (playerDoc.exists()) {
        return playerDoc.data() as PlayerAnalytics
      }
      return null
    } catch (error) {
      console.error("Error getting player analytics:", error)
      return null
    }
  }

  async getTopPlayers(limitCount = 10): Promise<PlayerAnalytics[]> {
    try {
      const q = query(collection(db, "playerAnalytics"), orderBy("totalScore", "desc"), limit(limitCount))

      const snapshot = await getDocs(q)
      return snapshot.docs.map((doc) => doc.data() as PlayerAnalytics)
    } catch (error) {
      console.error("Error getting top players:", error)
      return []
    }
  }
}

export default new AnalyticsService()
export { AnalyticsService }
