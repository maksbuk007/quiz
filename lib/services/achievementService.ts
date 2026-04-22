import { db } from "@/lib/firebase/config"
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs, serverTimestamp } from "firebase/firestore"
import type { Achievement, PlayerAchievement, AchievementRarity, PlayerStats } from "@/types/achievements"

// Achievement definitions
export const ACHIEVEMENTS: Achievement[] = [
  // Создание игр
  {
    id: "first_game",
    name: "Первая игра",
    description: "Создайте свою первую игру",
    icon: "🎮",
    category: "creation",
    rarity: "common",
    points: 10,
    condition: { type: "games_created", value: 1 },
  },
  {
    id: "game_creator",
    name: "Создатель игр",
    description: "Создайте 10 игр",
    icon: "🎯",
    category: "creation",
    rarity: "rare",
    points: 50,
    condition: { type: "games_created", value: 10 },
  },
  {
    id: "game_master",
    name: "Мастер игр",
    description: "Создайте 50 игр",
    icon: "👑",
    category: "creation",
    rarity: "epic",
    points: 200,
    condition: { type: "games_created", value: 50 },
  },
  {
    id: "game_legend",
    name: "Легенда создания",
    description: "Создайте 100 игр",
    icon: "🏆",
    category: "creation",
    rarity: "legendary",
    points: 500,
    condition: { type: "games_created", value: 100 },
  },

  // Игровой опыт
  {
    id: "first_play",
    name: "Первые шаги",
    description: "Сыграйте свою первую игру",
    icon: "▶️",
    category: "gameplay",
    rarity: "common",
    points: 10,
    condition: { type: "games_played", value: 1 },
  },
  {
    id: "newbie",
    name: "Новичок",
    description: "Сыграйте 5 игр",
    icon: "🌱",
    category: "gameplay",
    rarity: "common",
    points: 25,
    condition: { type: "games_played", value: 5 },
  },
  {
    id: "regular",
    name: "Постоянный игрок",
    description: "Сыграйте 25 игр",
    icon: "⚡",
    category: "gameplay",
    rarity: "rare",
    points: 50,
    condition: { type: "games_played", value: 25 },
  },
  {
    id: "experienced",
    name: "Опытный",
    description: "Сыграйте 50 игр",
    icon: "🔥",
    category: "gameplay",
    rarity: "super_rare",
    points: 100,
    condition: { type: "games_played", value: 50 },
  },
  {
    id: "veteran",
    name: "Ветеран",
    description: "Сыграйте 100 игр",
    icon: "🎖️",
    category: "gameplay",
    rarity: "epic",
    points: 200,
    condition: { type: "games_played", value: 100 },
  },
  {
    id: "master_player",
    name: "Мастер игры",
    description: "Сыграйте 250 игр",
    icon: "💎",
    category: "gameplay",
    rarity: "legendary",
    points: 500,
    condition: { type: "games_played", value: 250 },
  },
  {
    id: "legend",
    name: "Легенда",
    description: "Сыграйте 500 игр",
    icon: "🌟",
    category: "gameplay",
    rarity: "mythic",
    points: 1000,
    condition: { type: "games_played", value: 500 },
  },

  // Очки
  {
    id: "first_points",
    name: "Первые очки",
    description: "Наберите 100 очков за игру",
    icon: "💯",
    category: "score",
    rarity: "common",
    points: 10,
    condition: { type: "single_game_score", value: 100 },
  },
  {
    id: "high_scorer",
    name: "Результативный",
    description: "Наберите 500 очков за игру",
    icon: "📈",
    category: "score",
    rarity: "rare",
    points: 50,
    condition: { type: "single_game_score", value: 500 },
  },
  {
    id: "score_master",
    name: "Мастер очков",
    description: "Наберите 1000 очков за игру",
    icon: "🎯",
    category: "score",
    rarity: "epic",
    points: 150,
    condition: { type: "single_game_score", value: 1000 },
  },
  {
    id: "score_legend",
    name: "Легенда очков",
    description: "Наберите 2000 очков за игру",
    icon: "👑",
    category: "score",
    rarity: "legendary",
    points: 300,
    condition: { type: "single_game_score", value: 2000 },
  },

  // Общие очки
  {
    id: "total_1k",
    name: "Тысячник",
    description: "Наберите 1000 очков всего",
    icon: "🔢",
    category: "score",
    rarity: "common",
    points: 25,
    condition: { type: "total_score", value: 1000 },
  },
  {
    id: "total_10k",
    name: "Десятитысячник",
    description: "Наберите 10000 очков всего",
    icon: "📊",
    category: "score",
    rarity: "rare",
    points: 75,
    condition: { type: "total_score", value: 10000 },
  },
  {
    id: "total_50k",
    name: "Полсотни тысяч",
    description: "Наберите 50000 очков всего",
    icon: "💰",
    category: "score",
    rarity: "epic",
    points: 200,
    condition: { type: "total_score", value: 50000 },
  },
  {
    id: "total_100k",
    name: "Стотысячник",
    description: "Наберите 100000 очков всего",
    icon: "💎",
    category: "score",
    rarity: "legendary",
    points: 500,
    condition: { type: "total_score", value: 100000 },
  },

  // Точность
  {
    id: "accurate",
    name: "Меткий",
    description: "Достигните 70% точности",
    icon: "🎯",
    category: "accuracy",
    rarity: "common",
    points: 25,
    condition: { type: "accuracy_percentage", value: 70 },
  },
  {
    id: "sharpshooter",
    name: "Снайпер",
    description: "Достигните 85% точности",
    icon: "🔫",
    category: "accuracy",
    rarity: "rare",
    points: 75,
    condition: { type: "accuracy_percentage", value: 85 },
  },
  {
    id: "perfectionist",
    name: "Перфекционист",
    description: "Достигните 95% точности",
    icon: "✨",
    category: "accuracy",
    rarity: "epic",
    points: 200,
    condition: { type: "accuracy_percentage", value: 95 },
  },

  // Идеальные игры
  {
    id: "perfect_game",
    name: "Идеальная игра",
    description: "Завершите игру без ошибок",
    icon: "⭐",
    category: "perfect",
    rarity: "rare",
    points: 50,
    condition: { type: "perfect_game", value: 1 },
  },
  {
    id: "perfect_streak_3",
    name: "Тройной идеал",
    description: "3 идеальные игры подряд",
    icon: "🌟",
    category: "perfect",
    rarity: "epic",
    points: 150,
    condition: { type: "perfect_streak", value: 3 },
  },
  {
    id: "perfect_streak_5",
    name: "Пятёрка идеала",
    description: "5 идеальных игр подряд",
    icon: "💫",
    category: "perfect",
    rarity: "legendary",
    points: 300,
    condition: { type: "perfect_streak", value: 5 },
  },
  {
    id: "perfect_10",
    name: "Десять идеальных",
    description: "10 идеальных игр всего",
    icon: "🏅",
    category: "perfect",
    rarity: "epic",
    points: 200,
    condition: { type: "perfect_games_total", value: 10 },
  },

  // Скорость
  {
    id: "quick_thinker",
    name: "Быстрый ум",
    description: "Ответьте менее чем за 3 секунды",
    icon: "⚡",
    category: "speed",
    rarity: "rare",
    points: 50,
    condition: { type: "fastest_answer", value: 3000 },
  },
  {
    id: "lightning",
    name: "Молния",
    description: "Ответьте менее чем за 1.5 секунды",
    icon: "🌩️",
    category: "speed",
    rarity: "epic",
    points: 150,
    condition: { type: "fastest_answer", value: 1500 },
  },
  {
    id: "instant",
    name: "Мгновение",
    description: "Ответьте менее чем за 1 секунду",
    icon: "💨",
    category: "speed",
    rarity: "legendary",
    points: 300,
    condition: { type: "fastest_answer", value: 1000 },
  },

  // Мультиплеер
  {
    id: "social_player",
    name: "Командный игрок",
    description: "Сыграйте 5 мультиплеерных игр",
    icon: "👥",
    category: "multiplayer",
    rarity: "common",
    points: 25,
    condition: { type: "multiplayer_games", value: 5 },
  },
  {
    id: "party_animal",
    name: "Душа компании",
    description: "Сыграйте 25 мультиплеерных игр",
    icon: "🎉",
    category: "multiplayer",
    rarity: "rare",
    points: 75,
    condition: { type: "multiplayer_games", value: 25 },
  },
  {
    id: "social_butterfly",
    name: "Социальная бабочка",
    description: "Сыграйте 100 мультиплеерных игр",
    icon: "🦋",
    category: "multiplayer",
    rarity: "epic",
    points: 200,
    condition: { type: "multiplayer_games", value: 100 },
  },

  // Победы
  {
    id: "first_win",
    name: "Первая победа",
    description: "Выиграйте свою первую игру",
    icon: "🥇",
    category: "wins",
    rarity: "common",
    points: 25,
    condition: { type: "total_wins", value: 1 },
  },
  {
    id: "winner",
    name: "Победитель",
    description: "Выиграйте 10 игр",
    icon: "🏆",
    category: "wins",
    rarity: "rare",
    points: 75,
    condition: { type: "total_wins", value: 10 },
  },
  {
    id: "champion",
    name: "Чемпион",
    description: "Выиграйте 50 игр",
    icon: "👑",
    category: "wins",
    rarity: "epic",
    points: 200,
    condition: { type: "total_wins", value: 50 },
  },
  {
    id: "undefeated",
    name: "Непобедимый",
    description: "Выиграйте 100 игр",
    icon: "🎖️",
    category: "wins",
    rarity: "legendary",
    points: 500,
    condition: { type: "total_wins", value: 100 },
  },

  // Серии побед
  {
    id: "win_streak_3",
    name: "Хет-трик",
    description: "3 победы подряд",
    icon: "🔥",
    category: "wins",
    rarity: "rare",
    points: 50,
    condition: { type: "win_streak", value: 3 },
  },
  {
    id: "win_streak_5",
    name: "Доминирование",
    description: "5 побед подряд",
    icon: "💪",
    category: "wins",
    rarity: "epic",
    points: 150,
    condition: { type: "win_streak", value: 5 },
  },
  {
    id: "win_streak_10",
    name: "Неостановимый",
    description: "10 побед подряд",
    icon: "🚀",
    category: "wins",
    rarity: "legendary",
    points: 400,
    condition: { type: "win_streak", value: 10 },
  },

  // Камбэки
  {
    id: "comeback_kid",
    name: "Король камбэков",
    description: "Выиграйте, отставая на 50%",
    icon: "🔄",
    category: "special",
    rarity: "epic",
    points: 150,
    condition: { type: "comeback_win", value: 1 },
  },
  {
    id: "comeback_master",
    name: "Мастер камбэков",
    description: "5 камбэков",
    icon: "💪",
    category: "special",
    rarity: "legendary",
    points: 300,
    condition: { type: "comeback_wins_total", value: 5 },
  },

  // Время суток
  {
    id: "night_owl",
    name: "Ночная сова",
    description: "Играйте в полночь",
    icon: "🦉",
    category: "special",
    rarity: "rare",
    points: 50,
    condition: { type: "time_of_day", value: 0 },
  },
  {
    id: "early_bird",
    name: "Ранняя пташка",
    description: "Играйте в 6 утра",
    icon: "🐦",
    category: "special",
    rarity: "rare",
    points: 50,
    condition: { type: "time_of_day", value: 6 },
  },

  // Ежедневные серии
  {
    id: "daily_3",
    name: "Три дня подряд",
    description: "Играйте 3 дня подряд",
    icon: "📅",
    category: "dedication",
    rarity: "common",
    points: 25,
    condition: { type: "daily_streak", value: 3 },
  },
  {
    id: "daily_7",
    name: "Неделя игр",
    description: "Играйте 7 дней подряд",
    icon: "📆",
    category: "dedication",
    rarity: "rare",
    points: 75,
    condition: { type: "daily_streak", value: 7 },
  },
  {
    id: "daily_30",
    name: "Месяц преданности",
    description: "Играйте 30 дней подряд",
    icon: "🗓️",
    category: "dedication",
    rarity: "legendary",
    points: 500,
    condition: { type: "daily_streak", value: 30 },
  },
]

