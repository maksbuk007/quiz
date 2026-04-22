import { ref, set, get, update } from "firebase/database"
import { realtimeDb } from "@/lib/firebase/config"

export interface GuestStats {
  guestId: string
  nickname: string
  gamesPlayed: number
  totalScore: number
  bestScore: number
  averageScore: number
  correctAnswers: number
  totalAnswers: number
  accuracy: number
  fastestAnswer: number
  chatMessages: number
  lastPlayed: number
  createdAt: number
}

export class GuestStatsService {
  static generateGuestId(): string {
    return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  static async getGuestStats(guestId: string): Promise<GuestStats | null> {
    try {
      const statsRef = ref(realtimeDb, `guest_stats/${guestId}`)
      const snapshot = await get(statsRef)

      if (snapshot.exists()) {
        return snapshot.val()
      }

      return null
    } catch (error) {
      console.error("Ошибка получения статистики гостя:", error)
      return null
    }
  }

  static async createGuestStats(guestId: string, nickname: string): Promise<GuestStats> {
    const guestStats: GuestStats = {
      guestId,
      nickname,
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      averageScore: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      accuracy: 0,
      fastestAnswer: 0,
      chatMessages: 0,
      lastPlayed: Date.now(),
      createdAt: Date.now(),
    }

    try {
      const statsRef = ref(realtimeDb, `guest_stats/${guestId}`)
      await set(statsRef, guestStats)
      return guestStats
    } catch (error) {
      console.error("Ошибка создания статистики гостя:", error)
      return guestStats
    }
  }

  static async updateGuestStats(guestId: string, updates: Partial<GuestStats>): Promise<void> {
    try {
      const statsRef = ref(realtimeDb, `guest_stats/${guestId}`)
      await update(statsRef, {
        ...updates,
        lastPlayed: Date.now(),
      })
    } catch (error) {
      console.error("Ошибка обновления статистики гостя:", error)
    }
  }

  static async updateGameStats(
    guestId: string,
    gameScore: number,
    correctAnswers: number,
    totalAnswers: number,
    fastestAnswer?: number,
  ): Promise<void> {
    try {
      const currentStats = await this.getGuestStats(guestId)
      if (!currentStats) return

      const newGamesPlayed = currentStats.gamesPlayed + 1
      const newTotalScore = currentStats.totalScore + gameScore
      const newBestScore = Math.max(currentStats.bestScore, gameScore)
      const newAverageScore = Math.round(newTotalScore / newGamesPlayed)
      const newCorrectAnswers = currentStats.correctAnswers + correctAnswers
      const newTotalAnswers = currentStats.totalAnswers + totalAnswers
      const newAccuracy = newTotalAnswers > 0 ? Math.round((newCorrectAnswers / newTotalAnswers) * 100) : 0
      const newFastestAnswer =
        fastestAnswer && (currentStats.fastestAnswer === 0 || fastestAnswer < currentStats.fastestAnswer)
          ? fastestAnswer
          : currentStats.fastestAnswer

      await this.updateGuestStats(guestId, {
        gamesPlayed: newGamesPlayed,
        totalScore: newTotalScore,
        bestScore: newBestScore,
        averageScore: newAverageScore,
        correctAnswers: newCorrectAnswers,
        totalAnswers: newTotalAnswers,
        accuracy: newAccuracy,
        fastestAnswer: newFastestAnswer,
      })
    } catch (error) {
      console.error("Ошибка обновления игровой статистики гостя:", error)
    }
  }

  static async incrementChatMessages(guestId: string): Promise<void> {
    try {
      const currentStats = await this.getGuestStats(guestId)
      if (!currentStats) return

      await this.updateGuestStats(guestId, {
        chatMessages: currentStats.chatMessages + 1,
      })
    } catch (error) {
      console.error("Ошибка обновления сообщений чата гостя:", error)
    }
  }
}
