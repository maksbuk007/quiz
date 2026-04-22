"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Users, Trophy, Eye, EyeOff } from "lucide-react"
import type { Question, Player, PlayerAnswer } from "@/types/game"
import { motion, AnimatePresence } from "framer-motion"

interface QuestionResultsProps {
  question: Question
  players: Record<string, Player>
  currentPlayerId?: string
  onShowLeaderboard: () => void
  onNextQuestion: () => void
  isLastQuestion: boolean
  timeLimit: number
  showCorrectAnswer?: boolean
}

export default function QuestionResults({
  question,
  players,
  currentPlayerId,
  onShowLeaderboard,
  onNextQuestion,
  isLastQuestion,
  timeLimit,
  showCorrectAnswer = true,
}: QuestionResultsProps) {
  const [showStats, setShowStats] = useState(false)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(showCorrectAnswer)

  // Получаем статистику ответов
  const getAnswerStats = () => {
    const connectedPlayers = Object.values(players).filter((p) => p.isConnected)
    const totalPlayers = connectedPlayers.length

    if (totalPlayers === 0) return { totalPlayers: 0, answeredPlayers: 0, correctAnswers: 0, answerStats: [] }

    // Получаем последние ответы игроков на текущий вопрос
    const currentAnswers = connectedPlayers
      .map((player) => {
        const lastAnswer = player.answers?.[player.answers.length - 1]
        return lastAnswer ? { player, answer: lastAnswer } : null
      })
      .filter(Boolean) as { player: Player; answer: PlayerAnswer }[]

    const answeredPlayers = currentAnswers.length
    const correctAnswers = currentAnswers.filter((a) => a.answer.isCorrect).length

    let answerStats: any[] = []

    if (question.type === "TEXT_INPUT") {
      // For text input, group by unique answers
      const answerGroups: Record<string, { answer: string; count: number; isCorrect: boolean }> = {}

      currentAnswers.forEach(({ answer }) => {
        const userAnswer = String(answer.answer || "")
          .toLowerCase()
          .trim()
        if (!answerGroups[userAnswer]) {
          answerGroups[userAnswer] = {
            answer: userAnswer,
            count: 0,
            isCorrect: answer.isCorrect,
          }
        }
        answerGroups[userAnswer].count++
      })

      answerStats = Object.values(answerGroups).map((group) => ({
        option: group.answer,
        count: group.count,
        percentage: totalPlayers > 0 ? (group.count / totalPlayers) * 100 : 0,
        isCorrect: group.isCorrect,
      }))
    } else if (question.options) {
      // Статистика по вариантам ответов для multiple choice
      answerStats = question.options.map((option, index) => {
        const count = currentAnswers.filter((a) => {
          if (Array.isArray(a.answer.answer)) {
            return a.answer.answer.includes(index)
          }
          return a.answer.selectedOption === index
        }).length
        const percentage = totalPlayers > 0 ? (count / totalPlayers) * 100 : 0
        const isCorrect = Array.isArray(question.correctAnswers)
          ? question.correctAnswers.includes(index)
          : question.correctAnswers === index

        return {
          option,
          index,
          count,
          percentage,
          isCorrect,
        }
      })
    }

    return {
      totalPlayers,
      answeredPlayers,
      correctAnswers,
      answerStats,
    }
  }

  const stats = getAnswerStats()

  // Показываем статистику через 1 секунду
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowStats(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Получаем ответ текущего игрока
  const getCurrentPlayerAnswer = () => {
    if (!currentPlayerId) return null
    const player = players[currentPlayerId]
    if (!player?.answers?.length) return null
    return player.answers[player.answers.length - 1]
  }

  const currentPlayerAnswer = getCurrentPlayerAnswer()

  const getCorrectAnswerDisplay = () => {
    if (question.type === "TEXT_INPUT") {
      if (Array.isArray(question.correctAnswers) && question.correctAnswers.length > 0) {
        return question.correctAnswers.join(", ")
      }
      return String(question.correctAnswers || "Не указан")
    }
    if (question.options && Array.isArray(question.options)) {
      if (Array.isArray(question.correctAnswers)) {
        return question.correctAnswers
          .map((index) => {
            if (typeof index === "number" && question.options![index]) {
              return question.options![index]
            }
            return String(index)
          })
          .filter(Boolean)
          .join(", ")
      }
      if (typeof question.correctAnswers === "number" && question.options[question.correctAnswers]) {
        return question.options[question.correctAnswers]
      }
    }
    return String(question.correctAnswers || "Не указан")
  }

  const getOptionCount = (index: number) => {
    return stats.answerStats.find((stat) => stat.index === index)?.count || 0
  }

  const totalResponses = stats.answeredPlayers

  return (
    <Card>
      <CardHeader>
        <CardTitle>Результаты вопроса</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Question Text */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium text-lg">{question.text}</p>
          </div>

          {(question.type === "MULTIPLE_CHOICE" ||
            question.type === "MULTIPLE_SELECT" ||
            question.type === "TRUE_FALSE") && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {question.options?.map((option, index) => {
                const isCorrect = (question.correctAnswers as number[]).includes(index)
                const count = getOptionCount(index)
                const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isCorrect && showCorrectAnswers
                        ? "bg-green-100 border-green-500 dark:bg-green-900/30"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isCorrect && showCorrectAnswers && (
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                        <span className="font-medium truncate">{option}</span>
                      </div>
                      <Badge
                        variant={isCorrect && showCorrectAnswers ? "default" : "secondary"}
                        className="ml-2 flex-shrink-0"
                      >
                        {count} ({percentage}%)
                      </Badge>
                    </div>
                    <Progress
                      value={percentage}
                      className={`h-2 ${isCorrect && showCorrectAnswers ? "bg-green-100" : ""}`}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Результат текущего игрока */}
          {currentPlayerAnswer && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <Card
                className={`${
                  currentPlayerAnswer.isCorrect
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-red-500 bg-red-50 dark:bg-red-900/20"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    {currentPlayerAnswer.isCorrect ? (
                      <CheckCircle className="w-12 h-12 text-green-600" />
                    ) : (
                      <XCircle className="w-12 h-12 text-red-600" />
                    )}
                    <div>
                      <h3
                        className={`text-2xl font-bold ${
                          currentPlayerAnswer.isCorrect ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {currentPlayerAnswer.isCorrect ? "Правильно!" : "Неправильно"}
                      </h3>
                      {currentPlayerAnswer.isCorrect && (
                        <p className="text-green-600">+{currentPlayerAnswer.points} очков</p>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>
                      Ваш ответ:{" "}
                      <span className="font-medium">
                        {question.type === "TEXT_INPUT"
                          ? currentPlayerAnswer.answer
                          : question.options?.[currentPlayerAnswer.selectedOption]}
                      </span>
                    </p>
                    <p>
                      Время ответа:{" "}
                      <span className="font-medium">{(currentPlayerAnswer.timeSpent / 1000).toFixed(1)}с</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Правильный ответ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Правильный ответ
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowCorrectAnswers(!showCorrectAnswers)}>
                    {showCorrectAnswers ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Скрыть
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Показать
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showCorrectAnswers ? (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="font-medium text-green-800 dark:text-green-200">{getCorrectAnswerDisplay()}</p>
                    {question.caseSensitive && question.type === "TEXT_INPUT" && (
                      <p className="text-xs text-muted-foreground mt-2">* Учитывается регистр</p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                    Нажмите "Показать" чтобы увидеть правильный ответ
                  </div>
                )}
                {question.explanation && showCorrectAnswers && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Объяснение:</strong> {question.explanation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Статистика ответов */}
          <AnimatePresence>
            {showStats && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Статистика ответов
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Общая статистика */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{stats.totalPlayers}</div>
                        <div className="text-sm text-muted-foreground">Всего игроков</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stats.answeredPlayers}</div>
                        <div className="text-sm text-muted-foreground">Ответили</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{stats.correctAnswers}</div>
                        <div className="text-sm text-muted-foreground">Правильно</div>
                      </div>
                    </div>

                    {/* Статистика по вариантам */}
                    {stats.answerStats.length > 0 && (
                      <div className="space-y-3">
                        {stats.answerStats.map((stat, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.7 + index * 0.1 }}
                            className={`p-3 rounded-lg border ${
                              stat.isCorrect && showCorrectAnswers
                                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                                : "bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {stat.isCorrect && showCorrectAnswers && (
                                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                )}
                                <span className="font-medium truncate">{stat.option}</span>
                              </div>
                              <Badge
                                variant={stat.isCorrect && showCorrectAnswers ? "default" : "secondary"}
                                className="ml-2 flex-shrink-0"
                              >
                                {stat.count} ({stat.percentage.toFixed(0)}%)
                              </Badge>
                            </div>
                            <Progress
                              value={stat.percentage}
                              className={`h-2 ${stat.isCorrect && showCorrectAnswers ? "bg-green-100" : ""}`}
                            />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Кнопки управления */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex gap-4 justify-center"
          >
            <Button onClick={onShowLeaderboard} variant="outline" className="flex items-center gap-2 bg-transparent">
              <Trophy className="w-4 h-4" />
              Показать таблицу лидеров
            </Button>

            <Button onClick={onNextQuestion} className="flex items-center gap-2">
              {isLastQuestion ? "Завершить игру" : "Следующий вопрос"}
            </Button>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
