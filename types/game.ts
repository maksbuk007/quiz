// Self-paced mode settings stored in the session
export interface SelfPacedSettings {
  randomizeOrder: boolean       // Each player gets questions in a random (unique) order
  shuffleAnswers: boolean       // Answer options shown in random order (client-side only)
  showCorrectAnswers: boolean   // Player sees correct answer highlighted after answering
  showRankAfterAnswer: boolean  // Player sees their current leaderboard rank after each answer
  allowSkip: boolean            // Player can skip a question (counts as wrong, 0 pts)
  timeLimitPerQuestion: boolean // Use per-question time limits (from question.timeLimit)
  autoAdvance: boolean          // Automatically move to next question after feedback (no button)
}

// Per-player progress in self-paced mode (stored under session.players[id].selfPaced)
export interface PlayerSelfPacedProgress {
  questionOrder: number[]      // Shuffled or sequential indices into game.questions
  currentIndex: number         // Which position in questionOrder they are on
  finished: boolean            // True when they have answered all questions
  finishedAt?: number
  questionStartTimes: Record<number, number>  // qIndex -> timestamp when this q was shown
}

export interface GameSession {
  id: string
  gameCode: string
  status: "waiting" | "active" | "paused" | "question_results" | "leaderboard" | "finished" | "restarting"
  players: Record<string, Player>
  currentQuestionIndex: number
  currentQuestion?: Question | null
  questionStartTime?: number | null
  questionEndTime?: number | null
  showResults?: boolean
  showLeaderboard?: boolean
  chatMessages?: ChatMessage[]
  chat?: Record<string, ChatMessage>
  notifications?: any[]
  createdAt: number
  updatedAt: number
  restartSignal?: number
  // Mode fields
  mode?: "synchronized" | "self_paced"
  selfPacedSettings?: SelfPacedSettings
  startTime?: number
  sessionId?: string
  completedAt?: number
  finishedAt?: number
  leaderboard?: any[]
  showPodium?: boolean
  phase?: string
  gameId?: string
  hostId?: string
  code?: string
  // Self-paced broadcast view — when set, all players display this overlay.
  broadcastView?: "podium" | "leaderboard" | null
  broadcastViewAt?: number
  // Server-side "freeze all clocks now" marker for self-paced mode.
  timersFrozenAt?: number | null
}

export type QuestionType = "MULTIPLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE" | "TEXT_INPUT"

export interface Question {
  id: string
  type: QuestionType
  question: string
  options?: string[]
  correctAnswers: (number | string)[]
  caseSensitive?: boolean
  numbersOnly?: boolean
  timeLimit: number
  points: number
  explanation?: string
  imageUrl?: string
  order: number
}

export interface Player {
  id: string
  name: string
  nickname?: string
  avatar?: string
  score: number
  answers?: any[]
  joinedAt: number
  isHost?: boolean
  isActive?: boolean
  isConnected?: boolean
  isKicked?: boolean
  kickReason?: string
  kickedAt?: number
  isMuted?: boolean
  warnings?: number
  lastAnswer?: {
    questionId: string
    timestamp: number
  }
  lastQuestionDelta?: number
  // Self-paced mode
  selfPaced?: PlayerSelfPacedProgress
}

export interface ChatMessage {
  id: string
  firebaseKey?: string // Firebase push key for deletion
  playerId: string
  playerName: string
  playerAvatar?: string
  message: string
  timestamp: number
  type?: "user" | "system" | "achievement" | "warning"
}

export interface GameSettings {
  defaultTimeLimit: number
  defaultPoints: number
  defaultImageUrl?: string
  allowLateJoin: boolean
  showLeaderboard: boolean
  randomizeQuestions: boolean
  showCorrectAnswers: boolean
  allowReplay: boolean
  enableChat: boolean
  moderateChat: boolean
  allowHints: boolean
  penaltyForWrongAnswer: number
  autoShowResultsWhenAllAnswered: boolean
}

export interface GamePermission {
  email: string
  role: "view" | "edit" | "host" | "admin"
  canViewAnalytics?: boolean
  tagFilter?: string[] // Only see games with these tags
  createdAt?: number
}

export interface Game {
  id: string
  code: string
  title: string
  description?: string
  hostId: string
  hostEmail: string
  questions: Question[]
  categories?: string[]
  tags?: string[]
  maxPlayers: number
  status: "draft" | "active" | "completed"
  currentQuestionIndex: number
  createdAt: Date | number
  updatedAt: Date | number
  createdBy?: string
  settings: GameSettings
  isLocked?: boolean
  sharedWith?: Record<string, GamePermission>
}