class AchievementServiceClass {
  getAllAchievements(): Achievement[] {
    return ACHIEVEMENTS
  }

  async getPlayerAchievements(userId: string): Promise<PlayerAchievement[]> {
    try {
      const achievementsRef = collection(db, "users", userId, "achievements")
      const snapshot = await getDocs(achievementsRef)

      return snapshot.docs.map((doc) => ({
        achievementId: doc.id,
        ...doc.data(),
      })) as PlayerAchievement[]
    } catch (error) {
      console.error("Error getting player achievements:", error)
      return []
    }
  }

  async getPlayerStats(userId: string): Promise<PlayerStats | null> {
    try {
      const statsRef = doc(db, "users", userId, "stats", "global")
      const statsDoc = await getDoc(statsRef)

      if (statsDoc.exists()) {
        return statsDoc.data() as PlayerStats
      }

      // Return null if stats don't exist yet, let other methods create them if needed.
      return null
    } catch (error) {
      console.error("Error getting player stats:", error)
      return null
    }
  }

  async trackGameCreation(userId: string): Promise<string[]> {
    try {
      console.log("[v0] trackGameCreation called for user:", userId)

      const statsRef = doc(db, "users", userId, "stats", "global")
      const statsDoc = await getDoc(statsRef)

      if (!statsDoc.exists()) {
        console.log("[v0] Stats document doesn't exist, creating initial stats for game creation tracking")
        // Initialize with basic stats if not present
        await setDoc(statsRef, {
          gamesCreated: 1, // Starting with 1 as it's the first creation event
          gamesPlayed: 0,
          totalScore: 0,
          bestScore: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          fastestAnswer: Number.POSITIVE_INFINITY,
          averageAnswerTime: 0,
          perfectGames: 0,
          currentPerfectStreak: 0,
          bestPerfectStreak: 0,
          multiplayerGames: 0,
          totalWins: 0,
          currentWinStreak: 0,
          bestWinStreak: 0,
          comebackWins: 0,
          dailyStreakCount: 0,
          lastPlayDate: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        })
      } else {
        await updateDoc(statsRef, {
          gamesCreated: increment(1),
          lastUpdated: serverTimestamp(),
        })
      }

      // Fetch stats again to ensure we have the latest values for achievement checking
      const updatedStatsDoc = await getDoc(statsRef)
      const updatedStats = updatedStatsDoc.data() as PlayerStats

      if (!updatedStats) {
        console.error("[v0] Failed to retrieve updated player stats after game creation tracking.")
        return []
      }

      console.log("[v0] Updated gamesCreated:", updatedStats.gamesCreated)

      // Check achievements related to game creation
      const newAchievements = await this.checkCreationAchievements(userId, updatedStats.gamesCreated)

      return newAchievements
    } catch (error) {
      console.error("[v0] Error tracking game creation:", error)
      return []
    }
  }

