"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import ThemeToggle from "@/components/ui/ThemeToggle"
import { AVATARS } from "@/components/ui/AvatarSelector"
import { doc, getDoc } from "firebase/firestore"
import { db, realtimeDb } from "@/lib/firebase/config"
import { GameService } from "@/lib/firebase/gameService"
import type { Game, GameSession, Question, Player } from "@/types/game"
import QRCode from "react-qr-code"
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Users,
  Clock,
  ArrowLeft,
  CheckCircle,
  XCircle,
  BarChart2,
  Trophy,
  LogOut,
  UserX,
  Copy,
  Wifi,
  WifiOff,
  AlertTriangle,
  Loader2,
  User,
  MessageSquare,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  Wrench,
  Award,
  MoreHorizontal,
  ChevronDown,
  Settings,
  BarChart3,
  TrendingUp,
  Monitor,
} from "lucide-react"
import { ref, push, update, get } from "firebase/database"
import UserProfile from "@/components/ui/UserProfile"
import AdminGameChat from "@/components/game/AdminGameChat"
import AnimatedLeaderboard from "@/components/game/AnimatedLeaderboard"
import { toast } from "@/hooks/use-toast"
import HostPlayerAnswersPanel from "@/components/game/HostPlayerAnswersPanel"
import PlayerAnswersDialog from "@/components/game/PlayerAnswersDialog"
import { SessionAnalyticsService } from "@/lib/services/sessionAnalyticsService"

