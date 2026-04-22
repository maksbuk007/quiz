export type AchievementCategory =
  | "games_created"
  | "participation"
  | "score"
  | "accuracy"
  | "speed"
  | "social"
  | "streaks"
  | "special"

export type AchievementRarity = "common" | "rare" | "super_rare" | "epic" | "mythic" | "legendary" | "secret"

export interface AchievementCondition {
  type:
    | "games_created"
    | "games_played"
    | "single_game_score"
    | "total_score"
    | "accuracy_percentage"
    | "perfect_game"
    | "perfect_games_total"
    | "perfect_streak"
    | "fastest_answer"
    | "average_answer_time"
    | "multiplayer_games"
    | "win_streak"
    | "total_wins"
    | "comeback_win"
    | "comeback_wins_total"
    | "time_of_day"
    | "daily_streak"
    | "secret"
  value: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  category: AchievementCategory
  rarity: AchievementRarity
  icon: string
  condition: AchievementCondition
  points: number
}

export interface PlayerAchievement {
  achievementId: string
  unlockedAt: number
  progress: number
}

export interface UserAchievements {
  userId: string
  achievements: UserAchievement[]
  totalPoints: number
  lastUpdated: number
}

export interface UserAchievement {
  achievementId: string
  unlockedAt: number
  progress: number
}