  // Проверка достижений при создании игры
  private async checkCreationAchievements(userId: string, gamesCreated: number): Promise<string[]> {
    try {
      console.log("[v0] checkCreationAchievements called:", { userId, gamesCreated })

      const playerAchievements = await this.getPlayerAchievements(userId)
      const unlockedIds = new Set(playerAchievements.map((a) => a.achievementId))
      const newlyUnlocked: string[] = []

      console.log("[v0] Already unlocked creation achievements:", Array.from(unlockedIds))

      const creationAchievements = ACHIEVEMENTS.filter((a) => a.condition.type === "games_created")

      for (const achievement of creationAchievements) {
        if (unlockedIds.has(achievement.id)) continue

        console.log(`[v0] Checking creation achievement "${achievement.name}":`, {
          gamesCreated,
          required: achievement.condition.value,
          shouldUnlock: gamesCreated >= achievement.condition.value,
        })

        if (gamesCreated >= achievement.condition.value) {
          const achievementRef = doc(db, "users", userId, "achievements", achievement.id)
          const playerAchievement: PlayerAchievement = {
            achievementId: achievement.id,
            unlockedAt: Date.now(),
            progress: 100,
          }

          try {
            await setDoc(achievementRef, playerAchievement)
            newlyUnlocked.push(achievement.id)
            console.log(`[v0] Creation achievement "${achievement.name}" unlocked successfully!`)
          } catch (error) {
            console.error(`[v0] Failed to unlock achievement "${achievement.name}":`, error)
          }
        }
      }

      if (newlyUnlocked.length > 0) {
        console.log("[v0] Successfully unlocked", newlyUnlocked.length, "new creation achievements")
      } else {
        console.log("[v0] No new creation achievements")
      }

      return newlyUnlocked
    } catch (error) {
      console.error("[v0] Error checking creation achievements:", error)
      return []
    }
  }

