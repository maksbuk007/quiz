import { db } from "@/lib/firebase/config"
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from "firebase/firestore"
import type { UserSessionLog, AdminUserAnalytics } from "@/types/admin"

class AdminAnalyticsServiceClass {
  // Получить список всех пользователей с статистикой
  async getAllUsersAnalytics(limitCount = 100): Promise<AdminUserAnalytics[]> {
    try {
      const usersRef = collection(db, "users")
      const usersSnapshot = await getDocs(usersRef)

      const usersData = await Promise.all(
        usersSnapshot.docs.map(async (userDoc) => {
          const userData = userDoc.data()
          const userId = userDoc.id

          // Получаем статистику
          const statsDoc = await getDoc(doc(db, "users", userId, "stats", "global"))
          const stats = statsDoc.exists() ? statsDoc.data() : null

          // Получаем достижения
          const achievementsRef = collection(db, "users", userId, "achievements")
          const achievementsSnapshot = await getDocs(achievementsRef)
          const achievementsCount = achievementsSnapshot.size

          // Получаем логи сессий
          const sessionsRef = collection(db, "users", userId, "sessions")
          const sessionsQuery = query(sessionsRef, orderBy("loginTime", "desc"), limit(10))
          const sessionsSnapshot = await getDocs(sessionsQuery)

          const sessions: UserSessionLog[] = sessionsSnapshot.docs.map((doc) => ({
            sessionId: doc.id,
            ...doc.data(),
          })) as UserSessionLog[]

          const lastSession = sessions[0] || null

          return {
            userId,
            email: userData.email || "",
            nickname: userData.nickname || "Unknown",
            avatar: userData.avatar || "",
            createdAt: userData.createdAt || Date.now(),
            lastLogin: lastSession?.loginTime || null,
            lastIP: lastSession?.ipAddress || null,
            lastDevice: lastSession?.device || null,
            lastLocation: lastSession?.location || null,
            totalSessions: sessions.length,
            stats: stats
              ? {
                  gamesPlayed: stats.gamesPlayed || 0,
                  gamesCreated: stats.gamesCreated || 0,
                  totalScore: stats.totalScore || 0,
                  averageScore: stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0,
                  accuracyPercentage: stats.totalAnswers > 0 ? (stats.correctAnswers / stats.totalAnswers) * 100 : 0,
                  perfectGames: stats.perfectGames || 0,
                  currentWinStreak: stats.currentWinStreak || 0,
                  bestWinStreak: stats.bestWinStreak || 0,
                  totalWins: stats.totalWins || 0,
                }
              : null,
            achievementsCount,
            sessions,
            isAdmin: userData.isAdmin || false,
          }
        }),
      )

      return usersData.slice(0, limitCount)
    } catch (error) {
      console.error("Error getting all users analytics:", error)
      return []
    }
  }

  // Получить детальную информацию о пользователе
  async getUserDetails(userId: string): Promise<AdminUserAnalytics | null> {
    try {
      const userDoc = await getDoc(doc(db, "users", userId))
      if (!userDoc.exists()) return null

      const userData = userDoc.data()

      // Получаем статистику
      const statsDoc = await getDoc(doc(db, "users", userId, "stats", "global"))
      const stats = statsDoc.exists() ? statsDoc.data() : null

      // Получаем достижения
      const achievementsRef = collection(db, "users", userId, "achievements")
      const achievementsSnapshot = await getDocs(achievementsRef)
      const achievementsCount = achievementsSnapshot.size

      // Получаем все сессии
      const sessionsRef = collection(db, "users", userId, "sessions")
      const sessionsQuery = query(sessionsRef, orderBy("loginTime", "desc"))
      const sessionsSnapshot = await getDocs(sessionsQuery)

      const sessions: UserSessionLog[] = sessionsSnapshot.docs.map((doc) => ({
        sessionId: doc.id,
        ...doc.data(),
      })) as UserSessionLog[]

      const lastSession = sessions[0] || null

      return {
        userId,
        email: userData.email || "",
        nickname: userData.nickname || "Unknown",
        avatar: userData.avatar || "",
        createdAt: userData.createdAt || Date.now(),
        lastLogin: lastSession?.loginTime || null,
        lastIP: lastSession?.ipAddress || null,
        lastDevice: lastSession?.device || null,
        lastLocation: lastSession?.location || null,
        totalSessions: sessions.length,
        stats: stats
          ? {
              gamesPlayed: stats.gamesPlayed || 0,
              gamesCreated: stats.gamesCreated || 0,
              totalScore: stats.totalScore || 0,
              averageScore: stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0,
              accuracyPercentage: stats.totalAnswers > 0 ? (stats.correctAnswers / stats.totalAnswers) * 100 : 0,
              perfectGames: stats.perfectGames || 0,
              currentWinStreak: stats.currentWinStreak || 0,
              bestWinStreak: stats.bestWinStreak || 0,
              totalWins: stats.totalWins || 0,
            }
          : null,
        achievementsCount,
        sessions,
        isAdmin: userData.isAdmin || false,
      }
    } catch (error) {
      console.error("Error getting user details:", error)
      return null
    }
  }

  // Получить общую статистику платформы
  async getPlatformStats() {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const totalUsers = usersSnapshot.size

      const gamesSnapshot = await getDocs(collection(db, "games"))
      const totalGames = gamesSnapshot.size

      const historySnapshot = await getDocs(collection(db, "gameHistory"))
      const totalSessions = historySnapshot.size

      // Активные пользователи за последнюю неделю
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const activeUsersSet = new Set<string>()

      historySnapshot.docs.forEach((doc) => {
        const data = doc.data()
        if (data.endedAt?.toMillis() > weekAgo) {
          data.players?.forEach((playerId: string) => activeUsersSet.add(playerId))
        }
      })

      const activeUsersWeek = activeUsersSet.size

      return {
        totalUsers,
        totalGames,
        totalSessions,
        activeUsersWeek,
      }
    } catch (error) {
      console.error("Error getting platform stats:", error)
      return {
        totalUsers: 0,
        totalGames: 0,
        totalSessions: 0,
        activeUsersWeek: 0,
      }
    }
  }
}

const AdminAnalyticsService = new AdminAnalyticsServiceClass()
export default AdminAnalyticsService
