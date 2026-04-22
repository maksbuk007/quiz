"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { AVATARS } from "@/components/ui/AvatarSelector"
import { Trophy, Users, CheckCircle2, XCircle, Timer, Moon, Sun, QrCode } from "lucide-react"
import type { Question, Player, Game } from "@/types/game"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QRCodeSVG } from "qrcode.react"
import { GameService } from "@/lib/firebase/gameService"
import type { GameSession } from "@/types/game"
import AnimatedLeaderboard from "@/components/game/AnimatedLeaderboard"
import PodiumCeremony from "@/components/game/PodiumCeremony"

export default function HostScreenModePage() {
  const params = useParams()
  const gameId = params.id as string
  const sessionId = params.id as string // Assuming gameId and sessionId are the same for this page

  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(30)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [screenTheme, setScreenTheme] = useState<"light" | "dark">("dark")
  const [ceremonyStep, setCeremonyStep] = useState(0)

  // Use GameService for fetching and subscribing
  useEffect(() => {
    if (!sessionId) return

    const fetchGameData = async () => {
      try {
        // Subscribe to session updates
        const unsubscribe = GameService.subscribeToSession(sessionId, async (session) => {
          if (session) {
            setGameSession(session)

            // Extract players from session
            const playersData = session.players ? Object.values(session.players as Record<string, Player>) : []
            setPlayers(playersData)

            // Load game data if not already loaded
            if (!game && session.gameId) {
              const gameData = await GameService.getGameById(session.gameId)
              setGame(gameData)
            }

            // Update current question
            if (session.currentQuestionIndex !== undefined && game?.questions) {
              const question = game.questions[session.currentQuestionIndex]
              setCurrentQuestion(question || null)
            }
          }
        })

        return unsubscribe
      } catch (error) {
        console.error("[v0] Error subscribing to session:", error)
      }
    }

    const unsubscribePromise = fetchGameData()

    return () => {
      unsubscribePromise.then((fn) => fn?.())
    }
  }, [sessionId, game])

  // Update current question
  useEffect(() => {
    if (gameSession?.currentQuestionIndex !== undefined && game?.questions) {
      const question = game.questions[gameSession.currentQuestionIndex]
      setCurrentQuestion(question || null)
    }
  }, [gameSession?.currentQuestionIndex, game?.questions])

  // Timer logic
  useEffect(() => {
    if (!gameSession?.questionStartTime || gameSession?.phase !== "QUESTION") return

    const questionTime = currentQuestion?.timeLimit || 30
    setTotalTime(questionTime)

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - gameSession.questionStartTime) / 1000)
      const remaining = Math.max(0, questionTime - elapsed)
      setTimeLeft(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 100)
    return () => clearInterval(interval)
  }, [gameSession?.questionStartTime, gameSession?.phase, currentQuestion?.timeLimit])

  useEffect(() => {
    if (gameSession?.phase === "PODIUM" || gameSession?.phase === "FINISHED") {
      setCeremonyStep(0)
      const timer1 = setTimeout(() => setCeremonyStep(1), 800) // 3rd place
      const timer2 = setTimeout(() => setCeremonyStep(2), 2200) // 2nd place
      const timer3 = setTimeout(() => setCeremonyStep(3), 3800) // 1st place
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }
  }, [gameSession?.phase])

  const getAvatarDisplay = (avatarId: string | undefined, size: "sm" | "md" | "lg" | "xl" | "2xl" = "md") => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    const sizeClasses = {
      sm: "w-10 h-10 text-xl",
      md: "w-14 h-14 text-2xl",
      lg: "w-20 h-20 text-4xl",
      xl: "w-28 h-28 text-5xl",
      "2xl": "w-36 h-36 text-6xl",
    }

    if (!avatar) {
      return (
        <div
          className={`${sizeClasses[size]} rounded-xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center`}
        >
          <span className="text-white/70">?</span>
        </div>
      )
    }

    return (
      <div className={`${sizeClasses[size]} rounded-xl flex items-center justify-center ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }

  const getProgressColor = () => {
    const percentage = (timeLeft / totalTime) * 100
    if (percentage <= 25) return "bg-red-500"
    if (percentage <= 50) return "bg-yellow-500"
    return "bg-green-500"
  }

  const answeredPlayers = useMemo(() => {
    if (!currentQuestion || gameSession?.currentQuestionIndex === undefined) return []
    return players.filter((p) => {
      const answer = p.answers?.[gameSession.currentQuestionIndex || 0]
      return answer && answer.answer !== undefined && answer.answer !== null
    })
  }, [players, currentQuestion, gameSession?.currentQuestionIndex])

  useEffect(() => {
    setAnsweredCount(answeredPlayers.length)
  }, [answeredPlayers])

  const totalPlayers = players.filter((p) => p.id !== "host").length
  const sortedPlayers = [...players].filter((p) => p.id !== "host").sort((a, b) => (b.score || 0) - (a.score || 0))
  const joinUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/game/${sessionId}`
    : `${typeof window !== "undefined" ? window.location.origin : ""}/game/${sessionId}`

  const themeStyles =
    screenTheme === "dark"
      ? {
          bg: "bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900",
          cardBg: "bg-white/10 backdrop-blur-md border-white/20",
          text: "text-white",
          textMuted: "text-white/70",
          accent: "text-blue-400",
        }
      : {
          bg: "bg-gradient-to-br from-white via-blue-50 to-purple-50",
          cardBg: "bg-white/90 backdrop-blur-md border-gray-300",
          text: "text-gray-900",
          textMuted: "text-gray-700",
          accent: "text-blue-600",
        }

  // Waiting/Lobby Phase
  if (!gameSession || gameSession.status === "waiting" || gameSession.phase === "WAITING") {
    return (
      <div
        className={`min-h-screen ${themeStyles.bg} flex flex-col items-center justify-center p-6 transition-colors duration-500`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setScreenTheme(screenTheme === "dark" ? "light" : "dark")}
          className={`absolute top-4 right-4 rounded-full ${screenTheme === "light" ? "bg-white/80 hover:bg-white" : ""}`}
        >
          {screenTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-5xl w-full space-y-8"
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
            className="mb-6"
          >
            <Trophy className={`w-20 h-20 ${themeStyles.accent} mx-auto drop-shadow-2xl`} />
          </motion.div>

          <h1 className={`text-5xl lg:text-7xl font-black ${themeStyles.text} mb-6`}>{game?.title || "Квиз"}</h1>
          <p className={`text-2xl ${themeStyles.textMuted} mb-8`}>Присоединяйтесь к игре!</p>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* QR Code Card */}
            <Card
              className={`${themeStyles.cardBg} border-2 shadow-2xl rounded-3xl overflow-hidden ${
                screenTheme === "light" ? "shadow-gray-300" : ""
              }`}
            >
              <CardContent className="p-8 flex flex-col items-center gap-6">
                <h2 className={`text-2xl font-bold ${themeStyles.text} flex items-center gap-3`}>
                  <QrCode className="w-7 h-7" />
                  Сканируйте QR-код
                </h2>
                <div className="bg-white p-6 rounded-3xl shadow-xl ring-4 ring-blue-500/20">
                  <QRCodeSVG value={joinUrl} size={200} level="H" includeMargin={true} />
                </div>
              </CardContent>
            </Card>

            {/* Game Code Card */}
            <Card
              className={`${themeStyles.cardBg} border-2 shadow-2xl rounded-3xl overflow-hidden ${
                screenTheme === "light" ? "shadow-gray-300" : ""
              }`}
            >
              <CardContent className="p-8 flex flex-col items-center justify-center gap-6 h-full">
                <h2 className={`text-2xl font-bold ${themeStyles.text}`}>Или введите код:</h2>
                <Badge className="text-6xl font-black px-12 py-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-3xl shadow-lg">
                  {gameSession?.code || "..."}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Players Grid */}
          <Card
            className={`${themeStyles.cardBg} border-2 rounded-3xl shadow-xl ${
              screenTheme === "light" ? "shadow-gray-300" : ""
            }`}
          >
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Users className={`w-7 h-7 ${themeStyles.accent}`} />
                <h3 className={`text-3xl font-bold ${themeStyles.text}`}>Игроки ({totalPlayers})</h3>
              </div>

              {totalPlayers === 0 ? (
                <p className={`${themeStyles.textMuted} text-xl py-8`}>Ожидание игроков...</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4 max-h-[320px] overflow-hidden">
                  {sortedPlayers.slice(0, 40).map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex flex-col items-center gap-2"
                    >
                      {getAvatarDisplay(player.avatar, "md")}
                      <span className={`text-sm ${themeStyles.text} font-medium truncate max-w-[70px] text-center`}>
                        {player.name}
                      </span>
                    </motion.div>
                  ))}
                  {totalPlayers > 40 && (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div
                        className={`w-16 h-16 rounded-2xl ${themeStyles.cardBg} border-2 flex items-center justify-center`}
                      >
                        <span className={`text-lg font-bold ${themeStyles.text}`}>+{totalPlayers - 40}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (gameSession.phase === "QUESTION" && currentQuestion) {
    return (
      <div className={`min-h-screen ${themeStyles.bg} flex flex-col p-4 sm:p-6 lg:p-8 transition-colors duration-500`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setScreenTheme(screenTheme === "dark" ? "light" : "dark")}
          className="absolute top-4 right-4 rounded-full"
        >
          {screenTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        {/* Header with timer */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Badge
            variant="outline"
            className={`text-lg sm:text-2xl px-4 sm:px-6 py-2 sm:py-3 ${themeStyles.cardBg} border-2 ${themeStyles.text} font-bold rounded-2xl`}
          >
            Вопрос {(gameSession.currentQuestionIndex || 0) + 1} / {game?.questions?.length || 0}
          </Badge>

          <motion.div
            animate={timeLeft <= 5 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
            className={`flex items-center gap-3 px-6 sm:px-10 py-3 sm:py-4 rounded-2xl font-black text-3xl sm:text-5xl lg:text-6xl shadow-2xl ${
              timeLeft <= 5
                ? "bg-red-500 text-white"
                : timeLeft <= 10
                  ? "bg-yellow-500 text-yellow-900"
                  : screenTheme === "dark"
                    ? "bg-white/10 text-white"
                    : "bg-blue-500 text-white"
            }`}
          >
            <Timer className="w-8 h-8 sm:w-12 sm:h-12" />
            {timeLeft}
          </motion.div>
        </div>

        {/* Progress bar */}
        <div className="mb-8 sm:mb-12">
          <div
            className={`h-4 sm:h-6 ${screenTheme === "dark" ? "bg-white/10" : "bg-gray-200"} rounded-full overflow-hidden shadow-inner`}
          >
            <motion.div
              className={`h-full ${getProgressColor()} transition-all duration-100 rounded-full`}
              style={{ width: `${(timeLeft / totalTime) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-6xl">
            {currentQuestion.imageUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center mb-6 sm:mb-8"
              >
                <img
                  src={currentQuestion.imageUrl || "/placeholder.svg"}
                  alt="Изображение вопроса"
                  className="max-h-[420px] sm:max-h-[500px] lg:max-h-[560px] rounded-3xl shadow-2xl object-contain"
                />
              </motion.div>
            )}

            <h1
              className={`text-3xl sm:text-5xl lg:text-7xl font-bold ${themeStyles.text} text-center mb-8 sm:mb-12 lg:mb-16 leading-tight text-balance`}
            >
              {currentQuestion.question}
            </h1>

            {/* Multiple choice options */}
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {currentQuestion.options.map((option, index) => {
                  const colors =
                    screenTheme === "dark"
                      ? [
                          "bg-red-500/30 border-red-500",
                          "bg-blue-500/30 border-blue-500",
                          "bg-yellow-500/30 border-yellow-500",
                          "bg-green-500/30 border-green-500",
                        ]
                      : [
                          "bg-red-200 border-red-400",
                          "bg-blue-200 border-blue-400",
                          "bg-yellow-200 border-yellow-400",
                          "bg-green-200 border-green-400",
                        ]
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, type: "spring" }}
                      className={`p-6 sm:p-8 lg:p-10 rounded-3xl border-4 ${colors[index % 4]} transition-all shadow-lg`}
                    >
                      <div className="flex items-center gap-4 sm:gap-6">
                        <span
                          className={`text-3xl sm:text-4xl lg:text-5xl font-black ${screenTheme === "dark" ? "text-white/80" : "text-gray-800"}`}
                        >
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className={`text-xl sm:text-2xl lg:text-3xl ${themeStyles.text} font-semibold`}>
                          {option}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* True/False */}
            {currentQuestion.type === "TRUE_FALSE" && (
              <div className="grid grid-cols-2 gap-6 sm:gap-10 lg:gap-16 max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-8 sm:p-12 lg:p-16 rounded-3xl border-4 text-center shadow-xl ${
                    screenTheme === "dark" ? "bg-green-500/30 border-green-500" : "bg-green-200 border-green-400"
                  }`}
                >
                  <CheckCircle2
                    className={`w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 ${screenTheme === "dark" ? "text-green-400" : "text-green-600"} mx-auto mb-4`}
                  />
                  <span className={`text-3xl sm:text-5xl lg:text-6xl font-black ${themeStyles.text}`}>Верно</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-8 sm:p-12 lg:p-16 rounded-3xl border-4 text-center shadow-xl ${
                    screenTheme === "dark" ? "bg-red-500/30 border-red-500" : "bg-red-200 border-red-400"
                  }`}
                >
                  <XCircle
                    className={`w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 ${screenTheme === "dark" ? "text-red-400" : "text-red-600"} mx-auto mb-4`}
                  />
                  <span className={`text-3xl sm:text-5xl lg:text-6xl font-black ${themeStyles.text}`}>Неверно</span>
                </motion.div>
              </div>
            )}

            {/* Text input */}
            {currentQuestion.type === "TEXT_INPUT" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-center p-10 sm:p-14 lg:p-20 rounded-3xl border-2 border-dashed max-w-3xl mx-auto ${
                  screenTheme === "dark" ? "bg-white/10 border-white/30" : "bg-gray-100 border-gray-300"
                }`}
              >
                <span className={`text-2xl sm:text-3xl lg:text-4xl ${themeStyles.textMuted}`}>
                  Введите ваш ответ...
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Bottom stats */}
        <div className="mt-8 flex justify-center">
          <Badge
            variant="outline"
            className={`text-xl sm:text-2xl px-8 py-4 ${themeStyles.cardBg} border-2 ${themeStyles.text} font-bold rounded-2xl shadow-lg`}
          >
            <Users className="w-6 h-6 mr-3" />
            Ответили: {answeredCount} / {totalPlayers}
          </Badge>
        </div>
      </div>
    )
  }

  if (gameSession.phase === "RESULTS" && currentQuestion) {
    const questionIndex = gameSession.currentQuestionIndex || 0
    const answerCounts: Record<string, number> = {}
    let correctAnswerKey = ""

    if (currentQuestion.type === "MULTIPLE_CHOICE" && currentQuestion.options) {
      currentQuestion.options.forEach((_, index) => {
        const key = String.fromCharCode(65 + index)
        answerCounts[key] = 0
      })
      // Assuming correctAnswer is an index for MULTIPLE_CHOICE
      correctAnswerKey = String.fromCharCode(65 + (currentQuestion.correctAnswer as number))
    } else if (currentQuestion.type === "TRUE_FALSE") {
      answerCounts["Верно"] = 0
      answerCounts["Неверно"] = 0
      correctAnswerKey = currentQuestion.correctAnswer === true ? "Верно" : "Неверно"
    }

    players.forEach((player) => {
      const answer = player.answers?.[questionIndex]
      if (answer && answer.answer !== undefined) {
        if (currentQuestion.type === "MULTIPLE_CHOICE") {
          const key = String.fromCharCode(65 + (answer.answer as number))
          if (answerCounts[key] !== undefined) {
            answerCounts[key]++
          }
        } else if (currentQuestion.type === "TRUE_FALSE") {
          const key = answer.answer === true ? "Верно" : "Неверно"
          answerCounts[key]++
        }
      }
    })

    return (
      <div className={`min-h-screen ${themeStyles.bg} flex flex-col p-4 sm:p-8 transition-colors duration-500`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setScreenTheme(screenTheme === "dark" ? "light" : "dark")}
          className="absolute top-4 right-4 rounded-full"
        >
          {screenTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12"
        >
          <h1
            className={`text-4xl sm:text-6xl lg:text-7xl font-black ${themeStyles.text} mb-4 flex items-center justify-center gap-4`}
          >
            <Trophy className={`w-12 sm:w-16 ${themeStyles.accent}`} />
            Результаты
          </h1>
          <p className={`text-2xl sm:text-3xl ${themeStyles.textMuted}`}>{currentQuestion.question}</p>
        </motion.div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-5xl">
            {currentQuestion.imageUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center mb-8"
              >
                <img
                  src={currentQuestion.imageUrl || "/placeholder.svg"}
                  alt="Изображение вопроса"
                  className="max-h-[280px] sm:max-h-[320px] rounded-3xl shadow-2xl object-contain"
                />
              </motion.div>
            )}

            {currentQuestion.type === "MULTIPLE_CHOICE" && currentQuestion.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {currentQuestion.options.map((option, index) => {
                  const key = String.fromCharCode(65 + index)
                  const count = answerCounts[key] || 0
                  const percentage = totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0
                  const isCorrect = key === correctAnswerKey

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.15, type: "spring" }}
                      className={`p-6 sm:p-8 lg:p-10 rounded-3xl border-4 transition-all shadow-xl relative overflow-hidden ${
                        isCorrect
                          ? screenTheme === "dark"
                            ? "bg-green-500/30 border-green-500"
                            : "bg-green-200 border-green-400"
                          : screenTheme === "dark"
                            ? "bg-red-500/20 border-red-500/50"
                            : "bg-red-100 border-red-300"
                      }`}
                    >
                      {isCorrect && (
                        <CheckCircle2
                          className={`absolute top-4 right-4 w-10 h-10 ${screenTheme === "dark" ? "text-green-400" : "text-green-600"}`}
                        />
                      )}
                      {!isCorrect && count > 0 && (
                        <XCircle
                          className={`absolute top-4 right-4 w-10 h-10 ${screenTheme === "dark" ? "text-red-400" : "text-red-600"}`}
                        />
                      )}

                      <div className="flex items-center gap-4 sm:gap-6 mb-4">
                        <span className={`text-3xl sm:text-4xl lg:text-5xl font-black ${themeStyles.text}`}>{key}</span>
                        <span className={`text-xl sm:text-2xl lg:text-3xl ${themeStyles.text} font-semibold flex-1`}>
                          {option}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div
                          className={`h-4 ${screenTheme === "dark" ? "bg-white/10" : "bg-gray-200"} rounded-full overflow-hidden`}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, delay: index * 0.15 }}
                            className={`h-full rounded-full ${isCorrect ? "bg-green-500" : "bg-red-500"}`}
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className={`text-lg sm:text-xl font-bold ${themeStyles.textMuted}`}>
                            {count} ответов
                          </span>
                          <span
                            className={`text-2xl sm:text-3xl font-black ${isCorrect ? "text-green-500" : "text-red-500"}`}
                          >
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {currentQuestion.type === "TRUE_FALSE" && (
              <div className="grid grid-cols-2 gap-6 sm:gap-10 max-w-4xl mx-auto">
                {["Верно", "Неверно"].map((option, index) => {
                  const count = answerCounts[option] || 0
                  const percentage = totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0
                  const isCorrect = option === correctAnswerKey

                  return (
                    <motion.div
                      key={option}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.2, type: "spring" }}
                      className={`p-8 sm:p-12 rounded-3xl border-4 text-center relative overflow-hidden shadow-xl ${
                        isCorrect
                          ? screenTheme === "dark"
                            ? "bg-green-500/30 border-green-500"
                            : "bg-green-200 border-green-400"
                          : screenTheme === "dark"
                            ? "bg-red-500/20 border-red-500/50"
                            : "bg-red-100 border-red-300"
                      }`}
                    >
                      {isCorrect && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5, type: "spring" }}
                        >
                          <CheckCircle2
                            className={`w-16 h-16 sm:w-24 sm:h-24 ${screenTheme === "dark" ? "text-green-400" : "text-green-600"} mx-auto mb-4`}
                          />
                        </motion.div>
                      )}
                      {!isCorrect && (
                        <XCircle
                          className={`w-16 h-16 sm:w-24 sm:h-24 ${screenTheme === "dark" ? "text-red-400" : "text-red-600"} mx-auto mb-4`}
                        />
                      )}

                      <span className={`text-3xl sm:text-5xl font-black ${themeStyles.text} block mb-6`}>{option}</span>

                      <div className="space-y-3">
                        <div
                          className={`h-4 ${screenTheme === "dark" ? "bg-white/10" : "bg-gray-200"} rounded-full overflow-hidden`}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, delay: index * 0.2 }}
                            className={`h-full rounded-full ${isCorrect ? "bg-green-500" : "bg-red-500"}`}
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className={`text-xl font-bold ${themeStyles.textMuted}`}>{count} ответов</span>
                          <span
                            className={`text-3xl sm:text-4xl font-black ${isCorrect ? "text-green-500" : "text-red-500"}`}
                          >
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {currentQuestion.type === "TEXT_INPUT" && (
              <div className={`${themeStyles.cardBg} rounded-3xl p-8 sm:p-12 border-2`}>
                <h3 className={`text-2xl sm:text-3xl font-bold ${themeStyles.text} mb-6 text-center`}>
                  Правильный ответ:
                </h3>
                <p className={`text-3xl sm:text-4xl lg:text-5xl font-black ${themeStyles.text} text-center`}>
                  {currentQuestion.correctTextAnswer || "—"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Badge
            variant="outline"
            className={`text-xl sm:text-2xl px-8 py-4 ${themeStyles.cardBg} border-2 ${themeStyles.text} font-bold rounded-2xl`}
          >
            <Users className="w-6 h-6 mr-3" />
            Всего ответили: {answeredCount} из {totalPlayers}
          </Badge>
        </div>
      </div>
    )
  }

  if (gameSession.phase === "LEADERBOARD" || gameSession.showLeaderboard) {
    return (
      <div className={`min-h-screen ${themeStyles.bg} flex flex-col p-4 sm:p-6 lg:p-8 transition-colors duration-500`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setScreenTheme(screenTheme === "dark" ? "light" : "dark")}
          className="absolute top-4 right-4 rounded-full"
        >
          {screenTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <div className="max-w-4xl mx-auto w-full">
          <AnimatedLeaderboard
            players={players.reduce((acc, p) => ({ ...acc, [p.id]: p }), {})}
            showAnimation={true}
            showScoreChanges={true}
            showPositionChanges={true}
            maxItems={15}
            title="Таблица лидеров"
          />
        </div>
      </div>
    )
  }

  if (gameSession.status === "finished" || gameSession.phase === "FINISHED" || gameSession.phase === "PODIUM") {
    return <PodiumCeremony players={sortedPlayers} />
  }

  // Default fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center">
      <div className="text-white text-2xl">Загрузка...</div>
    </div>
  )
}