  async updatePlayerStats(
    userId: string,
    gameData: {
      score: number
      correctAnswers: number
      totalQuestions: number
      timeSpent: number // Total time spent in the game in milliseconds
      fastestAnswer: number // Fastest single answer time in milliseconds
      isWinner: boolean
      wasComeback: boolean
      playTime: number // Timestamp of when the game ended
      isMultiplayer: boolean
    },
  ): Promise<PlayerStats | null> {
    try {
      console.log("[v0] updatePlayerStats called for user:", userId)
      console.log("[v0] Game data:", gameData)

      let currentStats = await this.getPlayerStats(userId)

      // If stats don't exist, initialize them. This should ideally be handled by getPlayerStats if it creates them,
      // but as a fallback, we initialize here.
      if (!currentStats) {
        console.log("[v0] No current stats found, creating initial stats")
        const initialStats = {
          gamesCreated: 0,
          gamesPlayed: 0,
          totalScore: 0,
          bestScore: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          fastestAnswer: Number.POSITIVE_INFINITY,
          averageAnswerTime: 0,
          perfectGames: 0,
          currentPerfectStreak: 0,
          bestPerfectStreak: 0,
          multiplayerGames: 0,
          totalWins: 0,
          currentWinStreak: 0,
          bestWinStreak: 0,
          comebackWins: 0,
          dailyStreakCount: 0,
          lastPlayDate: null,
          lastUpdated: serverTimestamp(),
        }
        await setDoc(doc(db, "users", userId, "stats", "global"), initialStats)
        currentStats = initialStats
      }

      console.log("[v0] Current stats:", currentStats)

      const isPerfectGame = gameData.correctAnswers === gameData.totalQuestions
      const now = Date.now() // Use Date.now() for consistency
      const lastPlayDate = currentStats.lastPlayDate ? new Date(currentStats.lastPlayDate).getTime() : null
      let dailyStreakCount = currentStats.dailyStreakCount || 0

      // Calculate daily streak
      if (lastPlayDate) {
        const oneDay = 1000 * 60 * 60 * 24
        const diffInDays = Math.floor((now - lastPlayDate) / oneDay)

        if (diffInDays === 1) {
          dailyStreakCount += 1
        } else if (diffInDays > 1) {
          dailyStreakCount = 1 // Reset streak if more than a day passed
        } else {
          // If same day or less than a day, streak continues. No change needed unless specific logic applies.
        }
      } else {
        dailyStreakCount = 1 // First game played
      }

      const updates: any = {
        gamesPlayed: increment(1),
        totalScore: increment(gameData.score),
        correctAnswers: increment(gameData.correctAnswers),
        totalAnswers: increment(gameData.totalQuestions),
        lastPlayDate: now, // Use Date.now() for the timestamp
        lastUpdated: now, // Also update lastUpdated
        dailyStreakCount,
        // lastDailyStreakDate: serverTimestamp(), // This might be redundant if lastPlayDate is sufficient
      }

      if (gameData.isMultiplayer) {
        updates.multiplayerGames = increment(1)
      }

      // Update best score if current score is higher
      if (gameData.score > (currentStats.bestScore || 0)) {
        updates.bestScore = gameData.score
      }

      // Update fastest answer if current game's fastest is better
      if (gameData.fastestAnswer < (currentStats.fastestAnswer || Number.POSITIVE_INFINITY)) {
        updates.fastestAnswer = gameData.fastestAnswer
      }

      // Calculate average answer time
      const totalAnswersSoFar = currentStats.totalAnswers || 0
      const totalTimeSoFar = (currentStats.averageAnswerTime || 0) * totalAnswersSoFar
      const newTotalAnswers = totalAnswersSoFar + gameData.totalQuestions
      const newTotalTime = totalTimeSoFar + gameData.timeSpent

      // Avoid division by zero if no questions were answered
      updates.averageAnswerTime = newTotalAnswers > 0 ? newTotalTime / newTotalAnswers : 0

      // Perfect game streak logic
      if (isPerfectGame) {
        updates.perfectGames = increment(1)
        updates.currentPerfectStreak = (currentStats.currentPerfectStreak || 0) + 1
        if (updates.currentPerfectStreak > (currentStats.bestPerfectStreak || 0)) {
          updates.bestPerfectStreak = updates.currentPerfectStreak
        }
      } else {
        updates.currentPerfectStreak = 0
      }

      // Win streak logic
      if (gameData.isWinner) {
        updates.totalWins = increment(1)
        updates.currentWinStreak = (currentStats.currentWinStreak || 0) + 1
        if (updates.currentWinStreak > (currentStats.bestWinStreak || 0)) {
          updates.bestWinStreak = updates.currentWinStreak
        }
      } else {
        updates.currentWinStreak = 0
      }

      if (gameData.wasComeback && gameData.isWinner) {
        // A comeback is only counted if it results in a win
        updates.comebackWins = increment(1)
      }

      await updateDoc(doc(db, "users", userId, "stats", "global"), updates)
      console.log("[v0] Stats updated successfully")

      // Fetch updated stats to return
      const updatedStatsDoc = await getDoc(doc(db, "users", userId, "stats", "global"))
      const updatedStats = updatedStatsDoc.data() as PlayerStats

      console.log("[v0] Updated stats after increment:", updatedStats)

      return updatedStats
    } catch (error) {
      console.error("[v0] Error updating player stats:", error)
      return null
    }
  }