export default function HostGamePage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { user, isAdmin, loading: authLoading, logout } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [game, setGame] = useState<Game | null>(null)
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [previousPlayers, setPreviousPlayers] = useState<Record<string, Player>>({})

  const [timeLeft, setTimeLeft] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("disconnected")
  const [kickReason, setKickReason] = useState("")
  const [kickingPlayer, setKickingPlayer] = useState<string | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showQuestionPreview, setShowQuestionPreview] = useState(true)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true)
  const [isRestarting, setIsRestarting] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [viewingPlayerAnswers, setViewingPlayerAnswers] = useState<string | null>(null) // Added for viewing player answers

  const [showHostSettings, setShowHostSettings] = useState(false)

  const [hostPanelPreferences, setHostPanelPreferences] = useState({
    showLeaderboard: true,
    showChat: true,
    showPlayerList: true,
    showQuestionPreview: true,
  })

  const [leaderboardMaxPlayers, setLeaderboardMaxPlayers] = useState(10)

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isTimerRunningRef = useRef(false)
  const isMountedRef = useRef(true)
  const moreOptionsRef = useRef<HTMLDivElement>(null)

  const getAvatarDisplay = useCallback((avatarId: string) => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    if (!avatar) return <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">?</div>

    return (
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }, [])

  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/")
    }
  }, [authLoading, isAdmin, router])

  useEffect(() => {
    if (!id || !user || !isAdmin || authLoading) return

    let mounted = true

    const initializeGame = async () => {
      try {
        setLoading(true)
        setError("")

        const gameDoc = await getDoc(doc(db, "games", id as string))
        if (!gameDoc.exists()) {
          setError("Игра не найдена")
          setLoading(false)
          return
        }

        const gameData = { id: gameDoc.id, ...gameDoc.data() } as Game
        setGame(gameData)

        const sessionRef = ref(realtimeDb, `sessions/${gameData.id}`)
        const sessionSnapshot = await get(sessionRef)

        if (!sessionSnapshot.exists()) {
          await GameService.createSession(gameData.id, user.uid, gameData.code)

          await GameService.addPlayerToSession(gameData.id, {
            id: "host",
            nickname: "Host",
            avatar: "host",
            score: 0,
            answers: [],
            warnings: 0,
            isMuted: false,
            isConnected: true,
            joinedAt: Date.now(),
          })
        }

        const unsubscribe = GameService.subscribeToSession(gameData.id, (session) => {
          setConnectionStatus("connected")

          if (session) {
            const calculatedPhase = session.showResults
              ? "RESULTS"
              : session.showLeaderboard
                ? "LEADERBOARD"
                : session.showPodium
                  ? "PODIUM"
                  : session.status === "active"
                    ? "QUESTION"
                    : session.status === "waiting"
                      ? "WAITING"
                      : "FINISHED"

            const enhancedSession = {
              ...session,
              phase: calculatedPhase,
            } as GameSession & { phase: string }

            setGameSession((prevSession) => {
              if (
                prevSession?.players &&
                session.players &&
                Object.keys(session.players || {}).length > 0 &&
                (session.showLeaderboard || session.showResults) &&
                !prevSession.showLeaderboard &&
                !prevSession.showResults
              ) {
                setPreviousPlayers(prevSession.players)
              }
              return enhancedSession
            })

            if (gameData.questions && session.currentQuestionIndex >= 0) {
              const question = gameData.questions[session.currentQuestionIndex]
              setCurrentQuestion(question)

              if (session.status === "active" && calculatedPhase === "QUESTION" && session.questionStartTime) {
                const elapsed = Math.floor((Date.now() - session.questionStartTime) / 1000)
                const remaining = Math.max(0, (question.timeLimit || 30) - elapsed)
                setTimeLeft(remaining)
                setIsTimerRunning(remaining > 0)
              } else {
                setTimeLeft(question.timeLimit || 30)
                setIsTimerRunning(false)
              }
            }
          }
          setLoading(false)
        })

        unsubscribeRef.current = unsubscribe
      } catch (error) {
        console.error("Ошибка инициализации:", error)
        setError("Ошибка при загрузке игры")
        setLoading(false)
      }
    }

    initializeGame()

    return () => {
      mounted = false
      cleanup()
    }
  }, [id, user, isAdmin, authLoading, cleanup])

  // Timer rewrite - only run during QUESTION phase
  useEffect(() => {
    // Only create interval if timer should be running
    if (!isTimerRunning || gameSession?.phase !== "QUESTION" || timeLeft <= 0) {
      return
    }

    // Create interval that ticks every second
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer expired - show results automatically
          clearInterval(interval)

          // Use setTimeout to avoid state update during render
          setTimeout(() => {
            handleShowResults()
          }, 0)

          return 0
        }

        return prev - 1
      })
    }, 1000)

    timerRef.current = interval as any

    // Cleanup function
    return () => {
      clearInterval(interval)
    }
  }, [isTimerRunning, timeLeft, gameSession?.phase, gameSession?.gameId])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreOptionsRef.current && !moreOptionsRef.current.contains(event.target as Node)) {
        setShowMoreOptions(false)
      }
    }

    if (showMoreOptions) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showMoreOptions])

  useEffect(() => {
    if (!gameSession) return

    if (gameSession.status === "active" && !gameSession.showLeaderboard && !gameSession.showResults) {
      setPreviousPlayers((prev) => {
        if (
          Object.keys(prev || {}).length === 0 &&
          gameSession.players &&
          Object.keys(gameSession.players || {}).length > 0
        ) {
          return gameSession.players
        }
        return prev
      })
    }
  }, [gameSession])

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await logout()
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы",
      })
      router.push("/")
    } catch (error) {
      console.error("Ошибка выхода:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось выйти из системы",
        variant: "destructive",
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const repairSession = async () => {
    if (!game || !gameSession) return

    try {
      setLoading(true)

      const requiredFields = {
        chat: {},
        code: game.code,
        currentQuestionIndex: 0,
        gameId: game.id,
        hostId: user?.uid || "unknown",
        players: {},
        showLeaderboard: false,
        showPodium: false,
        showResults: false,
        status: "waiting",
        createdAt: Date.now(),
        leaderboard: [],
        phase: "WAITING", // Added phase field
      }

      const sessionRef = ref(realtimeDb, `sessions/${game.id}`)
      const snapshot = await get(sessionRef)
      const currentSession = snapshot.val() || {}

      const updates: Partial<GameSession> = {}
      let hasMissingFields = false

      Object.entries(requiredFields).forEach(([key, defaultValue]) => {
        const fieldValue = currentSession[key]
        const expectedType = typeof defaultValue

        if (fieldValue === undefined || typeof fieldValue !== expectedType) {
          updates[key as keyof GameSession] = defaultValue
          hasMissingFields = true
        }
      })

      if (hasMissingFields) {
        await update(sessionRef, updates)
        toast({
          title: "Сессия восстановлена",
          description: "Отсутствующие поля были добавлены",
        })
      } else {
        toast({
          title: "Проверка завершена",
          description: "Все необходимые поля присутствуют",
          variant: "default",
        })
      }
    } catch (error) {
      console.error("Ошибка восстановления сессии:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось восстановить сессию",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const startGame = async () => {
    if (!game || !gameSession) return

    try {
      await GameService.startGame(game.id)

      toast({
        title: "Игра запущена",
        description: "Игра успешно началась",
      })
    } catch (error) {
      console.error("Ошибка запуска игры:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось запустить игру",
        variant: "destructive",
      })
    }
  }

  const togglePauseResume = async () => {
    if (!game || !currentQuestion) return

    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.id}`)

      if (gameSession?.status === "active") {
        await update(sessionRef, {
          status: "paused",
          phase: "PAUSED", // Update phase
        })
        toast({
          title: "Игра на паузе",
          description: "Игра приостановлена",
        })
      } else if (gameSession?.status === "paused") {
        await update(sessionRef, {
          status: "active",
          questionStartTime: Date.now(),
          phase: "QUESTION", // Update phase
        })
        toast({
          title: "Игра возобновлена",
          description: "Игра продолжается",
        })
      }
    } catch (error) {
      console.error("Ошибка переключения паузы:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось изменить состояние игры",
        variant: "destructive",
      })
    }
  }

  const handleNextQuestion = async () => {
    // Stop any existing timer first
    isTimerRunningRef.current = false
    setIsTimerRunning(false)

    if (timerRef.current) {
      clearInterval(timerRef.current as any)
      timerRef.current = null
    }

    try {
      // Save score deltas before transitioning
      const players = gameSession.players || {}
      for (const playerId of Object.keys(players)) {
        const player = players[playerId]
        if (player && currentQuestion) {
          const answer = player.answers?.find((a: any) => a.questionId === currentQuestion.id)
          const delta = answer?.points || 0

          const playerRef = ref(realtimeDb, `sessions/${gameSession.gameId}/players/${playerId}`)
          await update(playerRef, {
            lastQuestionDelta: delta,
          })
        }
      }

      const nextIndex = gameSession.currentQuestionIndex + 1

      if (nextIndex >= game.questions.length) {
        await GameService.finishGame(gameSession.gameId)
      } else {
        await GameService.nextQuestion(gameSession.gameId, nextIndex)
        const nextQuestion = game.questions[nextIndex]
        setTimeLeft(nextQuestion.timeLimit || 30)
        setIsTimerRunning(true)
        isTimerRunningRef.current = true
      }
    } catch (error) {
      console.error("[v0] Error moving to next question:", error)
    }
  }

  const handleShowResults = async () => {
    // Stop timer immediately and synchronously
    isTimerRunningRef.current = false
    setIsTimerRunning(false)

    if (timerRef.current) {
      clearInterval(timerRef.current as any)
      timerRef.current = null
    }

    setTimeLeft(0)

    try {
      // Save score deltas before transitioning
      const players = gameSession.players || {}
      for (const playerId of Object.keys(players)) {
        const player = players[playerId]
        if (player && currentQuestion) {
          const answer = player.answers?.find((a: any) => a.questionId === currentQuestion.id)
          const delta = answer?.points || 0

          const playerRef = ref(realtimeDb, `sessions/${gameSession.gameId}/players/${playerId}`)
          await update(playerRef, {
            lastQuestionDelta: delta,
          })
        }
      }

      await GameService.showResults(gameSession.gameId)
    } catch (error) {
      console.error("[v0] Error showing results:", error)
    }
  }

  const handleShowLeaderboard = async () => {
    // Stop timer immediately and synchronously
    isTimerRunningRef.current = false
    setIsTimerRunning(false)

    if (timerRef.current) {
      clearInterval(timerRef.current as any)
      timerRef.current = null
    }

    setTimeLeft(0)

    try {
      // Save score deltas before transitioning
      const players = gameSession.players || {}
      for (const playerId of Object.keys(players)) {
        const player = players[playerId]
        if (player && currentQuestion) {
          const answer = player.answers?.find((a: any) => a.questionId === currentQuestion.id)
          const delta = answer?.points || 0

          const playerRef = ref(realtimeDb, `sessions/${gameSession.gameId}/players/${playerId}`)
          await update(playerRef, {
            lastQuestionDelta: delta,
          })
        }
      }

      await GameService.showLeaderboard(gameSession.gameId)
    } catch (error) {
      console.error("[v0] Error showing leaderboard:", error)
    }
  }

  const ShowTop3 = async () => {
    if (!game || !gameSession) return

    try {
      // Save session analytics when transitioning to podium
      try {
        const sessionId = await SessionAnalyticsService.saveCompletedSession(game, gameSession)
        console.log("[v0] Session auto-completed and saved with ID:", sessionId)
      } catch (analyticsError: any) {
        console.error("[v0] Failed to auto-save session analytics:", analyticsError)
      }

      const sessionRef = ref(realtimeDb, `sessions/${game.id}`)
      await update(sessionRef, {
        status: "finished",
        showLeaderboard: false,
        showResults: false,
        phase: "FINISHED", // Added phase field
      })
    } catch (error) {
      console.error("Ошибка показа пьедестала топ-3 игроков:", error)
    }
  }

  const endGame = async () => {
    if (!game || !gameSession) return

    try {
      try {
        const sessionId = await SessionAnalyticsService.saveCompletedSession(game, gameSession)
        console.log("[v0] Session analytics saved successfully with ID:", sessionId)
      } catch (analyticsError: any) {
        console.error("[v0] Failed to save session analytics:", analyticsError)
        console.error("[v0] Error details:", analyticsError.message)
        console.error("[v0] Error code:", analyticsError.code)
        // Continue with ending game even if analytics fails
      }

      await GameService.endGame(game.id)
      toast({
        title: "Игра завершена",
        description: "Игра успешно завершена",
      })
    } catch (error) {
      console.error("[v0] Ошибка завершения игры:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось завершить игру",
        variant: "destructive",
      })
    }
  }

  const restartGame = async () => {
    if (!game || !gameSession) return

    try {
      setLoading(true)

      if (gameSession.startTime && gameSession.sessionId) {
        const playersWithAnswers = Object.values(gameSession.players || {}).filter(
          (p) => p.id !== "host" && p.answers && p.answers.length > 0,
        )

        if (playersWithAnswers.length > 0) {
          console.log("[v0] Saving session before restart...")
          try {
            await SessionAnalyticsService.saveCompletedSession(game, gameSession)
          } catch (saveError: any) {
            console.error("[v0] Failed to save session:", saveError.message)
            // Continue with restart even if save fails
          }
        } else {
          console.log("[v0] Skipping session save - no players with answers")
        }
      }

      const cleanSession: Partial<GameSession> = {
        code: game.code,
        currentQuestionIndex: 0,
        gameId: game.id,
        hostId: user?.uid || "unknown",
        players: gameSession.players || {}, // Keep existing players
        showLeaderboard: false,
        showPodium: false,
        showResults: false,
        status: "waiting",
        createdAt: Date.now(),
        leaderboard: [],
        phase: "WAITING",
        chat: gameSession.chat || {},
      }

      // Remove session tracking fields so new session can start fresh
      const sessionRef = ref(realtimeDb, `sessions/${game.id}`)
      await update(sessionRef, cleanSession)

      if (gameSession?.players && Object.keys(gameSession.players || {}).length > 0) {
        const playersRef = ref(realtimeDb, `sessions/${game.id}/players`)
        const playerUpdates: Record<string, any> = {}

        Object.keys(gameSession.players || {}).forEach((playerId) => {
          if (playerId !== "host") {
            playerUpdates[`${playerId}/score`] = 0
            playerUpdates[`${playerId}/answers`] = []
            playerUpdates[`${playerId}/lastQuestionDelta`] = 0
            playerUpdates[`${playerId}/previousScore`] = 0
          }
        })

        if (Object.keys(playerUpdates).length > 0) {
          await update(playersRef, playerUpdates)
        }
      }

      await GameService.clearChat(game.id)

      console.log("[v0] Game restarted, session reset to waiting")

      toast({
        title: "Игра перезапущена",
        description: "Игра готова к новому раунду",
      })
    } catch (error) {
      console.error("Ошибка перезапуска игры:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось перезапустить игру",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fullRestartGame = async () => {
    if (!game || isRestarting) return

    try {
      setLoading(true)
      setIsRestarting(true)

      if (gameSession?.startTime && gameSession?.sessionId) {
        const playersWithAnswers = Object.values(gameSession.players || {}).filter(
          (p) => p.id !== "host" && p.answers && p.answers.length > 0,
        )

        if (playersWithAnswers.length > 0) {
          console.log("[v0] Saving session before full restart...")
          try {
            await SessionAnalyticsService.saveCompletedSession(game, gameSession)
          } catch (saveError: any) {
            console.error("[v0] Failed to save session:", saveError.message)
            // Continue with restart even if save fails
          }
        } else {
          console.log("[v0] Skipping session save - no players with answers")
        }
      }

      await GameService.fullRestartGame(game.id)

      console.log("[v0] Full restart completed, all players removed, session reset")

      toast({
        title: "Игра перезапущена",
        description: "Все игроки удалены, игра готова к новой сессии",
      })
    } catch (error) {
      console.error("Ошибка полного перезапуска:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить полный перезапуск",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setIsRestarting(false)
    }
  }

  const showQuestionResults = async () => {
    if (!game) return

    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.id}`)
      await update(sessionRef, {
        showResults: true,
        showLeaderboard: false,
        status: "paused",
        phase: "RESULTS", // Added phase field
      })
    } catch (error) {
      console.error("Ошибка отображения результатов:", error)
    }
  }

  const showLeaderboardToPlayers = async () => {
    if (!game) return

    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.id}`)
      await update(sessionRef, {
        showLeaderboard: true,
        showResults: false,
        status: "paused",
        phase: "LEADERBOARD", // Added phase field
      })
    } catch (error) {
      console.error("Ошибка отображения лидерборда:", error)
    }
  }

  const sendSystemMessage = async (message: string, type: "system" | "kick" = "system") => {
    if (!game) return

    try {
      const chatRef = ref(realtimeDb, `sessions/${game.id}/chatMessages`)
      await push(chatRef, {
        id: `msg_${Date.now()}`,
        playerId: "system",
        playerName: "Система",
        playerAvatar: "",
        message,
        timestamp: Date.now(),
        type,
      })
    } catch (error) {
      console.error("Ошибка отправки системного сообщения:", error)
    }
  }

  const kickPlayer = async (playerId: string, reason: string) => {
    if (!game || !gameSession) return

    try {
      const player = gameSession.players[playerId]
      if (!player) return

      await sendSystemMessage(`Администратор исключил ${player.nickname} из игры. Причина: ${reason}`, "kick")

      await GameService.updatePlayerStatus(game.id, playerId, {
        isConnected: false,
        isKicked: true,
        kickReason: reason,
      })

      setTimeout(async () => {
        await GameService.removePlayerFromSession(game.id, playerId)
      }, 2000)

      setKickingPlayer(null)
      setKickReason("")

      toast({
        title: "Игрок исключен",
        description: `${player.nickname} исключен из игры`,
      })
    } catch (error) {
      console.error("Ошибка исключения игрока:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось исключить игрока",
        variant: "destructive",
      })
    }
  }

  const clearChatHandler = async () => {
    if (!game) return

    try {
      await GameService.clearChat(game.id)
      toast({
        title: "Чат очищен",
        description: "Все сообщения удалены",
      })
    } catch (error) {
      console.error("Ошибка очистки чата:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось очистить чат",
        variant: "destructive",
      })
    }
  }

  const resetPlayerAnswers = async () => {
    if (!game) return

    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.id}`)
      const resetTimestamp = Date.now()

      await update(sessionRef, {
        resetAnswers: resetTimestamp,
      })

      toast({
        title: "Ответы сброшены",
        description: "Временные ответы игроков были сброшены",
      })
    } catch (error) {
      console.error("Ошибка сброса ответов:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось сбросить ответы",
        variant: "destructive",
      })
    }
  }

  const getActivePlayers = (): Player[] => {
    if (!gameSession?.players) return []
    return Object.values(gameSession.players || {}).filter((player) => player.isConnected && player.id !== "host")
  }

  const getAllAnsweredPlayers = (): Player[] => {
    if (!gameSession?.players || !currentQuestion) return []
    return Object.values(gameSession.players || {}).filter(
      (player) => player.id !== "host" && player.answers?.some((a) => a.questionId === currentQuestion.id),
    )
  }

  const getPlayerAnswerStatus = (player: Player): { answered: boolean; correct: boolean; answer?: any } => {
    if (!currentQuestion) return { answered: false, correct: false }
    const answer = player.answers?.find((a) => a.questionId === currentQuestion.id)
    return {
      answered: !!answer,
      correct: answer?.isCorrect || false,
      answer: answer?.answer,
    }
  }

  const getAnswerDistribution = () => {
    if (!currentQuestion || !gameSession?.players) return []

    const distribution: { option: string; count: number; isCorrect: boolean }[] = []

    if (
      currentQuestion.type === "MULTIPLE_CHOICE" ||
      currentQuestion.type === "MULTIPLE_SELECT" ||
      currentQuestion.type === "TRUE_FALSE"
    ) {
      currentQuestion.options?.forEach((option, index) => {
        const count = getAllAnsweredPlayers().filter((player) => {
          const answer = player.answers?.find((a) => a.questionId === currentQuestion.id)
          if (!answer) return false
          if (Array.isArray(answer.answer)) {
            return answer.answer.includes(index)
          }
          return answer.answer === index
        }).length

        distribution.push({
          option,
          count,
          isCorrect: (currentQuestion.correctAnswers as number[]).includes(index),
        })
      })
    }

    return distribution
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Загрузка панели ведущего...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-4 text-destructive">{error}</h2>
            <Button onClick={() => router.push("/admin")}>Вернуться к списку игр</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <h2 className="text-xl font-bold mb-4">Игра не найдена</h2>
            <Button onClick={() => router.push("/admin")}>Вернуться к списку игр</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!gameSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Инициализация игровой сессии...</p>
        </div>
      </div>
    )
  }

  const activePlayers = getActivePlayers()
  const answeredPlayers = getAllAnsweredPlayers()
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${game.code}` : ""
  const progressPercentage =
    currentQuestion && timeLeft > 0 ? ((currentQuestion.timeLimit - timeLeft) / currentQuestion.timeLimit) * 100 : 100

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-[1800px]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button variant="outline" onClick={() => router.push("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-2" />К списку игр
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">{game.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {connectionStatus === "connected" ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <Badge variant="outline">Код: {game.code}</Badge>
              <Badge variant="outline">Статус: {gameSession.status}</Badge>
              <Badge variant="outline">Фаза: {gameSession.phase}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChat(!showChat)}
              className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
              Чат
            </Button>
            <div className="ml-1">
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 profile-button shadow-sm hover:shadow-md transition-all duration-200"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Профиль</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 xl:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle>Управление игрой</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      <Users className="w-4 h-4 mr-1" />
                      {activePlayers.length} игроков
                    </Badge>
                    <Badge variant="outline">
                      Вопрос {gameSession.currentQuestionIndex + 1} из {game.questions.length}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {gameSession.status === "waiting" && (
                    <Button onClick={startGame} size="lg" disabled={activePlayers.length === 0}>
                      <Play className="w-4 h-4 mr-2" />
                      Начать игру
                    </Button>
                  )}

                  {/* CHANGE: Все кнопки управления теперь всегда доступны для свободной навигации */}
                  {gameSession.status !== "finished" && (
                    <>
                      <Button
                        onClick={handleShowResults}
                        variant={gameSession.phase === "RESULTS" ? "default" : "outline"}
                      >
                        <BarChart2 className="w-4 h-4 mr-2" />
                        Показать результаты
                      </Button>
                      <Button
                        onClick={handleShowLeaderboard}
                        variant={gameSession.phase === "LEADERBOARD" ? "default" : "outline"}
                        className="flex items-center gap-2"
                      >
                        <Trophy className="w-4 h-4 mr-2" />
                        Показать лидерборд
                      </Button>
                      <Button
                        onClick={handleNextQuestion}
                        variant={gameSession.phase === "QUESTION" ? "default" : "outline"}
                      >
                        <SkipForward className="w-4 h-4 mr-2" />
                        Следующий вопрос
                      </Button>
                    </>
                  )}

                  {gameSession.status === "finished" && (
                    <Button onClick={restartGame} size="lg">
                      <Play className="w-4 h-4 mr-2" />
                      Перезапустить игру
                    </Button>
                  )}

                  <div className="flex gap-2 ml-auto">
                    <div className="relative" ref={moreOptionsRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMoreOptions(!showMoreOptions)}
                        className="flex items-center gap-2"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                        Дополнительно
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${showMoreOptions ? "rotate-180" : ""}`}
                        />
                      </Button>

                      {showMoreOptions && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                          <div className="p-2 space-y-1">
                            {(gameSession.status === "active" || gameSession.status === "paused") && (
                              <Button
                                onClick={() => {
                                  togglePauseResume()
                                  setShowMoreOptions(false)
                                }}
                                variant="ghost"
                                className="w-full justify-start"
                              >
                                {gameSession.status === "active" ? (
                                  <>
                                    <Pause className="w-4 h-4 mr-2" />
                                    Пауза
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Продолжить
                                  </>
                                )}
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                repairSession()
                                setShowMoreOptions(false)
                              }}
                              disabled={loading}
                              className="w-full justify-start"
                            >
                              <Wrench className="w-4 h-4 mr-2" />
                              Восстановить сессию
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                resetPlayerAnswers()
                                setShowMoreOptions(false)
                              }}
                              disabled={loading}
                              className="w-full justify-start"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Сбросить варианты ответов
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                ShowTop3()
                                setShowMoreOptions(false)
                              }}
                              className="w-full justify-start"
                            >
                              <Award className="w-4 h-4 mr-2" />
                              Показать пьедестал топ-3
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                clearChatHandler()
                                setShowMoreOptions(false)
                              }}
                              className="w-full justify-start"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Очистить чат
                            </Button>

                            {/* CHANGE: Added screen mode button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                window.open(`/host/${id}/screen`, "_blank", "noopener,noreferrer")
                                setShowMoreOptions(false)
                              }}
                              className="w-full justify-start"
                            >
                              <Monitor className="w-4 h-4 mr-2" />
                              Режим экрана
                            </Button>

                            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                fullRestartGame()
                                setShowMoreOptions(false)
                              }}
                              disabled={isRestarting}
                              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              {isRestarting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4 mr-2" />
                              )}
                              Полный перезапуск
                            </Button>

                            <Button
                              onClick={() => {
                                endGame()
                                setShowMoreOptions(false)
                              }}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Square className="w-4 h-4 mr-2" />
                              Завершить игру
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CHANGE: Fix condition for showing question card - show for both QUESTION phase AND when currentQuestion exists */}
            {currentQuestion && (gameSession.phase === "QUESTION" || gameSession.status === "active") && (
              <Card className="border-2 shadow-lg">
                <CardHeader className="space-y-3 pb-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-lg sm:text-xl">Текущий вопрос (что видят игроки)</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowQuestionPreview(!showQuestionPreview)}
                        className="h-8"
                      >
                        {showQuestionPreview ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            <span className="text-xs">Скрыть</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            <span className="text-xs">Показать</span>
                          </>
                        )}
                      </Button>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="show-correct"
                          checked={showCorrectAnswers}
                          onCheckedChange={setShowCorrectAnswers}
                        />
                        <Label htmlFor="show-correct" className="text-xs sm:text-sm whitespace-nowrap">
                          Показывать правильные ответы
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-muted rounded-lg">
                      <Clock className="w-5 h-5" />
                      <span
                        className={`text-2xl font-bold tabular-nums ${
                          timeLeft <= 5 ? "text-red-500" : timeLeft <= 10 ? "text-yellow-500" : "text-green-500"
                        }`}
                      >
                        {timeLeft}с
                      </span>
                    </div>
                  </div>
                  <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-linear ${
                        timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white drop-shadow-lg">
                        {Math.round(progressPercentage)}%
                      </span>
                    </div>
                  </div>
                </CardHeader>
                {showQuestionPreview && (
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-lg sm:text-xl font-medium p-4 bg-muted rounded-lg">
                        {currentQuestion.question}
                      </div>

                      {currentQuestion.imageUrl && (
                        <div className="flex justify-center">
                          <img
                            src={currentQuestion.imageUrl || "/placeholder.svg"}
                            alt="Изображение к вопросу"
                            className="max-w-full h-auto max-h-64 rounded-lg border"
                          />
                        </div>
                      )}

                      {(currentQuestion.type === "MULTIPLE_CHOICE" ||
                        currentQuestion.type === "MULTIPLE_SELECT" ||
                        currentQuestion.type === "TRUE_FALSE") && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentQuestion.options?.map((option, index) => {
                            const isCorrect = (currentQuestion.correctAnswers as number[]).includes(index)
                            return (
                              <div
                                key={index}
                                className={`p-3 border rounded-lg ${
                                  showCorrectAnswers && isCorrect
                                    ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-600"
                                    : "bg-gray-50 dark:bg-gray-800"
                                }`}
                              >
                                <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
                                {showCorrectAnswers && isCorrect && (
                                  <Badge variant="default" className="ml-2">
                                    Правильный
                                  </Badge>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {currentQuestion.type === "TEXT_INPUT" && showCorrectAnswers && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Правильные ответы:</p>
                          <div className="flex flex-wrap gap-2">
                            {(currentQuestion.correctAnswers as string[]).map((answer, answerIndex) => (
                              <Badge key={answerIndex} variant="default">
                                {answer}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Тип: {currentQuestion.type}</span>
                        <span>Баллы: {currentQuestion.points}</span>
                      </div>

                      <div className="text-center text-sm text-muted-foreground">
                        <p>
                          Ответили: {answeredPlayers.length} из {activePlayers.length} игроков (
                          {activePlayers.length > 0
                            ? Math.round((answeredPlayers.length / activePlayers.length) * 100)
                            : 0}
                          %)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {gameSession.status === "active" && currentQuestion && gameSession.phase === "QUESTION" && (
              <HostPlayerAnswersPanel
                gameId={game.id}
                players={gameSession.players}
                currentQuestion={currentQuestion}
              />
            )}

            {gameSession.showResults && currentQuestion && gameSession.phase === "RESULTS" && (
              <Card className="border-2 shadow-lg bg-card">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Ответы игроков
                    </CardTitle>
                    <Badge variant="outline" className="w-fit">
                      {answeredPlayers.length} / {activePlayers.length} ответили
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {getAnswerDistribution().map((item, index) => {
                        const totalAnswered = answeredPlayers.length
                        const percentage = totalAnswered > 0 ? Math.round((item.count / totalAnswered) * 100) : 0

                        return (
                          <div
                            key={index}
                            className={`p-4 border-2 rounded-xl transition-all duration-300 hover:shadow-lg ${
                              item.isCorrect
                                ? "bg-green-500/10 border-green-500/50 dark:bg-green-500/20 dark:border-green-500/40"
                                : "bg-muted/50 border-border dark:bg-muted/30"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-3">
                              <span className="font-semibold text-lg text-foreground">{item.option}</span>
                              <Badge
                                variant={item.isCorrect ? "default" : "secondary"}
                                className={item.isCorrect ? "bg-green-600 text-white" : ""}
                              >
                                {item.isCorrect ? "✓ Правильный" : "Неправильный"}
                              </Badge>
                            </div>
                            <div className="w-full bg-muted rounded-full h-3 mb-2 overflow-hidden">
                              <div
                                className={`h-3 rounded-full transition-all duration-1000 ease-out ${
                                  item.isCorrect
                                    ? "bg-gradient-to-r from-green-500 to-green-600"
                                    : "bg-gradient-to-r from-muted-foreground/50 to-muted-foreground/70"
                                }`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-muted-foreground">
                                {item.count} {item.count === 1 ? "игрок" : "игроков"}
                              </span>
                              <span className="text-lg font-bold text-foreground">{percentage}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <span className="font-medium text-foreground">
                          Всего ответили: <span className="text-xl font-bold">{answeredPlayers.length}</span> из{" "}
                          {activePlayers.length}
                        </span>
                      </div>
                      {activePlayers.length > 0 && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-green-500" />
                          <span className="text-lg font-bold text-green-500">
                            {Math.round((answeredPlayers.length / activePlayers.length) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {gameSession.showLeaderboard && gameSession.phase === "LEADERBOARD" && (
              <AnimatedLeaderboard
                players={gameSession.players}
                previousPlayers={previousPlayers}
                showScoreChanges={true}
                showPositionChanges={true}
                title="Таблица лидеров"
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowHostSettings(!showHostSettings)}>
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Настройки панели
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showHostSettings ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>

              {/* Find the hostPanelPreferences settings section and update it: */}
              {showHostSettings && (
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Таблица лидеров</Label>
                    <Switch
                      checked={hostPanelPreferences.showLeaderboard}
                      onCheckedChange={(checked) =>
                        setHostPanelPreferences((prev) => ({ ...prev, showLeaderboard: checked }))
                      }
                    />
                  </div>
                  {hostPanelPreferences.showLeaderboard && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Игроков в таблице</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 bg-transparent"
                          onClick={() => setLeaderboardMaxPlayers((prev) => Math.max(3, prev - 1))}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center font-medium">{leaderboardMaxPlayers}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 bg-transparent"
                          onClick={() => setLeaderboardMaxPlayers((prev) => Math.min(50, prev + 1))}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Чат</Label>
                    <Switch
                      checked={hostPanelPreferences.showChat}
                      onCheckedChange={(checked) => setHostPanelPreferences((prev) => ({ ...prev, showChat: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Список игроков</Label>
                    <Switch
                      checked={hostPanelPreferences.showPlayerList}
                      onCheckedChange={(checked) =>
                        setHostPanelPreferences((prev) => ({ ...prev, showPlayerList: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Превью вопроса</Label>
                    <Switch
                      checked={hostPanelPreferences.showQuestionPreview}
                      onCheckedChange={(checked) =>
                        setHostPanelPreferences((prev) => ({ ...prev, showQuestionPreview: checked }))
                      }
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {gameSession && gameSession.players && Object.keys(gameSession.players || {}).length > 0 && (
              <AnimatedLeaderboard
                players={gameSession.players}
                previousPlayers={previousPlayers}
                showScoreChanges={true}
                showPositionChanges={true}
                compact={true}
                title="Таблица лидеров"
                maxItems={leaderboardMaxPlayers}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Присоединение к игре</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">Код игры:</p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-wider bg-primary/10 py-2 px-4 rounded-lg font-mono">
                    {game.code}
                  </div>
                </div>

                {joinUrl && (
                  <>
                    <div className="p-4 bg-white rounded-lg shadow-sm">
                      <QRCode value={joinUrl} size={150} />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(game.code)
                          toast({
                            title: "Скопировано",
                            description: "Код игры скопирован в буфер обмена",
                          })
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Код
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(joinUrl)
                          toast({
                            title: "Скопировано",
                            description: "Ссылка скопирована в буфер обмена",
                          })
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Ссылка
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {hostPanelPreferences.showPlayerList && (
              <Card>
                <CardHeader>
                  <CardTitle>Игроки ({activePlayers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {activePlayers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Пока нет игроков</p>
                          <p className="text-sm">
                            Поделитесь кодом игры: <strong>{game.code}</strong>
                          </p>
                        </div>
                      ) : (
                        activePlayers.map((player) => {
                          const status = getPlayerAnswerStatus(player)
                          return (
                            <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                {getAvatarDisplay(player.avatar)}
                                <div>
                                  <div className="font-medium">{player.nickname}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Счет: {player.score} • Ответов: {player.answers?.length || 0}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {gameSession.phase === "QUESTION" && currentQuestion && (
                                  <div>
                                    {status.answered ? (
                                      <div className="flex items-center gap-1">
                                        {status.correct ? (
                                          <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                          <XCircle className="w-4 h-4 text-red-500" />
                                        )}
                                        <span className="text-xs">
                                          {Array.isArray(status.answer)
                                            ? status.answer.map((i) => String.fromCharCode(65 + i)).join(", ")
                                            : typeof status.answer === "number"
                                              ? String.fromCharCode(65 + status.answer)
                                              : status.answer}
                                        </span>
                                      </div>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        Думает...
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingPlayerAnswers(player.id)}
                                  title="Просмотр ответов"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setKickingPlayer(player.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <UserX className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {kickingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Исключить игрока
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Игрок: {activePlayers.find((p) => p.id === kickingPlayer)?.nickname}
                </p>
                <Input
                  placeholder="Причина исключения"
                  value={kickReason}
                  onChange={(e) => setKickReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => kickPlayer(kickingPlayer, kickReason || "Нарушение правил")}
                  disabled={!kickReason.trim()}
                >
                  Исключить
                </Button>
                <Button variant="outline" onClick={() => setKickingPlayer(null)}>
                  Отмена
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {user && <UserProfile isOpen={showProfile} onClose={() => setShowProfile(false)} />}
      <AdminGameChat
        gameId={game.id}
        isOpen={showChat}
        onToggle={() => setShowChat(!showChat)}
        gameStatus={gameSession.status}
      />

      {viewingPlayerAnswers && game && gameSession && (
        <PlayerAnswersDialog
          isOpen={true}
          onClose={() => setViewingPlayerAnswers(null)}
          player={gameSession.players[viewingPlayerAnswers]}
          questions={game.questions}
          gameId={game.id}
        />
      )}
    </div>
  )
}
