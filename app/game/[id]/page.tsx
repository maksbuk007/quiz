"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { GameService } from "@/lib/firebase/gameService"
import ThemeToggle from "@/components/ui/ThemeToggle"
import GameChat from "@/components/game/GameChat"
import AnimatedLeaderboard from "@/components/game/AnimatedLeaderboard"
import PodiumCeremony from "@/components/game/PodiumCeremony"
import { AVATARS } from "@/components/ui/AvatarSelector"
import type { Game, GameSession, Question, Player, PlayerAnswer } from "@/types/game"
import {
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  Copy,
  Share2,
  MessageSquare,
  RefreshCw,
} from "lucide-react"
import { calculateScore } from "@/lib/utils/gameUtils"
import QRCode from "react-qr-code"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "@/components/ui/use-toast"
import { ref, onValue } from "firebase/database"
import { realtimeDb } from "@/lib/firebase/config"

export default function GamePage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const playerId = searchParams.get("playerId")
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [kickedInfo, setKickedInfo] = useState<{ message: string; reason: string } | null>(null)
  const [gameResetInfo, setGameResetInfo] = useState<{ message: string } | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [previousGameSession, setPreviousGameSession] = useState<GameSession | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)

  const [timeLeft, setTimeLeft] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [textAnswer, setTextAnswer] = useState("")
  const [answered, setAnswered] = useState(false)

  const [autoSubmitCancelled, setAutoSubmitCancelled] = useState(false)

  const [chatOpen, setChatOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("disconnected")
  const [showLeaderboardAnimation, setShowLeaderboardAnimation] = useState(false)
  const [showLeaderboardTrigger, setShowLeaderboardTrigger] = useState(false)
  const [showPodium, setShowPodium] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [localShowResults, setLocalShowResults] = useState(false)

  const [hasShownPodium, setHasShownPodium] = useState(false)

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const isInitializedRef = useRef(false)

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

  const resetAnswers = useCallback(async () => {
    setSelectedAnswers([])
    setTextAnswer("")
    setAnswered(false)
    if (playerId && game?.id) {
      try {
        await GameService.deleteTempAnswer(game.id, playerId)
      } catch (error) {
        console.error("Ошибка при очистке временных ответов:", error)
      }
    }
  }, [playerId, game?.id])

  useEffect(() => {
    let raf: number
    const tick = () => {
      setNow(Date.now())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const elapsed = gameSession?.questionStartTime ? (now - gameSession.questionStartTime) / 1000 : 0

  const remaining = Math.max(0, (currentQuestion?.timeLimit || 0) - elapsed)

  useEffect(() => {
    if (remaining === 0) {
      setLocalShowResults(true)
    }
  }, [remaining])

  useEffect(() => {
    if (!id || !playerId || isInitializedRef.current) return

    let mounted = true
    isInitializedRef.current = true

    const initializeGame = async () => {
      try {
        setLoading(true)
        setError("")

        console.log("Инициализация игры:", id, "для игрока:", playerId)

        const gameDoc = await getDoc(doc(db, "games", id as string))
        if (!gameDoc.exists()) {
          if (mounted) {
            setError("Игра не найдена")
            setLoading(false)
          }
          return
        }

        const gameData = { id: gameDoc.id, ...gameDoc.data() } as Game
        console.log("Игра загружена:", gameData)

        if (!mounted) return
        setGame(gameData)

        const unsubscribe = GameService.subscribeToSession(gameData.id, (session) => {
          if (!mounted) return

          console.log("Обновление сессии:", session)

          if (session) {
            if (!session.players || typeof session.players !== "object") {
              console.log("Players object is missing or invalid - game was reset")
              setGameResetInfo({
                message: "Игра была полностью перезапущена администратором",
              })

              toast({
                title: "Игра перезапущена",
                description: "Администратор перезапустил игру. Вы будете перенаправлены на главную страницу.",
                variant: "destructive",
                duration: 5000,
              })

              setTimeout(() => {
                router.push("/")
              }, 3000)
              return
            }

            const updatedPlayer = session.players[playerId]

            if (!updatedPlayer) {
              console.log("Игрок не найден - возможен перезапуск игры")
              setGameResetInfo({
                message: "Игра была полностью перезапущена администратором",
              })

              toast({
                title: "Игра перезапущена",
                description: "Администратор перезапустил игру. Вы будете перенаправлены на главную страницу.",
                variant: "destructive",
                duration: 5000,
              })

              setTimeout(() => {
                router.push("/")
              }, 3000)
              return
            }

            if ((updatedPlayer as any).isKicked) {
              const reason = (updatedPlayer as any).kickReason || "Нарушение правил"
              setKickedInfo({
                message: "Вы были исключены из игры администратором",
                reason: reason,
              })
              setTimeout(() => {
                router.push("/")
              }, 8000)
              return
            }

            if (!updatedPlayer.isConnected && player?.isConnected && !(updatedPlayer as any).isKicked) {
              GameService.updatePlayerStatus(gameData.id, playerId, { isConnected: true })
            }

            setPlayer(updatedPlayer)
            setConnectionStatus("connected")

            if (session && session.showLeaderboard) {
              if (gameSession && !gameSession.showLeaderboard) {
                // Transitioning to leaderboard - save previous state
                setPreviousGameSession(gameSession)
                setShowLeaderboardTrigger(true)
                setTimeout(() => setShowLeaderboardTrigger(false), 4000)
              }
            }

            setGameSession(session)

            if (gameData.questions && gameData.questions[session.currentQuestionIndex]) {
              const question = gameData.questions[session.currentQuestionIndex]
              const prevQuestion = currentQuestion
              setCurrentQuestion(question)

              const playerAnswers = updatedPlayer.answers || []
              const hasAnswered = playerAnswers.some((a) => a.questionId === question.id)
              setAnswered(hasAnswered)

              if (!prevQuestion || prevQuestion.id !== question.id) {
                if (session.showResults || previousGameSession?.showResults) {
                  setSelectedAnswers([])
                  setTextAnswer("")
                  setAnswered(false)
                }
              }

              if (session.questionStartTime && session.status === "active") {
                const elapsed = Math.floor((Date.now() - session.questionStartTime) / 1000)
                const remaining = Math.max(0, question.timeLimit - elapsed)
                setTimeLeft(remaining)
              } else {
                setTimeLeft(question.timeLimit)
              }
            }
          } else {
            setError("Сессия игры не найдена")
          }

          if (mounted && loading) {
            setLoading(false)
          }
        })

        unsubscribeRef.current = unsubscribe

        await GameService.updatePlayerStatus(gameData.id, playerId, {
          isConnected: true,
        })
      } catch (error) {
        console.error("Ошибка при загрузке игры:", error)
        if (mounted) {
          setError("Ошибка при загрузке игры")
          setLoading(false)
        }
      }
    }

    initializeGame()

    return () => {
      mounted = false
      cleanup()
    }
  }, [id, playerId, router])

  useEffect(() => {
    if (gameSession?.status === "active" && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1))
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [gameSession?.status, timeLeft])

  useEffect(() => {
    // Don't auto-submit if:
    // 1. Already answered
    // 2. Results/Leaderboard is being shown (admin clicked early)
    // 3. Phase is not QUESTION
    if (
      timeLeft === 0 &&
      !answered &&
      gameSession?.phase === "QUESTION" &&
      !gameSession?.showResults &&
      !gameSession?.showLeaderboard
    ) {
      handleSubmitAnswer()
    }
  }, [timeLeft, answered, gameSession?.phase, gameSession?.showResults, gameSession?.showLeaderboard])

  useEffect(() => {
    if (gameSession?.phase === "QUESTION") {
      setAutoSubmitCancelled(false)
    }
  }, [gameSession?.currentQuestionIndex, gameSession?.phase])

  useEffect(() => {
    const updatePlayerDisconnected = async () => {
      if (id && playerId) {
        try {
          await GameService.updatePlayerStatus(id as string, playerId, { isConnected: false })
        } catch (error) {
          console.error("Ошибка при обновлении статуса подключения:", error)
        }
      }
    }

    const handleBeforeUnload = () => {
      updatePlayerDisconnected()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePlayerDisconnected()
      } else if (id && playerId) {
        GameService.updatePlayerStatus(id as string, playerId, { isConnected: true })
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      updatePlayerDisconnected()
    }
  }, [id, playerId])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  useEffect(() => {
    if (!id) return

    const resetRef = ref(realtimeDb, `sessions/${id}/resetAnswers`)
    const unsubscribe = onValue(resetRef, (snapshot) => {
      const resetTimestamp = snapshot.val()

      if (resetTimestamp && typeof resetTimestamp === "number") {
        const now = Date.now()
        const timeDiff = now - resetTimestamp

        if (timeDiff >= 0 && timeDiff <= 2000 && !answered) {
          console.log("Получен сигнал сброса ответов от ведущего:", resetTimestamp)

          setSelectedAnswers([])
          setTextAnswer("")

          toast({
            title: "Варианты сброшены",
            description: "Ведущий сбросил выбранные варианты ответов",
            duration: 2000,
          })
        }
      }
    })

    return () => unsubscribe()
  }, [id, answered])

  useEffect(() => {
    if (gameSession?.status === "finished" && !hasShownPodium && !showPodium) {
      setShowPodium(true)
      setHasShownPodium(true)
    }
  }, [gameSession?.status, hasShownPodium, showPodium])

  const handleOptionSelect = (optionIndex: number) => {
    if (answered || gameSession?.status !== "active") return

    if (currentQuestion?.type === "MULTIPLE_CHOICE" || currentQuestion?.type === "TRUE_FALSE") {
      setSelectedAnswers([optionIndex])
    } else if (currentQuestion?.type === "MULTIPLE_SELECT") {
      setSelectedAnswers((prev) =>
        prev.includes(optionIndex) ? prev.filter((i) => i !== optionIndex) : [...prev, optionIndex],
      )
    }
  }

  const handleSubmitAnswer = async () => {
    if (answered || !currentQuestion || !gameSession || !player) return

    try {
      let answer: string | string[] | number[]
      let isCorrect = false

      if (
        (currentQuestion.type === "MULTIPLE_CHOICE" ||
          currentQuestion.type === "TRUE_FALSE" ||
          currentQuestion.type === "MULTIPLE_SELECT") &&
        selectedAnswers.length === 0
      ) {
        alert("Пожалуйста, выберите хотя бы один вариант ответа")
        return
      }

      if (currentQuestion.type === "TEXT_INPUT" && textAnswer.trim() === "") {
        alert("Пожалуйста, введите ответ")
        return
      }

      switch (currentQuestion.type) {
        case "MULTIPLE_CHOICE":
        case "MULTIPLE_SELECT":
        case "TRUE_FALSE":
          answer = selectedAnswers
          isCorrect = checkAnswer(selectedAnswers, currentQuestion.correctAnswers as number[])
          break
        case "TEXT_INPUT":
          answer = textAnswer.trim()
          isCorrect = checkAnswer(answer, currentQuestion.correctAnswers as string[])
          break
        default:
          answer = []
      }

      const timeSpent = gameSession.questionStartTime ? Date.now() - gameSession.questionStartTime : 0
      const points = isCorrect
        ? calculateScore(true, currentQuestion.points, timeSpent, currentQuestion.timeLimit * 1000)
        : 0

      const playerAnswer: PlayerAnswer = {
        questionId: currentQuestion.id,
        answer,
        timeSpent,
        isCorrect,
        points,
        submittedAt: Date.now(),
      }

      const currentAnswers = player.answers || []
      const newAnswers = [...currentAnswers, playerAnswer]
      const newScore = player.score + points

      await GameService.updatePlayerStatus(gameSession.gameId, player.id, {
        answers: newAnswers,
        score: newScore,
      })

      setAnswered(true)

      console.log("Ответ отправлен, выбранные варианты остаются видимыми")
    } catch (error) {
      console.error("Ошибка при отправке ответа:", error)
    }
  }

  const checkAnswer = (userAnswer: any, correctAnswers: any): boolean => {
    if (Array.isArray(userAnswer) && Array.isArray(correctAnswers)) {
      return (
        userAnswer.length === correctAnswers.length && userAnswer.every((answer) => correctAnswers.includes(answer))
      )
    }
    if (typeof userAnswer === "string" && Array.isArray(correctAnswers)) {
      return correctAnswers.some((answer) => answer.toString().toLowerCase() === userAnswer.toString().toLowerCase())
    }
    return userAnswer === correctAnswers
  }

  const getAnswerResult = (): { isCorrect: boolean; correctAnswer: any; pointsEarned: number } | null => {
    if (!currentQuestion || !player) return null

    const answer = player.answers?.find((a) => a.questionId === currentQuestion.id)
    if (!answer) return null

    return {
      isCorrect: answer.isCorrect,
      correctAnswer: currentQuestion.correctAnswers,
      pointsEarned: answer.points,
    }
  }

  const getAnswerDistribution = () => {
    if (!currentQuestion || !gameSession?.players) return []

    const distribution: { option: string; count: number; percentage: number; isCorrect: boolean }[] = []

    // ✅ Считаем от ВСЕХ игроков, которые ответили на этот вопрос (не только активных!)
    const totalAnswered = Object.values(gameSession.players).filter((player) =>
      player.answers?.some((a) => a.questionId === currentQuestion.id),
    ).length

    if (
      currentQuestion.type === "MULTIPLE_CHOICE" ||
      currentQuestion.type === "MULTIPLE_SELECT" ||
      currentQuestion.type === "TRUE_FALSE"
    ) {
      currentQuestion.options?.forEach((option, index) => {
        const count = Object.values(gameSession.players).filter((player) => {
          const answer = player.answers?.find((a) => a.questionId === currentQuestion.id)
          if (!answer) return false
          if (Array.isArray(answer.answer)) {
            return answer.answer.includes(index)
          }
          return answer.answer === index
        }).length

        const percentage = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0

        distribution.push({
          option,
          count,
          percentage,
          isCorrect: (currentQuestion.correctAnswers as number[]).includes(index),
        })
      })
    }

    return distribution
  }

  const canUseTwoColumns = (options: string[] | undefined): boolean => {
    if (!options || options.length === 0) return false
    // Проверяем, все ли варианты короткие (меньше 60 символов)
    const maxLength = 60
    return options.every((option) => option.length <= maxLength)
  }

  const canUseTwoColumnsOnMobile = (options: string[] | undefined): boolean => {
    if (!options || options.length === 0) return false
    // Проверяем, все ли варианты очень короткие (не более 10 символов)
    const maxLength = 10
    return options.every((option) => option.length <= maxLength)
  }

  if (gameResetInfo) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md mx-4 border-blue-500 border-2 shadow-2xl">
          <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
            <CardTitle className="flex items-center gap-2 text-blue-600 text-center justify-center">
              <RefreshCw className="w-6 h-6" />
              Игра перезапущена
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 p-6">
            <div className="space-y-3">
              <p className="text-lg font-medium">{gameResetInfo.message}</p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-blue-600 dark:text-blue-400 font-medium">
                  Все результаты сброшены, игра начинается заново
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Вы будете перенаправлены на главную страницу через 3 секунды
            </p>
            <Button onClick={() => router.push("/")} className="w-full">
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (kickedInfo) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md mx-4 border-red-500 border-2 shadow-2xl">
          <CardHeader className="bg-red-50 dark:bg-red-900/20">
            <CardTitle className="flex items-center gap-2 text-red-600 text-center justify-center">
              <AlertTriangle className="w-6 h-6" />
              Исключение из игры
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 p-6">
            <div className="space-y-3">
              <p className="text-lg font-medium">{kickedInfo.message}</p>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Причина исключения:</p>
                <p className="text-red-600 dark:text-red-400 font-medium">{kickedInfo.reason}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Вы будете перенаправлены на главную страницу через 8 секунд</p>
            <Button onClick={() => router.push("/")} className="w-full" variant="destructive">
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Загрузка игры...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <h2 className="text-xl font-bold mb-4 text-destructive">{error}</h2>
            <Button onClick={() => router.push("/")} className="mt-4">
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!game || !gameSession || !player) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <h2 className="text-xl font-bold mb-4">Игра не найдена</h2>
            <Button onClick={() => router.push("/")}>Вернуться на главную</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameSession.status === "waiting") {
    const connectedPlayers = gameSession?.players
      ? Object.values(gameSession.players).filter((p) => p.isConnected && p.id !== "host")
      : []
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${game.code}` : ""

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-lg lg:order-1">
              <CardHeader>
                <CardTitle className="text-center text-2xl lg:text-3xl">{game.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-center">
                <div className="bg-primary/10 p-4 rounded-lg">
                  <p className="text-lg font-medium">Ожидание начала игры</p>
                  <p className="text-sm text-muted-foreground mt-1">Ведущий запустит игру, когда все будут готовы</p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  {getAvatarDisplay(player.avatar)}
                  <div>
                    <div className="font-medium text-lg">{player.nickname}</div>
                    <div className="text-sm text-muted-foreground">{player.score} баллов</div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-primary">
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Игроков: {connectedPlayers.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg lg:order-3">
              <CardHeader>
                <CardTitle className="text-center text-lg">Пригласить друзей</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">Код игры:</p>
                  <div className="text-3xl font-bold tracking-wider bg-primary/10 py-2 px-4 rounded-lg font-mono">
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
                          alert("Код скопирован!")
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
                          alert("Ссылка скопирована!")
                        }}
                      >
                        <Share2 className="w-4 h-4 mr-1" />
                        Ссылка
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6 lg:order-2">
            <Card className="shadow-lg h-full">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Участники игры</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {connectedPlayers.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        p.id === player.id ? "bg-primary/10 border-primary/30" : "bg-muted/30"
                      }`}
                    >
                      {getAvatarDisplay(p.avatar)}
                      <div className="flex-1">
                        <div className="font-medium">{p.nickname}</div>
                        <div className="text-sm text-muted-foreground">{p.score} баллов</div>
                      </div>
                      {p.id === player.id && <Badge variant="outline">Вы</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Improved button styling with consistent spacing and better visual appearance */}
        <div className="fixed bottom-4 right-4 flex items-center gap-3 z-50">
          {game.settings?.enableChat && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsChatOpen(!chatOpen)}
              className="flex items-center gap-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-background"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="hidden md:inline">Чат</span>
            </Button>
          )}
          <div className="shadow-lg rounded-full">
            <ThemeToggle />
          </div>
        </div>

        {game.settings?.enableChat && (
          <GameChat
            gameId={game.id}
            playerId={player.id}
            playerName={player.nickname}
            playerAvatar={player.avatar}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            gameStatus={gameSession.status}
          />
        )}
      </div>
    )
  }

  if (gameSession.status === "finished") {
    const sortedPlayers = gameSession?.players
      ? Object.values(gameSession.players)
          .filter((p) => p.id !== "host")
          .sort((a, b) => b.score - a.score)
      : []

    if (showPodium) {
      return <PodiumCeremony players={sortedPlayers} currentPlayer={player} onComplete={() => setShowPodium(false)} />
    }

    const playerRank = sortedPlayers.findIndex((p) => p.id === player.id) + 1

    return (
      <div className="container mx-auto p-4 max-w-md">
        {/* Improved button layout with consistent spacing */}
        <div className="flex justify-end items-center gap-3 mb-4">
          {game.settings?.enableChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChatOpen(!chatOpen)}
              className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
              Чат
            </Button>
          )}
          <ThemeToggle />
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              Игра завершена!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="bg-primary/10 p-4 rounded-lg">
              <p className="text-lg font-medium">Ваш результат</p>
              <p className="text-3xl font-bold text-primary">{player.score} баллов</p>
              <p className="text-sm text-muted-foreground">
                Место: {playerRank} из {sortedPlayers.length}
              </p>
            </div>

            <Button onClick={() => setShowPodium(true)} className="w-full mb-4">
              Посмотреть церемонию награждения
            </Button>

            <div className="space-y-2">
              <p className="font-medium">Топ-3 игроков:</p>
              {sortedPlayers.slice(0, 3).map((p, index) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    p.id === player.id ? "bg-primary/20" : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-6">{index + 1}</span>
                    {getAvatarDisplay(p.avatar)}
                    <span className="font-medium">{p.nickname}</span>
                  </div>
                  <span className="font-bold">{p.score}</span>
                </div>
              ))}
            </div>

            <Button onClick={() => router.push("/")} className="w-full">
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>

        {game.settings?.enableChat && (
          <GameChat
            gameId={game.id}
            playerId={player.id}
            playerName={player.nickname}
            playerAvatar={player.avatar}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            gameStatus={game.status}
          />
        )}
      </div>
    )
  }

  if (gameSession.showResults && currentQuestion) {
    const showResults = localShowResults || gameSession?.showResults
    const answerResult = getAnswerResult()
    const answerDistribution = getAnswerDistribution()

    return (
      <div className="container mx-auto p-4 max-w-2xl">
        {/* Improved button layout with consistent spacing */}
        <div className="flex justify-end items-center gap-3 mb-4">
          {game.settings?.enableChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChatOpen(!chatOpen)}
              className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
              Чат
            </Button>
          )}
          <ThemeToggle />
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Результаты вопроса</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentQuestion.imageUrl && (
              <div className="text-center">
                <img
                  src={currentQuestion.imageUrl || "/placeholder.svg"}
                  alt="Изображение к вопросу"
                  className="max-w-full h-auto max-h-64 mx-auto rounded-lg shadow-md"
                />
              </div>
            )}

            <div className="text-xl font-medium p-4 bg-muted rounded-lg text-center">{currentQuestion.question}</div>

            {answerResult && (
              <div
                className={`p-4 rounded-lg text-center ${
                  answerResult.isCorrect ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  {answerResult.isCorrect ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  )}
                  <span className="font-bold">{answerResult.isCorrect ? "Правильно!" : "Неправильно"}</span>
                </div>
                {answerResult.isCorrect && (
                  <p className="text-sm mb-2 text-green-700 dark:text-green-300">+{answerResult.pointsEarned} баллов</p>
                )}
                {!answerResult.isCorrect && (
                  <p className="text-sm mb-2">
                    Правильный ответ:{" "}
                    {Array.isArray(answerResult.correctAnswer)
                      ? answerResult.correctAnswer.map((index) => currentQuestion.options?.[index] || index).join(", ")
                      : answerResult.correctAnswer}
                  </p>
                )}
              </div>
            )}

            {currentQuestion.explanation && (
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Объяснение:</h4>
                <p className="text-sm">{currentQuestion.explanation}</p>
              </div>
            )}

            {answerDistribution.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-center">Результаты ответов</h4>
                {answerDistribution.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg ${
                      item.isCorrect
                        ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-600"
                        : "bg-gray-50 dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{item.option}</span>
                      <Badge variant={item.isCorrect ? "default" : "outline"}>
                        {item.isCorrect ? "Правильный" : "Неправильный"}
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-1000 ${item.isCorrect ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {item.count} ответов ({item.percentage}%)
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center">
              <p className="text-lg font-medium"></p>
              <p className="text-sm text-muted-foreground">
                Вопрос {gameSession.currentQuestionIndex + 1} из {game.questions.length}
              </p>
            </div>

            <div className="text-center text-muted-foreground">
              <p>Ожидание следующего вопроса...</p>
            </div>
          </CardContent>
        </Card>

        {game.settings?.enableChat && (
          <GameChat
            gameId={game.id}
            playerId={player.id}
            playerName={player.nickname}
            playerAvatar={player.avatar}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            gameStatus={gameSession.status}
          />
        )}
      </div>
    )
  }

  if (gameSession.showLeaderboard) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Improved button layout with consistent spacing */}
        <div className="flex justify-end items-center gap-3 mb-4">
          {game.settings?.enableChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
              Чат
            </Button>
          )}
          <ThemeToggle />
        </div>

        <AnimatedLeaderboard
          players={gameSession.players || {}}
          currentPlayerId={player?.id}
          showAnimation={true}
          previousPlayers={previousGameSession?.players || {}}
          showScoreChanges={true}
          showPositionChanges={true}
          maxItems={10}
          compact={false}
          title="Таблица лидеров"
        />

        <div className="mt-4 text-center text-muted-foreground">
          <p>Ожидание следующего вопроса...</p>
        </div>

        {game.settings?.enableChat && (
          <GameChat
            gameId={game.id}
            playerId={player?.id}
            playerName={player?.nickname || ""}
            playerAvatar={player?.avatar || ""}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            gameStatus={gameSession.status}
          />
        )}
      </div>
    )
  }

  if (gameSession.status === "active" && currentQuestion) {
    const elapsedSec = gameSession?.questionStartTime ? (now - gameSession.questionStartTime) / 1000 : 0

    const remaining = currentQuestion?.timeLimit != null ? Math.max(0, currentQuestion.timeLimit - elapsedSec) : 0

    const displayTimeLeft = Math.ceil(remaining)

    const showResults = localShowResults || gameSession?.showResults
    const answerResult = getAnswerResult()

    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <Badge variant="outline">
            Вопрос {gameSession.currentQuestionIndex + 1} из {game.questions.length}
          </Badge>
          {/* Improved button layout with consistent spacing */}
          <div className="flex items-center gap-3">
            {connectionStatus === "connected" ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            {game.settings?.enableChat && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <MessageSquare className="w-4 h-4" />
                Чат
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* Waiting overlay when answered */}
        <AnimatePresence>
          {answered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center space-y-6"
              >
                {/* Success checkmark animation */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", damping: 15, stiffness: 200 }}
                  className="w-20 h-20 rounded-full bg-green-500/20 mx-auto flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-green-500"
                  >
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                </motion.div>

                {/* Success message */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <h3 className="text-2xl font-bold">Ответ отправлен!</h3>
                  <p className="text-sm text-muted-foreground">Твой ответ успешно записан</p>
                </motion.div>

                {/* Answered count */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="pt-2"
                >
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const answeredCount = Object.values(gameSession?.players ?? {}).filter(p => {
                        // Добавляем защиту от отсутствия gameSession или индекса
                        const currentIndex = gameSession?.currentQuestionIndex ?? 0;
                        const answers = Array.isArray(p.answers) ? p.answers : [];
                        
                        // Проверяем, что в массиве по текущему индексу что-то ЕСТЬ
                        return answers[currentIndex] !== undefined && answers[currentIndex] !== null;
                      }).length;
                      
                      const getPluralForm = (count: number) => {
                        if (count % 10 === 1 && count % 100 !== 11) return " участник"
                        if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return " участника"
                        return " участников"
                      }

                      return (
                        <>
                          <span className="font-semibold text-foreground">{answeredCount}</span>
                          <span>{getPluralForm(Math.max(answeredCount, answered ? 1 : 0))} ответили на этот вопрос</span>

                        </>
                      )
                    })()}
                  </div>
                </motion.div>

                {/* Enhanced loading spinner */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="pt-4 space-y-3"
                >
                  <p className="text-xs text-muted-foreground">Ожидаем результатов...</p>
                  
                  {/* Pulsing radius loader */}
                  <div className="flex justify-center items-center py-3">
                    <motion.div
                      className="absolute w-12 h-12 rounded-full border-2 border-primary"
                      animate={{ 
                        scale: [1, 1.5, 1],
                        opacity: [1, 0.3, 1]
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question card only shown when not answered */}
        {!answered && (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Вопрос</CardTitle>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className={`font-bold ${displayTimeLeft <= 5 ? "text-red-500" : ""}`}>{displayTimeLeft}с</span>
                </div>
              </div>
              <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`absolute top-0 left-0 h-full ${
                    displayTimeLeft <= 5 ? "bg-red-500" : displayTimeLeft <= 10 ? "bg-yellow-500" : "bg-green-500"
                  }`}
                  animate={{
                    width: `${(remaining / (currentQuestion.timeLimit || 1)) * 100}%`,
                  }}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
            {currentQuestion.imageUrl && (
              <div className="text-center">
                <img
                  src={currentQuestion.imageUrl || "/placeholder.svg"}
                  alt="Изображение к вопросу"
                  className="max-w-full h-auto max-h-64 mx-auto rounded-lg shadow-md"
                />
              </div>
            )}

            <div className="text-xl font-medium text-center p-4 bg-muted rounded-lg">{currentQuestion.question}</div>

            {(currentQuestion.type === "MULTIPLE_CHOICE" || currentQuestion.type === "TRUE_FALSE") && (
              <div
                className={`grid gap-3 ${
                  canUseTwoColumnsOnMobile(currentQuestion.options)
                    ? "grid-cols-2"
                    : canUseTwoColumns(currentQuestion.options)
                      ? "grid-cols-1 sm:grid-cols-2"
                      : "grid-cols-1"
                }`}
              >
                {currentQuestion.options?.map((option, index) => (
                  <Button
                    key={index}
                    variant={selectedAnswers.includes(index) ? "default" : "outline"}
                    className="w-full text-left justify-start h-auto min-h-[3.5rem] p-4 transition-all duration-200 hover:scale-[1.02] whitespace-normal"
                    onClick={() => handleOptionSelect(index)}
                    disabled={answered}
                  >
                    <div className="flex items-start gap-3 w-full min-w-0">
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 flex-shrink-0">
                        {selectedAnswers.includes(index) && <CheckCircle className="w-4 h-4" />}
                      </div>
                      <span className="flex-1 min-w-0 break-words text-left leading-relaxed [overflow-wrap:anywhere] [word-break:break-word] whitespace-normal">
                        {option}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            )}

            {currentQuestion.type === "MULTIPLE_SELECT" && (
              <div
                className={`grid gap-3 ${
                  canUseTwoColumnsOnMobile(currentQuestion.options)
                    ? "grid-cols-2"
                    : canUseTwoColumns(currentQuestion.options)
                      ? "grid-cols-1 sm:grid-cols-2"
                      : "grid-cols-1"
                }`}
              >
                {currentQuestion.options?.map((option, index) => (
                  <Button
                    key={index}
                    variant={selectedAnswers.includes(index) ? "default" : "outline"}
                    className="w-full text-left justify-start h-auto min-h-[3.5rem] p-4 transition-all duration-200 hover:scale-[1.02] whitespace-normal"
                    onClick={() => handleOptionSelect(index)}
                    disabled={answered}
                  >
                    <div className="flex items-start gap-3 w-full min-w-0">
                      <div className="w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 flex-shrink-0">
                        {selectedAnswers.includes(index) && <CheckCircle className="w-4 h-4" />}
                      </div>
                      <span className="flex-1 min-w-0 break-words text-left leading-relaxed [overflow-wrap:anywhere] [word-break:break-word] whitespace-normal">
                        {option}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            )}

            {currentQuestion.type === "TEXT_INPUT" && (
              <div className="space-y-3">
                <input
                  type={currentQuestion.numbersOnly ? "number" : "text"}
                  value={textAnswer}
                  onChange={(e) => {
                    const value = e.target.value
                    // Additional validation for numbersOnly flag
                    if (currentQuestion.numbersOnly && value && !/^\d*\.?\d*$/.test(value)) {
                      return // Ignore non-numeric input
                    }
                    setTextAnswer(value)
                  }}
                  placeholder={currentQuestion.numbersOnly ? "Введите число" : "Введите ваш ответ"}
                  className="w-full p-4 text-lg rounded-[12px] border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                  disabled={answered}
                  onKeyPress={(e) => e.key === "Enter" && handleSubmitAnswer()}
                />
                {currentQuestion.numbersOnly && <p className="text-xs text-muted-foreground">Только числовой ввод</p>}
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">Баллов за правильный ответ: {currentQuestion.points}</div>

              {!answered && displayTimeLeft > 0 && (
                <Button onClick={handleSubmitAnswer} size="lg" className="px-8">
                  Ответить
                </Button>
              )}
            </div>

            {showResults && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground"></p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {game.settings?.enableChat && (
          <GameChat
            gameId={game.id}
            playerId={player.id}
            playerName={player.nickname}
            playerAvatar={player.avatar}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            gameStatus={gameSession.status}
          />
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-md">
      {/* Improved button layout with consistent spacing */}
      <div className="flex justify-end items-center gap-3 mb-4">
        {game.settings?.enableChat && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChatOpen(!chatOpen)}
            className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <MessageSquare className="w-4 h-4" />
            Чат
          </Button>
        )}
        <ThemeToggle />
      </div>
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center justify-center p-8">
          <h2 className="text-xl font-bold mb-4">Игра на паузе</h2>
          <p className="text-muted-foreground text-center">Ожидание действий ведущего...</p>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Ваш счет: {player.score} баллов</p>
          </div>
        </CardContent>
      </Card>

      {game.settings?.enableChat && (
        <GameChat
          gameId={game.id}
          playerId={player.id}
          playerName={player.nickname}
          playerAvatar={player.avatar}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          gameStatus={gameSession.status}
        />
      )}
    </div>
  )
}