  async checkGameAchievements(
    userId: string,
    stats: PlayerStats, // The stats AFTER the game has been updated
    gameData: {
      score: number
      correctAnswers: number
      totalQuestions: number
      timeSpent: number
      fastestAnswer: number
      playTime: number // Timestamp of game end
      wasComeback: boolean
    },
  ): Promise<string[]> {
    try {
      console.log("[v0] checkGameAchievements called for user:", userId)

      if (!stats) {
        console.error("[v0] Stats is null/undefined, cannot check achievements")
        return []
      }

      console.log("[v0] Current stats for achievement check:", stats)

      const playerAchievements = await this.getPlayerAchievements(userId)
      const unlockedIds = new Set(playerAchievements.map((a) => a.achievementId))
      const newlyUnlocked: string[] = []

      console.log("[v0] Already unlocked achievements:", Array.from(unlockedIds))

      // Achievements that are triggered by specific game events
      const eventAchievements = ACHIEVEMENTS.filter(
        (a) =>
          a.condition.type === "perfect_game" ||
          a.condition.type === "comeback_win" ||
          a.condition.type === "time_of_day",
      )

      for (const achievement of eventAchievements) {
        if (unlockedIds.has(achievement.id)) continue

        let shouldUnlock = false

        switch (achievement.condition.type) {
          case "perfect_game":
            shouldUnlock = gameData.correctAnswers === gameData.totalQuestions
            break
          case "comeback_win":
            // This condition is based on gameData.wasComeback, and also implies a win.
            // The condition.value is usually 1 for these types of achievements.
            shouldUnlock = gameData.wasComeback && achievement.condition.value === 1 // Assuming value 1 means 'at least one'
            break
          case "time_of_day":
            const hour = new Date(gameData.playTime).getHours()
            shouldUnlock = hour === achievement.condition.value
            break
          default:
            // Should not reach here for event achievements
            break
        }

        console.log(`[v0] Checking event achievement "${achievement.name}" (${achievement.id}):`, {
          shouldUnlock,
        })

        if (shouldUnlock) {
          try {
            const achievementRef = doc(db, "users", userId, "achievements", achievement.id)
            const playerAchievement: PlayerAchievement = {
              achievementId: achievement.id,
              unlockedAt: Date.now(),
              progress: 100, // Event achievements are usually all-or-nothing
            }
            await setDoc(achievementRef, playerAchievement)
            newlyUnlocked.push(achievement.id)
            console.log(`[v0] Event achievement "${achievement.name}" unlocked successfully!`)
          } catch (error) {
            console.error(`[v0] Failed to unlock event achievement "${achievement.name}":`, error)
          }
        }
      }

      // Check cumulative achievements based on the updated stats
      const cumulativeAchievements = ACHIEVEMENTS.filter(
        (a) =>
          a.condition.type !== "perfect_game" &&
          a.condition.type !== "comeback_win" &&
          a.condition.type !== "time_of_day",
      )

      for (const achievement of cumulativeAchievements) {
        if (unlockedIds.has(achievement.id)) continue

        let shouldUnlock = false
        let currentValue = 0
        const requiredValue = achievement.condition.value

        switch (achievement.condition.type) {
          case "games_played":
            currentValue = stats.gamesPlayed
            shouldUnlock = currentValue >= requiredValue
            break
          case "games_created":
            currentValue = stats.gamesCreated
            shouldUnlock = currentValue >= requiredValue
            break
          case "single_game_score":
            currentValue = gameData.score // The score from the just-finished game
            shouldUnlock = currentValue >= requiredValue
            break
          case "total_score":
            currentValue = stats.totalScore
            shouldUnlock = currentValue >= requiredValue
            break
          case "accuracy_percentage":
            const accuracy = stats.totalAnswers > 0 ? (stats.correctAnswers / stats.totalAnswers) * 100 : 0
            currentValue = Math.round(accuracy)
            shouldUnlock = accuracy >= requiredValue
            break
          case "perfect_games_total":
            currentValue = stats.perfectGames
            shouldUnlock = currentValue >= requiredValue
            break
          case "perfect_streak":
            // Use the best streak if current is not higher, or just current if not applicable
            currentValue = stats.currentPerfectStreak ?? stats.bestPerfectStreak ?? 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "fastest_answer":
            currentValue = gameData.fastestAnswer
            shouldUnlock = currentValue <= requiredValue
            break
          case "average_answer_time":
            const avgTime = gameData.timeSpent / gameData.totalQuestions
            currentValue = Math.round(avgTime) // Or use the averageAnswerTime from stats if it represents average over all games
            // The logic here might need refinement: if achievement is "average answer time less than X", it should check the player's overall average time, not just the current game's.
            // For now, let's assume it checks the player's overall averageAnswerTime from stats.
            currentValue = stats.averageAnswerTime ?? 0
            shouldUnlock = currentValue > 0 && currentValue <= requiredValue // Ensure averageAnswerTime is calculated
            break
          case "multiplayer_games":
            currentValue = stats.multiplayerGames
            shouldUnlock = currentValue >= requiredValue
            break
          case "win_streak":
            currentValue = stats.currentWinStreak ?? stats.bestWinStreak ?? 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "total_wins":
            currentValue = stats.totalWins
            shouldUnlock = currentValue >= requiredValue
            break
          case "comeback_wins_total":
            currentValue = stats.comebackWins
            shouldUnlock = currentValue >= requiredValue
            break
          case "daily_streak":
            currentValue = stats.dailyStreakCount
            shouldUnlock = currentValue >= requiredValue
            break
        }

        console.log(`[v0] Checking cumulative achievement "${achievement.name}" (${achievement.id}):`, {
          type: achievement.condition.type,
          currentValue,
          requiredValue,
          shouldUnlock,
        })

        if (shouldUnlock) {
          try {
            const achievementRef = doc(db, "users", userId, "achievements", achievement.id)
            const playerAchievement: PlayerAchievement = {
              achievementId: achievement.id,
              unlockedAt: Date.now(),
              progress: 100, // Cumulative achievements are also typically unlocked when condition is met
            }
            await setDoc(achievementRef, playerAchievement)
            newlyUnlocked.push(achievement.id)
            console.log(`[v0] Cumulative achievement "${achievement.name}" unlocked successfully!`)
          } catch (error) {
            console.error(`[v0] Failed to unlock cumulative achievement "${achievement.name}":`, error)
          }
        }
      }

      if (newlyUnlocked.length > 0) {
        console.log("[v0] Successfully unlocked", newlyUnlocked.length, "new achievements:", newlyUnlocked)
      } else {
        console.log("[v0] No new achievements to unlock from this game")
      }

      return newlyUnlocked
    } catch (error) {
      console.error("[v0] Error checking game achievements:", error)
      return []
    }
  }

