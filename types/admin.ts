export interface UserSessionLog {
  sessionId: string
  userId: string
  loginTime: number
  logoutTime?: number
  ipAddress: string
  device: string
  browser?: string
  os?: string
  location?: string
  duration?: number
}

export interface AdminUserAnalytics {
  userId: string
  email: string
  nickname: string
  avatar: string
  createdAt: number
  lastLogin: number | null
  lastIP: string | null
  lastDevice: string | null
  lastLocation: string | null
  totalSessions: number
  stats: {
    gamesPlayed: number
    gamesCreated: number
    totalScore: number
    averageScore: number
    accuracyPercentage: number
    perfectGames: number
    currentWinStreak: number
    bestWinStreak: number
    totalWins: number
  } | null
  achievementsCount: number
  sessions: UserSessionLog[]
  isAdmin: boolean
}

export interface PlatformStats {
  totalUsers: number
  totalGames: number
  totalSessions: number
  activeUsersWeek: number
}
