"use client"

import { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback, type ReactNode } from "react"
import type { Game, GameSession, Player, PlayerAnswer } from "@/types/game"
import { ref, onValue, set, update } from "firebase/database"
import { realtimeDb } from "@/lib/firebase/config"
import AchievementService from "@/lib/services/achievementService"
import { calculatePoints } from "@/lib/utils/pointsCalculation"

interface GameState {
  currentGame: Game | null
  gameSession: GameSession | null
  currentPlayer: Player | null
  isHost: boolean
  loading: boolean
  error: string | null
  connectionStatus: "connected" | "disconnected" | "connecting"
}

type GameAction =
  | { type: "SET_GAME"; payload: Game }
  | { type: "SET_SESSION"; payload: GameSession }
  | { type: "SET_PLAYER"; payload: Player }
  | { type: "SET_HOST"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_CONNECTION_STATUS"; payload: "connected" | "disconnected" | "connecting" }
  | { type: "RESET" }

const initialState: GameState = {
  currentGame: null,
  gameSession: null,
  currentPlayer: null,
  isHost: false,
  loading: false,
  error: null,
  connectionStatus: "disconnected",
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_GAME":
      return { ...state, currentGame: action.payload }
    case "SET_SESSION":
      return { ...state, gameSession: action.payload }
    case "SET_PLAYER":
      return { ...state, currentPlayer: action.payload }
    case "SET_HOST":
      return { ...state, isHost: action.payload }
    case "SET_LOADING":
      return { ...state, loading: action.payload }
    case "SET_ERROR":
      return { ...state, error: action.payload }
    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.payload }
    case "RESET":
      return { ...initialState, connectionStatus: "disconnected" }
    default:
      return state
  }
}

interface GameContextType extends GameState {
  initializeGame: (gameId: string, playerId?: string) => Promise<void>
  joinGame: (gameCode: string, nickname: string, avatar: string) => Promise<string>
  submitAnswer: (answer: string | string[] | number[]) => Promise<void>
  updatePlayerStatus: (isConnected: boolean) => Promise<void>
  cleanup: () => void
  checkAchievements: (
    userId: string,
    gameData: {
      score: number
      correctAnswers: number
      totalQuestions: number
      timeSpent: number
      fastestAnswer: number
      isWinner: boolean
      wasComeback: boolean
      playTime: number
    },
  ) => Promise<string[]>
  achievementNotifications: string[]
  showAchievementNotification: (achievementIds: string[]) => void
  clearAchievementNotifications: () => void
}

const GameContext = createContext<GameContextType | undefined>(undefined)

// Утилиты для безопасной работы с данными
function normalizePlayer(playerData: any, playerId: string): Player | null {
  if (!playerData || typeof playerData !== "object") return null

  return {
    id: playerId,
    nickname: typeof playerData.nickname === "string" ? playerData.nickname : "",
    avatar: typeof playerData.avatar === "string" ? playerData.avatar : "",
    score: typeof playerData.score === "number" ? playerData.score : 0,
    answers: Array.isArray(playerData.answers) ? playerData.answers : [],
    joinedAt: playerData.joinedAt || Date.now(),
    isConnected: Boolean(playerData.isConnected),
    lastActivity: playerData.lastActivity || Date.now(),
    warnings: typeof playerData.warnings === "number" ? playerData.warnings : 0,
    isMuted: Boolean(playerData.isMuted),
  }
}

