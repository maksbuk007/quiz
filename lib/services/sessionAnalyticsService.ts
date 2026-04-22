import { collection, addDoc, query, where, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { Game, GameSession } from "@/types/game"
import type {
  SessionRecord,
  SessionPlayerRecord,
  SessionQuestionStats,
  SessionOverallStats,
} from "@/types/sessionAnalytics"

export class SessionAnalyticsService {
  private static removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: any = {}
    Object.keys(obj).forEach((key) => {
      const value = obj[key]
      if (value !== undefined) {
        if (Array.isArray(value)) {
          cleaned[key] = value.map((item) =>
            typeof item === "object" && item !== null ? this.removeUndefinedFields(item) : item,
          )
        } else if (typeof value === "object" && value !== null) {
          cleaned[key] = this.removeUndefinedFields(value)
        } else {
          cleaned[key] = value
        }
      }
    })
    return cleaned
  }

  // Save a completed session to Firestore
  static async saveCompletedSession(game: Game, session: GameSession): Promise<string> {
    try {
      if (!session.startTime) {
        throw new Error("Session has no start time - game was never started")
      }

      if (!session.sessionId) {
        throw new Error("Session has no sessionId")
      }

      const players = Object.values(session.players || {}).filter((p) => {
        // Skip host
        if (p.id === "host" || p.nickname === "Host") return false
        // Keep all other players that have answered at least one question
        return (p.answers && p.answers.length > 0) || p.score > 0
      })

      if (players.length === 0) {
        throw new Error("No players to save")
      }

      // Sort players by score
      const sortedPlayers = players.sort((a, b) => b.score - a.score)

      // Helper: normalize the "answer" field across classic/self-paced modes.
      // Classic stores `answer`; self-paced historically used `selectedAnswers`/`textAnswer`.
      const getRawAnswer = (a: any): any => {
        if (a == null) return null
        if (a.answer !== undefined) return a.answer
        if (Array.isArray(a.selectedAnswers)) return a.selectedAnswers
        if (a.selectedOption !== undefined) return a.selectedOption
        if (a.textAnswer !== undefined) return a.textAnswer
        if (a.answerText !== undefined) return a.answerText
        return null
      }

      // Create player records
      const playerRecords: SessionPlayerRecord[] = sortedPlayers.map((player, index) => {
        const playerAnswers = player.answers || []
        const correctCount = playerAnswers.filter((a) => a.isCorrect).length
        const totalTime = playerAnswers.reduce((sum, a) => sum + a.timeSpent, 0)

        const record: any = {
          playerId: player.id,
          nickname: player.nickname || player.name || "Unknown",
          finalScore: player.score,
          correctAnswers: correctCount,
          totalAnswers: playerAnswers.length,
          accuracy: playerAnswers.length > 0 ? Math.round((correctCount / playerAnswers.length) * 100) : 0,
          averageTimePerQuestion: playerAnswers.length > 0 ? Math.round(totalTime / playerAnswers.length / 1000) : 0,
          totalTimeSpent: Math.round(totalTime / 1000),
          rank: index + 1,
          answers: playerAnswers.map((answer) => {
            const raw = getRawAnswer(answer)
            const record: any = {
              questionId: answer.questionId,
              questionIndex: game.questions.findIndex((q) => q.id === answer.questionId),
              answer: raw,
              isCorrect: !!answer.isCorrect,
              timeSpent: answer.timeSpent ?? 0,
              points: answer.points || 0,
            }
            // Keep legacy fields for backward compatibility with exporters.
            if (typeof raw === "number" || Array.isArray(raw)) {
              record.selectedOption = raw
            }
            if (typeof raw === "string") {
              record.answerText = raw
            }
            return record
          }),
        }

        // Only add avatar if it exists
        if (player.avatar) {
          record.avatar = player.avatar
        }

        return record as SessionPlayerRecord
      })

      // Create question statistics
      const questionStats: SessionQuestionStats[] = game.questions.map((question, index) => {
        const allAnswers = players.flatMap((p) => (p.answers || []).filter((a) => a.questionId === question.id))

        const correctAnswers = allAnswers.filter((a) => a.isCorrect).length
        const totalAnswers = allAnswers.length

        const answerDistribution: Record<string, number> = {}

        if (question.type === "TEXT_INPUT") {
          // For text input, group by actual text answers
          allAnswers.forEach((answer) => {
            const raw = getRawAnswer(answer)
            const answerText =
              typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "Нет ответа"
            answerDistribution[answerText] = (answerDistribution[answerText] || 0) + 1
          })
        } else if (question.options) {
          // For multiple choice questions, track each option selection across all players.
          // Normalize the answer field from any of the legacy shapes.
          question.options.forEach((option, optIndex) => {
            const count = allAnswers.filter((a) => {
              const raw = getRawAnswer(a)
              if (Array.isArray(raw)) return raw.includes(optIndex)
              if (typeof raw === "number") return raw === optIndex
              if (typeof raw === "boolean") return (raw ? 0 : 1) === optIndex
              if (typeof raw === "string") {
                const parsed = Number.parseInt(raw, 10)
                return !Number.isNaN(parsed) && parsed === optIndex
              }
              return false
            }).length
            // Always include option even if count is 0 for percentage calculations
            answerDistribution[option] = count
          })
        }

        return {
          questionId: question.id,
          questionIndex: index,
          questionText: question.question,
          type: question.type,
          totalAnswers,
          correctAnswers,
          accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
          averageTime:
            totalAnswers > 0
              ? Math.round(allAnswers.reduce((sum, a) => sum + a.timeSpent, 0) / totalAnswers / 1000)
              : 0,
          answerDistribution,
        }
      })

      // Calculate overall statistics
      const scores = playerRecords.map((p) => p.finalScore)
      const sortedScores = [...scores].sort((a, b) => a - b)
      const medianScore =
        sortedScores.length % 2 === 0
          ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
          : sortedScores[Math.floor(sortedScores.length / 2)]

      const overallStats: SessionOverallStats = {
        averageScore:
          playerRecords.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / playerRecords.length) : 0,
        averageAccuracy:
          playerRecords.length > 0
            ? Math.round(playerRecords.reduce((sum, p) => sum + p.accuracy, 0) / playerRecords.length)
            : 0,
        averageTime:
          playerRecords.length > 0
            ? Math.round(playerRecords.reduce((sum, p) => sum + p.totalTimeSpent, 0) / playerRecords.length)
            : 0,
        completionRate:
          players.length > 0
            ? Math.round(
                (players.filter((p) => (p.answers?.length || 0) === game.questions.length).length / players.length) *
                  100,
              )
            : 0,
        highestScore: Math.max(...scores, 0),
        lowestScore: Math.min(...scores, 0),
        medianScore: Math.round(medianScore),
      }

      const completedAt = session.completedAt || Date.now()
      const duration = Math.round((completedAt - session.startTime) / 1000)

      const sessionData: any = {
        gameId: game.id,
        gameCode: game.code || "",
        gameTitle: game.title,
        startedAt: session.startTime,
        completedAt: completedAt,
        duration: duration,
        playerCount: players.length,
        questionCount: game.questions.length,
        players: playerRecords,
        questionStats,
        overallStats,
      }

      // Only add optional fields if they exist
      if (game.createdBy) {
        sessionData.hostId = game.createdBy
      } else if (session.hostId) {
        sessionData.hostId = session.hostId
      }

      if (game.hostEmail) {
        sessionData.hostEmail = game.hostEmail
      }

      // Remove any remaining undefined fields (deep clean)
      const cleanedSessionData = this.removeUndefinedFields(sessionData)

      // Save to Firestore
      const docRef = await addDoc(collection(db, "game_sessions"), cleanedSessionData)

      return docRef.id
    } catch (error) {
      console.error("Error saving completed session:", error)
      throw error
    }
  }

  // Get all sessions for a specific game
  static async getGameSessions(gameId: string): Promise<SessionRecord[]> {
    try {
      if (!gameId) {
        console.error("No gameId provided")
        return []
      }

      const q = query(collection(db, "game_sessions"), where("gameId", "==", gameId), orderBy("completedAt", "desc"))

      const querySnapshot = await getDocs(q)
      const sessions: SessionRecord[] = []

      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data(),
        } as SessionRecord)
      })

      return sessions
    } catch (error: any) {
      console.error("Error fetching game sessions:", error)

      if (error.code === "failed-precondition" || error.message?.includes("index")) {
        console.error("Firebase index required for collection: game_sessions, fields: gameId, completedAt")
      }

      return []
    }
  }

  // Get all sessions created by a user
  static async getUserSessions(hostId: string): Promise<SessionRecord[]> {
    try {
      const q = query(collection(db, "game_sessions"), where("hostId", "==", hostId), orderBy("completedAt", "desc"))

      const querySnapshot = await getDocs(q)
      const sessions: SessionRecord[] = []

      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data(),
        } as SessionRecord)
      })

      return sessions
    } catch (error) {
      console.error("Error fetching user sessions:", error)
      return []
    }
  }

  // Get all sessions (for creators)
  static async getAllSessions(): Promise<SessionRecord[]> {
    try {
      const q = query(collection(db, "game_sessions"), orderBy("completedAt", "desc"))

      const querySnapshot = await getDocs(q)
      const sessions: SessionRecord[] = []

      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data(),
        } as SessionRecord)
      })

      return sessions
    } catch (error) {
      console.error("Error fetching all sessions:", error)
      return []
    }
  }

  // Delete a session record
  static async deleteSession(gameId: string, sessionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "game_sessions", sessionId))
      console.log(`[v0] Session ${sessionId} deleted successfully`)
    } catch (error) {
      console.error("Error deleting session:", error)
      throw error
    }
  }
}
