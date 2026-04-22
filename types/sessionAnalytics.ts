export interface SessionRecord {
  id: string
  gameId: string
  gameCode: string
  gameTitle: string
  startedAt: number
  completedAt: number
  duration: number // in seconds
  hostId: string
  hostEmail: string
  playerCount: number
  questionCount: number
  players: SessionPlayerRecord[]
  questionStats: SessionQuestionStats[]
  overallStats: SessionOverallStats
}

export interface SessionPlayerRecord {
  playerId: string
  nickname: string
  avatar?: string
  finalScore: number
  correctAnswers: number
  totalAnswers: number
  accuracy: number // percentage
  averageTimePerQuestion: number // in seconds
  totalTimeSpent: number // in seconds
  rank: number
  answers: SessionPlayerAnswer[]
}

export interface SessionPlayerAnswer {
  questionId: string
  questionIndex: number
  // Unified raw answer value (number, number[] for choice/multi-select, string for text input, boolean for true/false).
  answer?: number | number[] | string | boolean | null
  // Legacy fields retained for backward compatibility with exports / older sessions.
  selectedOption?: number | number[]
  answerText?: string
  isCorrect: boolean
  timeSpent: number // milliseconds
  points: number
}

export interface SessionQuestionStats {
  questionId: string
  questionIndex: number
  questionText: string
  type: string
  totalAnswers: number
  correctAnswers: number
  accuracy: number // percentage
  averageTime: number // in seconds
  answerDistribution: Record<string, number> // option text -> count
}

export interface SessionOverallStats {
  averageScore: number
  averageAccuracy: number
  averageTime: number
  completionRate: number
  highestScore: number
  lowestScore: number
  medianScore: number
}