function normalizeGameSession(sessionData: any, gameId: string): GameSession | null {
  if (!sessionData || typeof sessionData !== "object") return null

  const players: Record<string, Player> = {}

  if (sessionData.players && typeof sessionData.players === "object") {
    Object.entries(sessionData.players).forEach(([playerId, playerData]) => {
      const normalizedPlayer = normalizePlayer(playerData, playerId)
      if (normalizedPlayer) {
        players[playerId] = normalizedPlayer
      }
    })
  }

  return {
    gameId: sessionData.gameId || gameId,
    code: sessionData.code || "",
    status: sessionData.status || "waiting",
    players,
    currentQuestionIndex: typeof sessionData.currentQuestionIndex === "number" ? sessionData.currentQuestionIndex : 0,
    leaderboard: Array.isArray(sessionData.leaderboard) ? sessionData.leaderboard : [],
    hostId: sessionData.hostId || "",
    questionStartTime: sessionData.questionStartTime,
    questionEndTime: sessionData.questionEndTime,
    showResults: Boolean(sessionData.showResults),
    showLeaderboard: Boolean(sessionData.showLeaderboard),
    chat: sessionData.chat && typeof sessionData.chat === "object" ? sessionData.chat : {},
    notifications: Array.isArray(sessionData.notifications) ? sessionData.notifications : [],
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const [achievementNotifications, setAchievementNotifications] = useState<string[]>([])
  const sessionListenerRef = useRef<(() => void) | null>(null)
  const playerUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  // Очистка ресурсов
  const cleanup = () => {
    if (sessionListenerRef.current) {
      sessionListenerRef.current()
      sessionListenerRef.current = null
    }
    if (playerUpdateTimeoutRef.current) {
      clearTimeout(playerUpdateTimeoutRef.current)
      playerUpdateTimeoutRef.current = null
    }
    isInitializedRef.current = false
    setAchievementNotifications([])
  }

  // Инициализация игры
  const initializeGame = async (gameId: string, playerId?: string) => {
    if (isInitializedRef.current) return

    try {
      dispatch({ type: "SET_LOADING", payload: true })
      dispatch({ type: "SET_CONNECTION_STATUS", payload: "connecting" })
      dispatch({ type: "SET_ERROR", payload: null })

      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)

      // Создаем слушатель сессии
      const unsubscribe = onValue(
        sessionRef,
        (snapshot) => {
          try {
            const sessionData = snapshot.val()

            if (sessionData) {
              const normalizedSession = normalizeGameSession(sessionData, gameId)
              if (normalizedSession) {
                dispatch({ type: "SET_SESSION", payload: normalizedSession })
                dispatch({ type: "SET_CONNECTION_STATUS", payload: "connected" })

                // Обновляем данные игрока если он есть
                if (playerId && normalizedSession.players[playerId]) {
                  const updatedPlayer = normalizedSession.players[playerId]
                  dispatch({ type: "SET_PLAYER", payload: updatedPlayer })
                }
              }
            } else {
              // Сессия не существует - создаем новую для хоста
              if (!playerId) {
                const newSession = {
                  gameId,
                  code: "",
                  status: "waiting",
                  players: {},
                  currentQuestionIndex: 0,
                  leaderboard: [],
                  hostId: "",
                  chat: {},
                  notifications: [],
                  showResults: false,
                  showLeaderboard: false,
                  createdAt: Date.now(), // Changed from serverTimestamp() to Date.now() for Unix milliseconds
                }
                set(sessionRef, newSession)
              }
            }
          } catch (error) {
            console.error("Ошибка обработки данных сессии:", error)
            dispatch({ type: "SET_CONNECTION_STATUS", payload: "disconnected" })
          }
        },
        (error) => {
          console.error("Ошибка подключения к сессии:", error)
          dispatch({ type: "SET_CONNECTION_STATUS", payload: "disconnected" })
          dispatch({ type: "SET_ERROR", payload: "Ошибка подключения к серверу" })
        },
      )

      sessionListenerRef.current = unsubscribe
      isInitializedRef.current = true
    } catch (error: any) {
      console.error("Ошибка инициализации игры:", error)
      dispatch({ type: "SET_ERROR", payload: error.message || "Ошибка инициализации игры" })
      dispatch({ type: "SET_CONNECTION_STATUS", payload: "disconnected" })
    } finally {
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }

  // Присоединение к игре
  const joinGame = async (gameCode: string, nickname: string, avatar: string): Promise<string> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true })
      dispatch({ type: "SET_ERROR", payload: null })

      const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const newPlayer: Player = {
        id: playerId,
        nickname: nickname.trim(),
        avatar,
        score: 0,
        answers: [],
        joinedAt: Date.now(),
        isConnected: true,
        lastActivity: Date.now(),
        warnings: 0,
        isMuted: false,
      }

      // Находим игру по коду и добавляем игрока
      // Эта логика будет выполнена в компоненте, который вызывает joinGame

      dispatch({ type: "SET_PLAYER", payload: newPlayer })
      return playerId
    } catch (error: any) {
      console.error("Ошибка присоединения к игре:", error)
      dispatch({ type: "SET_ERROR", payload: error.message || "Ошибка присоединения к игре" })
      throw error
    } finally {
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }

  // Отправка ответа
  const submitAnswer = async (answer: string | string[] | number[]) => {
    if (!state.currentPlayer || !state.gameSession || !state.currentGame) return

    try {
      const currentQuestion = state.currentGame.questions[state.gameSession.currentQuestionIndex]
      if (!currentQuestion) return

      const timeSpent = Date.now() - (state.gameSession.questionStartTime || Date.now())
      const isCorrect = checkAnswer(answer, currentQuestion.correctAnswers, currentQuestion.caseSensitive)
      const points = isCorrect
        ? calculatePoints(currentQuestion.points, timeSpent, currentQuestion.timeLimit * 1000)
        : 0

      const playerAnswer: PlayerAnswer = {
        questionId: currentQuestion.id,
        answer,
        timeSpent,
        isCorrect,
        points,
        submittedAt: Date.now(),
      }

      const currentAnswers = state.currentPlayer.answers || []
      const newAnswers = [...currentAnswers, playerAnswer]
      const newScore = state.currentPlayer.score + points

      const playerRef = ref(realtimeDb, `sessions/${state.gameSession.gameId}/players/${state.currentPlayer.id}`)
      await update(playerRef, {
        answers: newAnswers,
        score: newScore,
        lastActivity: Date.now(), // Changed from serverTimestamp() to Date.now()
      })
    } catch (error) {
      console.error("Ошибка отправки ответа:", error)
      dispatch({ type: "SET_ERROR", payload: "Ошибка отправки ответа" })
    }
  }

  // Обновление статуса игрока
  const updatePlayerStatus = async (isConnected: boolean) => {
    if (!state.currentPlayer || !state.gameSession) return

    try {
      const playerRef = ref(realtimeDb, `sessions/${state.gameSession.gameId}/players/${state.currentPlayer.id}`)
      await update(playerRef, {
        isConnected,
        lastActivity: Date.now(), // Changed from serverTimestamp() to Date.now()
      })
    } catch (error) {
      console.error("Ошибка обновления статуса игрока:", error)
    }
  }

  // Хук для проверки достижений после игры
  const checkAchievements = useCallback(
    async (
      userId: string,
      gameData: {
        score: number
        correctAnswers: number
        totalQuestions: number
        timeSpent: number
        fastestAnswer: number
        isWinner: boolean
        wasComeback: boolean
        playTime: number
      },
    ) => {
      try {
        console.log("[v0] GameContext checkAchievements called for user:", userId)
        console.log("[v0] Game data:", gameData)

        const updatedStats = await AchievementService.updatePlayerStats(userId, gameData)

        if (!updatedStats) {
          console.log("[v0] Failed to update player stats")
          return []
        }

        console.log("[v0] Stats updated, now checking achievements")

        const newAchievements = await AchievementService.checkGameAchievements(userId, gameData)

        console.log("[v0] Achievement check complete, new achievements:", newAchievements)

        // Show notifications for new achievements
        if (newAchievements.length > 0) {
          setAchievementNotifications(newAchievements)
        }

        return newAchievements
      } catch (error) {
        console.error("[v0] Error in checkAchievements:", error)
        return []
      }
    },
    [setAchievementNotifications],
  )

  const showAchievementNotification = useCallback((achievementIds: string[]) => {
    setAchievementNotifications(achievementIds)
  }, [])

  const clearAchievementNotifications = useCallback(() => {
    setAchievementNotifications([])
  }, [])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  return (
    <GameContext.Provider
      value={{
        ...state,
        initializeGame,
        joinGame,
        submitAnswer,
        updatePlayerStatus,
        cleanup,
        checkAchievements,
        achievementNotifications,
        showAchievementNotification,
        clearAchievementNotifications,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

// Основной хук для использования контекста игры
export function useGame() {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider")
  }
  return context
}

// Алиас для совместимости с существующим кодом
export const useGameContext = useGame

// Helper функции
function checkAnswer(
  userAnswer: string | string[] | number[],
  correctAnswers: string[] | number[],
  caseSensitive?: boolean,
): boolean {
  if (!correctAnswers || !Array.isArray(correctAnswers) || correctAnswers.length === 0) return false

  if (Array.isArray(userAnswer)) {
    return (
      userAnswer.length === correctAnswers.length &&
      userAnswer.every((answer) => correctAnswers.includes(answer as any))
    )
  }

  if (typeof userAnswer === "string") {
    if (caseSensitive) {
      return correctAnswers.some((answer) => answer.toString().trim() === userAnswer.trim())
    }
    return correctAnswers.some((answer) => answer.toString().toLowerCase().trim() === userAnswer.toLowerCase().trim())
  }

  return correctAnswers.includes(userAnswer as any)
}