  async getAchievementProgress(userId: string, achievementId: string): Promise<number> {
    try {
      const stats = await this.getPlayerStats(userId)
      if (!stats) return 0

      const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId)
      if (!achievement) return 0

      let current = 0
      const target = achievement.condition.value

      switch (achievement.condition.type) {
        case "games_played":
          current = stats.gamesPlayed || 0
          break
        case "games_created":
          current = stats.gamesCreated || 0
          break
        case "single_game_score":
          // Progress for single game score is tricky. Usually, you'd show how close they are to their best score or the target score.
          // For simplicity, we might return 0 or a calculation based on best score if not already met.
          // If target is met, it's 100%. Otherwise, maybe 0.
          return stats.bestScore && stats.bestScore >= target ? 100 : 0
        case "total_score":
          current = stats.totalScore || 0
          break
        case "accuracy_percentage":
          current = stats.totalAnswers > 0 ? (stats.correctAnswers / stats.totalAnswers) * 100 : 0
          break
        case "perfect_game":
          // This is an event-based achievement, progress doesn't make much sense unless tracking number of perfect games attempted.
          return 0
        case "perfect_games_total":
          current = stats.perfectGames || 0
          break
        case "perfect_streak":
          current = stats.currentPerfectStreak || stats.bestPerfectStreak || 0
          break
        case "fastest_answer":
          // Progress calculation for fastest answer needs to be inverted: lower is better.
          // If stats.fastestAnswer is less than or equal to target, it's 100%.
          // Otherwise, how much progress? Maybe (target / current_fastest) * 100, but capped.
          if (stats.fastestAnswer && stats.fastestAnswer < Number.POSITIVE_INFINITY) {
            return stats.fastestAnswer <= target
              ? 100
              : Math.max(0, Math.min(100, (target / stats.fastestAnswer) * 100))
          }
          return 0
        case "average_answer_time":
          // Similar to fastest_answer, lower is better.
          current = stats.averageAnswerTime || 0
          return current > 0 && current <= target ? 100 : Math.max(0, Math.min(100, (target / current) * 100))
        case "multiplayer_games":
          current = stats.multiplayerGames || 0
          break
        case "win_streak":
          current = stats.currentWinStreak || stats.bestWinStreak || 0
          break
        case "total_wins":
          current = stats.totalWins || 0
          break
        case "comeback_win":
          // Event-based
          return 0
        case "comeback_wins_total":
          current = stats.comebackWins || 0
          break
        case "time_of_day":
          // Event-based
          return 0
        case "daily_streak":
          current = stats.dailyStreakCount || 0
          break
        default:
          current = 0
      }

      // Calculate progress percentage, ensure it's between 0 and 100
      if (target === 0) return 100 // Avoid division by zero if target is 0
      const progress = (current / target) * 100
      return Math.min(100, Math.max(0, progress))
    } catch (error) {
      console.error("Error getting achievement progress:", error)
      return 0
    }
  }

  getRarityName(rarity: AchievementRarity): string {
    const names: Record<AchievementRarity, string> = {
      common: "Обычное",
      rare: "Редкое",
      super_rare: "Супер-редкое",
      epic: "Эпическое",
      mythic: "Мифическое",
      legendary: "Легендарное",
      secret: "Секретное",
    }
    return names[rarity] || "Неизвестно"
  }

  getRarityColor(rarity: AchievementRarity): string {
    const colors: Record<AchievementRarity, string> = {
      common: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      rare: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      super_rare: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      epic: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      mythic: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      legendary: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      secret: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
    }
    return colors[rarity] || colors.common
  }

  async checkAndUnlockAllAchievements(userId: string): Promise<string[]> {
    try {
      console.log("[v0] checkAndUnlockAllAchievements called for user:", userId)

      const stats = await this.getPlayerStats(userId)
      if (!stats) {
        console.log("[v0] No stats found for user, creating default stats")
        // Create default stats if none exist
        const statsRef = doc(db, "users", userId, "stats", "gameplay")
        await setDoc(statsRef, {
          gamesPlayed: 0,
          gamesCreated: 0,
          totalScore: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          perfectGames: 0,
          currentWinStreak: 0,
          bestWinStreak: 0,
          multiplayerGames: 0,
          totalWins: 0,
          comebackWins: 0,
          dailyStreakCount: 0,
          currentPerfectStreak: 0,
          bestPerfectStreak: 0,
          averageAnswerTime: 0,
          fastestAnswer: 0,
          lastPlayedAt: null,
        })
        return []
      }

      console.log("[v0] Current stats:", stats)

      const playerAchievements = await this.getPlayerAchievements(userId)
      const unlockedIds = new Set(playerAchievements.map((a) => a.achievementId))
      const newlyUnlocked: string[] = []

      console.log("[v0] Already unlocked achievements:", Array.from(unlockedIds))

      // Check each achievement
      for (const achievement of ACHIEVEMENTS) {
        if (unlockedIds.has(achievement.id)) {
          continue // Already unlocked
        }

        let shouldUnlock = false
        let currentValue = 0
        const requiredValue = achievement.condition.value

        switch (achievement.condition.type) {
          case "games_created":
            currentValue = stats.gamesCreated || 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "games_played":
            currentValue = stats.gamesPlayed || 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "correct_answers":
            currentValue = stats.correctAnswers || 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "total_score":
            currentValue = stats.totalScore || 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "accuracy_percentage":
            const accuracy = stats.totalAnswers > 0 ? (stats.correctAnswers / stats.totalAnswers) * 100 : 0
            currentValue = Math.round(accuracy)
            shouldUnlock = accuracy >= requiredValue && stats.totalAnswers >= 10 // Need minimum games
            break
          case "perfect_games_total":
            currentValue = stats.perfectGames || 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "perfect_streak":
            currentValue = Math.max(stats.currentPerfectStreak || 0, stats.bestPerfectStreak || 0)
            shouldUnlock = currentValue >= requiredValue
            break
          case "multiplayer_games":
            currentValue = stats.multiplayerGames || 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "win_streak":
            currentValue = Math.max(stats.currentWinStreak || 0, stats.bestWinStreak || 0)
            shouldUnlock = currentValue >= requiredValue
            break
          case "total_wins":
            currentValue = stats.totalWins || 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "comeback_wins_total":
            currentValue = stats.comebackWins || 0
            shouldUnlock = currentValue >= requiredValue
            break
          case "daily_streak":
            currentValue = stats.dailyStreakCount || 0
            shouldUnlock = currentValue >= requiredValue
            break
          // Skip event-based achievements that can't be checked from stats alone
          case "fastest_answer":
          case "average_answer_time":
          case "time_of_day":
          case "comeback_win":
            continue
        }

        console.log(`[v0] Checking achievement "${achievement.name}" (${achievement.id}):`, {
          type: achievement.condition.type,
          currentValue,
          requiredValue,
          shouldUnlock,
        })

        if (shouldUnlock) {
          try {
            const achievementRef = doc(db, "users", userId, "achievements", achievement.id)
            const playerAchievement: PlayerAchievement = {
              achievementId: achievement.id,
              unlockedAt: Date.now(),
              progress: 100,
            }
            await setDoc(achievementRef, playerAchievement)
            newlyUnlocked.push(achievement.id)
            console.log(`[v0] Achievement "${achievement.name}" unlocked!`)
          } catch (error) {
            console.error(`[v0] Failed to unlock achievement "${achievement.name}":`, error)
          }
        }
      }

      if (newlyUnlocked.length > 0) {
        console.log("[v0] Newly unlocked achievements:", newlyUnlocked)
      } else {
        console.log("[v0] No new achievements to unlock")
      }

      return newlyUnlocked
    } catch (error) {
      console.error("[v0] Error in checkAndUnlockAllAchievements:", error)
      return []
    }
  }
}

const AchievementService = new AchievementServiceClass()
export default AchievementService
