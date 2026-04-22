"use client"

import { useState, useEffect } from "react"
import { ref, update, onValue, off } from "firebase/database"
import { realtimeDb } from "@/lib/firebase/config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, Pause, SkipForward, Square, Timer, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import type { Game, GameSession } from "@/types/game"
import { toast } from "@/hooks/use-toast"

interface GameHostProps {
  game: Game
}

export default function GameHost({ game }: GameHostProps) {
  const [session, setSession] = useState<GameSession | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  useEffect(() => {
    const sessionRef = ref(realtimeDb, `sessions/${game.code}`)

    const handleSessionUpdate = (snapshot: any) => {
      if (snapshot.exists()) {
        const sessionData = snapshot.val()
        setSession(sessionData)

        // Обновляем таймер
        if (sessionData.status === "active" && sessionData.questionStartTime) {
          const currentQuestion = game.questions[sessionData.currentQuestionIndex]
          if (currentQuestion) {
            const elapsed = Math.floor((Date.now() - sessionData.questionStartTime) / 1000)
            const remaining = Math.max(0, currentQuestion.timeLimit - elapsed)
            setTimeLeft(remaining)
            setIsTimerRunning(remaining > 0)
          }
        } else {
          setIsTimerRunning(false)
        }
      }
    }

    onValue(sessionRef, handleSessionUpdate)

    return () => {
      off(sessionRef, "value", handleSessionUpdate)
    }
  }, [game])

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false)
            handleTimeUp()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTimerRunning, timeLeft])

  const handleStartGame = async () => {
    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.code}`)
      await update(sessionRef, {
        status: "active",
        currentQuestionIndex: 0,
        questionStartTime: Date.now(),
        startTime: Date.now(),
      })

      toast({
        title: "Игра началась!",
        description: "Первый вопрос отображен игрокам",
      })
    } catch (error) {
      console.error("Error starting game:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось начать игру",
        variant: "destructive",
      })
    }
  }

  const handlePauseResume = async () => {
    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.code}`)
      const newStatus = session?.status === "active" ? "paused" : "active"

      await update(sessionRef, {
        status: newStatus,
        ...(newStatus === "active" && { questionStartTime: Date.now() }),
      })

      toast({
        title: newStatus === "active" ? "Игра возобновлена" : "Игра на паузе",
      })
    } catch (error) {
      console.error("Error toggling pause:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось изменить состояние игры",
        variant: "destructive",
      })
    }
  }

  const handleNextQuestion = async () => {
    if (!session) return

    try {
      const nextIndex = session.currentQuestionIndex + 1

      if (nextIndex >= game.questions.length) {
        await handleEndGame()
        return
      }

      const sessionRef = ref(realtimeDb, `sessions/${game.code}`)
      await update(sessionRef, {
        currentQuestionIndex: nextIndex,
        questionStartTime: Date.now(),
        status: "active",
        showResults: false,
        showLeaderboard: false,
      })

      const nextQuestion = game.questions[nextIndex]
      setTimeLeft(nextQuestion.timeLimit)
      setIsTimerRunning(true)

      toast({
        title: "Следующий вопрос",
        description: `Вопрос ${nextIndex + 1} из ${game.questions.length}`,
      })
    } catch (error) {
      console.error("Error moving to next question:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось перейти к следующему вопросу",
        variant: "destructive",
      })
    }
  }

  const handleShowResults = async () => {
    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.code}`)
      await update(sessionRef, {
        showResults: true,
        showLeaderboard: false,
        status: "paused",
      })

      toast({
        title: "Результаты показаны",
        description: "Игроки видят результаты вопроса",
      })
    } catch (error) {
      console.error("Error showing results:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось показать результаты",
        variant: "destructive",
      })
    }
  }

  const handleShowLeaderboard = async () => {
    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.code}`)
      await update(sessionRef, {
        showLeaderboard: true,
        showResults: false,
        status: "paused",
      })

      toast({
        title: "Лидерборд показан",
        description: "Игроки видят таблицу лидеров",
      })
    } catch (error) {
      console.error("Error showing leaderboard:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось показать лидерборд",
        variant: "destructive",
      })
    }
  }

  const handleEndGame = async () => {
    try {
      const sessionRef = ref(realtimeDb, `sessions/${game.code}`)
      await update(sessionRef, {
        status: "finished",
        endTime: Date.now(),
        showPodium: true,
      })

      toast({
        title: "Игра завершена!",
        description: "Показан финальный подиум",
      })
    } catch (error) {
      console.error("Error ending game:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось завершить игру",
        variant: "destructive",
      })
    }
  }

  const handleTimeUp = async () => {
    await handleShowResults()
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Загрузка игровой сессии...</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const currentQuestion = game.questions[session.currentQuestionIndex]
  const progress = ((session.currentQuestionIndex + 1) / game.questions.length) * 100

  return (
    <div className="space-y-4">
      {/* Статус игры */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Управление игрой</span>
            <Badge
              variant={
                session.status === "active" ? "default" : session.status === "finished" ? "secondary" : "outline"
              }
            >
              {session.status === "waiting" && "Ожидание"}
              {session.status === "active" && "Активна"}
              {session.status === "paused" && "Пауза"}
              {session.status === "finished" && "Завершена"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Прогресс */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Прогресс игры</span>
              <span>
                {session.currentQuestionIndex + 1} / {game.questions.length}
              </span>
            </div>
            <Progress value={progress} />
          </div>

          {/* Таймер */}
          {session.status === "active" && currentQuestion && (
            <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg">
              <Timer className="w-6 h-6" />
              <span className={`text-3xl font-bold ${timeLeft <= 5 ? "text-red-500" : ""}`}>{timeLeft}с</span>
            </div>
          )}

          {/* Кнопки управления */}
          <div className="flex flex-wrap gap-2">
            {session.status === "waiting" && (
              <Button onClick={handleStartGame} size="lg" className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Начать игру
              </Button>
            )}

            {(session.status === "active" || session.status === "paused") && (
              <>
                <Button onClick={handlePauseResume} variant="outline">
                  {session.status === "active" ? (
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

                <Button onClick={handleShowResults} variant="outline">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Результаты
                </Button>

                <Button onClick={handleShowLeaderboard} variant="outline">
                  <Users className="w-4 h-4 mr-2" />
                  Лидерборд
                </Button>

                <Button onClick={handleNextQuestion} variant="default">
                  <SkipForward className="w-4 h-4 mr-2" />
                  {session.currentQuestionIndex + 1 >= game.questions.length ? "Завершить" : "След. вопрос"}
                </Button>
              </>
            )}

            {session.status === "finished" && (
              <Button onClick={handleEndGame} variant="outline" size="lg" className="flex-1 bg-transparent">
                <Square className="w-4 h-4 mr-2" />
                Показать подиум
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Текущий вопрос */}
      {currentQuestion && session.status !== "waiting" && (
        <Card>
          <CardHeader>
            <CardTitle>Текущий вопрос</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-lg font-medium">{currentQuestion.question}</div>

            {currentQuestion.imageUrl && (
              <img
                src={currentQuestion.imageUrl || "/placeholder.svg"}
                alt="Вопрос"
                className="max-w-full h-auto rounded-lg border"
              />
            )}

            {currentQuestion.type === "MULTIPLE_CHOICE" && currentQuestion.options && (
              <div className="grid grid-cols-2 gap-2">
                {currentQuestion.options.map((option, index) => {
                  const isCorrect = (currentQuestion.correctAnswers as number[]).includes(index)
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        isCorrect ? "bg-green-50 border-green-300 dark:bg-green-900/20" : "bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span>{option}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Тип: {currentQuestion.type}</span>
              <span>Баллы: {currentQuestion.points}</span>
              <span>Время: {currentQuestion.timeLimit}с</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
