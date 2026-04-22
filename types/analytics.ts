export interface GameAnalytics {
  gameId: string
  totalPlays: number
  uniquePlayers: number
  averageAccuracy: number
  averageDuration: number
  questionStats: {
    [questionId: string]: QuestionAnalytics
  }
  createdAt: Date
  lastPlayedAt: Date
  totalPlayers: number
  averageScore: number
  medianScore: number
  completionRate: number
  averageTimePerQuestion: number
  playerStats: PlayerAnalytics[]
  sessionDuration: number
  engagementScore: number
  gameMetadata: {
    title: string
    categories: string[]
    totalQuestions: number
    difficulty: "easy" | "medium" | "hard"
  }
}

export interface QuestionAnalytics {
  questionId: string
  questionText: string
  questionIndex: number
  totalAnswers: number
  correctAnswers: number
  incorrectAnswers: number
  accuracyRate: number
  averageTime: number
  fastestAnswer: number
  slowestAnswer: number
  difficultyScore: number
  answerDistribution: Record<string, number>
  timeDistribution: {
    fast: number
    medium: number
    slow: number
  }
  abandonmentRate: number
  difficulty: "easy" | "medium" | "hard" | "expert"
}

export interface PlayerAnalytics {
  playerId: string
  userId: string
  nickname: string
  score: number
  correctAnswers: number
  totalAnswers: number
  accuracy: number
  averageTime: number
  fastestAnswer: number
  slowestAnswer: number
  completionTime: number
  rank: number
  scorePerMinute: number
  gamesPlayed: number
  bestScore: number
  averageScore: number
  totalScore: number
  accuracyPercentage: number
  perfectGames: number
  currentWinStreak: number
  bestWinStreak: number
  achievementPoints: number
  achievementsUnlocked: number
  gameHistory?: Array<{
    gameId: string
    score: number
    rank: number
    correctAnswers: number
    totalQuestions: number
    playedAt: Date
  }>
}

export interface OverallAnalytics {
  totalGames: number
  totalPlayers: number
  averagePlayersPerGame: number
  mostPopularCategories: Array<{ category: string; count: number }>
  averageGameDuration: number
  topPerformingGames: Array<{ gameId: string; title: string; averageScore: number }>
  playerEngagement: {
    newPlayers: number
    returningPlayers: number
    averageSessionsPerPlayer: number
  }
}
