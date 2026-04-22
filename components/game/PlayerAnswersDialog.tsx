"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle, XCircle, Clock, Award, Ban, Check } from "lucide-react"
import type { Player, Question, PlayerAnswer } from "@/types/game"
import { AVATARS } from "@/components/ui/AvatarSelector"
import { ref, update, get } from "firebase/database"
import { realtimeDb } from "@/lib/firebase/config"
import { toast } from "@/components/ui/use-toast"
import { calculatePoints } from "@/lib/utils/pointsCalculation"

interface PlayerAnswersDialogProps {
  isOpen: boolean
  onClose: () => void
  player: Player
  questions: Question[]
  gameId: string
}

export default function PlayerAnswersDialog({ isOpen, onClose, player, questions, gameId }: PlayerAnswersDialogProps) {
  const [processing, setProcessing] = useState(false)

  const getAvatarDisplay = (avatarId: string) => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    if (!avatar) return "?"
    return (
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}с`
  }

  const getQuestionById = (questionId: string) => {
    return questions.find((q) => q.id === questionId)
  }

  const getAnswerText = (answer: PlayerAnswer, question: Question) => {
    if (question.type === "TEXT_INPUT") {
      return (answer.answer as string) || "Нет ответа"
    }

    if (question.type === "TRUE_FALSE") {
      const val = answer.answer
      if (val === true || val === "true" || val === 1) return "Верно"
      if (val === false || val === "false" || val === 0) return "Неверно"
      return String(answer.answer)
    }

    if (question.type === "MULTIPLE_SELECT" && Array.isArray(answer.answer)) {
      if (!question.options || question.options.length === 0) {
        return answer.answer.map((index: number) => `Вариант ${index + 1}`).join(", ")
      }
      return answer.answer
        .map((index: number) => {
          if (typeof index === "number" && question.options && question.options[index]) {
            return question.options[index]
          }
          return `Вариант ${index + 1}`
        })
        .join(", ")
    }

    // MULTIPLE_CHOICE - single answer as number index
    if (typeof answer.answer === "number") {
      if (question.options && question.options.length > answer.answer) {
        return question.options[answer.answer]
      }
      return `Вариант ${answer.answer + 1}`
    }

    // Fallback for string answers that might be indices
    if (typeof answer.answer === "string") {
      const numIndex = Number.parseInt(answer.answer)
      if (!Number.isNaN(numIndex) && question.options && question.options[numIndex]) {
        return question.options[numIndex]
      }
      return answer.answer
    }

    return String(answer.answer ?? "Нет ответа")
  }

  const getCorrectAnswerText = (question: Question) => {
    if (!question.correctAnswers || question.correctAnswers.length === 0) {
      return "Не указан"
    }

    if (question.type === "TEXT_INPUT") {
      // For text input, show all correct answers
      if (Array.isArray(question.correctAnswers)) {
        return (question.correctAnswers as string[]).join(" / ")
      }
      return question.correctAnswers[0] as string
    }

    if (question.type === "TRUE_FALSE") {
      const val = question.correctAnswers[0]
      if (val === true || val === "true" || val === 1) return "Верно"
      if (val === false || val === "false" || val === 0) return "Неверно"
      return String(val)
    }

    if (question.type === "MULTIPLE_SELECT" && Array.isArray(question.correctAnswers)) {
      return question.correctAnswers
        .map((index: number | string) => {
          const idx = typeof index === "string" ? Number.parseInt(index) : index
          if (question.options && question.options[idx]) {
            return question.options[idx]
          }
          return `Вариант ${idx + 1}`
        })
        .join(", ")
    }

    // MULTIPLE_CHOICE
    const correctIndex = question.correctAnswers[0]
    if (typeof correctIndex === "number") {
      if (question.options && question.options[correctIndex]) {
        return question.options[correctIndex]
      }
      return `Вариант ${correctIndex + 1}`
    }

    if (typeof correctIndex === "string") {
      const idx = Number.parseInt(correctIndex)
      if (!Number.isNaN(idx) && question.options && question.options[idx]) {
        return question.options[idx]
      }
      return correctIndex
    }

    return String(correctIndex)
  }

  const handleApproveAnswer = async (answer: PlayerAnswer) => {
    if (processing) return

    setProcessing(true)
    try {
      const question = getQuestionById(answer.questionId)
      if (!question) {
        throw new Error("Вопрос не найден")
      }

      // Calculate time bonus correctly
      const timeSpent = answer.timeSpent || 0
      const timeLimit = (question.timeLimit || 30) * 1000 // Convert to milliseconds
      const basePoints = question.points || 1000

      const points = calculatePoints(basePoints, timeSpent, timeLimit)

      console.log("[v0] Approving answer with calculated points:", {
        questionId: answer.questionId,
        timeSpent,
        timeLimit,
        basePoints,
        calculatedPoints: points,
      })

      // Get current player data
      const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${player.id}`)
      const snapshot = await get(playerRef)
      const currentPlayer = snapshot.val()

      if (!currentPlayer) {
        throw new Error("Игрок не найден")
      }

      // Find and update the specific answer
      const updatedAnswers = (currentPlayer.answers || []).map((a: PlayerAnswer) => {
        if (a.questionId === answer.questionId) {
          return {
            ...a,
            isCorrect: true,
            points: points,
            manuallyApproved: true,
            manuallyRejected: false,
          }
        }
        return a
      })

      // Recalculate total score
      const newScore = updatedAnswers.reduce((sum: number, a: PlayerAnswer) => sum + (a.points || 0), 0)

      const previousAnswer = (currentPlayer.answers || []).find((a: PlayerAnswer) => a.questionId === answer.questionId)
      const previousPoints = previousAnswer?.points || 0
      const scoreDelta = points - previousPoints

      console.log("[v0] Updating player with new data:", {
        playerId: player.id,
        newScore,
        scoreDelta,
        answersCount: updatedAnswers.length,
      })

      // Update player data with delta
      await update(playerRef, {
        answers: updatedAnswers,
        score: newScore,
        lastQuestionDelta: scoreDelta,
      })

      toast({
        title: "Ответ засчитан",
        description: `Игроку ${player.nickname} начислено ${points} очков`,
      })

      onClose()
    } catch (error) {
      console.error("Ошибка при засчитывании ответа:", error)
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось засчитать ответ",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleRejectAnswer = async (answer: PlayerAnswer) => {
    if (processing) return

    setProcessing(true)
    try {
      // Get current player data
      const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${player.id}`)
      const snapshot = await get(playerRef)
      const currentPlayer = snapshot.val()

      if (!currentPlayer) {
        throw new Error("Игрок не найден")
      }

      const previousAnswer = (currentPlayer.answers || []).find((a: PlayerAnswer) => a.questionId === answer.questionId)
      const previousPoints = previousAnswer?.points || 0

      // Find and update the specific answer
      const updatedAnswers = (currentPlayer.answers || []).map((a: PlayerAnswer) => {
        if (a.questionId === answer.questionId) {
          return {
            ...a,
            isCorrect: false,
            points: 0,
            manuallyRejected: true,
            manuallyApproved: false,
          }
        }
        return a
      })

      // Recalculate total score
      const newScore = updatedAnswers.reduce((sum: number, a: PlayerAnswer) => sum + (a.points || 0), 0)

      const scoreDelta = -previousPoints

      // Update player data
      await update(playerRef, {
        answers: updatedAnswers,
        score: newScore,
        lastQuestionDelta: scoreDelta,
      })

      toast({
        title: "Ответ аннулирован",
        description: `Ответ игрока ${player.nickname} аннулирован`,
      })

      onClose()
    } catch (error) {
      console.error("Ошибка при аннулировании ответа:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось аннулировать ответ",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const playerAnswers = player.answers || []

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getAvatarDisplay(player.avatar)}
            <div>
              <div className="text-xl">{player.nickname}</div>
              <div className="text-sm font-normal text-muted-foreground">
                Всего очков: {player.score || 0} • Ответов: {playerAnswers.length}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {playerAnswers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Игрок еще не дал ни одного ответа</p>
              </div>
            ) : (
              playerAnswers.map((answer, index) => {
                const question = getQuestionById(answer.questionId)
                if (!question) return null

                return (
                  <Card
                    key={answer.questionId}
                    className={answer.isCorrect ? "border-green-500/50" : "border-red-500/50"}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-semibold mb-1">Вопрос {index + 1}</div>
                          <p className="text-sm text-muted-foreground">{question.question}</p>
                        </div>
                        <Badge variant={answer.isCorrect ? "default" : "destructive"} className="flex-shrink-0">
                          {answer.isCorrect ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {answer.isCorrect ? "Правильно" : "Неправильно"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground mb-1">Ответ игрока:</div>
                          <div className="font-medium">{getAnswerText(answer, question)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Правильный ответ:</div>
                          <div className="font-medium text-green-600 dark:text-green-400">
                            {getCorrectAnswerText(question)}
                          </div>
                        </div>
                      </div>

                      {(question.type === "MULTIPLE_CHOICE" || question.type === "MULTIPLE_SELECT") &&
                        question.options &&
                        question.options.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-dashed">
                            <div className="text-xs text-muted-foreground mb-2">Все варианты ответа:</div>
                            <div className="flex flex-wrap gap-2">
                              {question.options.map((option, optIndex) => {
                                const isCorrectOption = Array.isArray(question.correctAnswers)
                                  ? question.correctAnswers.includes(optIndex)
                                  : question.correctAnswers === optIndex
                                const isPlayerAnswer = Array.isArray(answer.answer)
                                  ? answer.answer.includes(optIndex)
                                  : answer.answer === optIndex

                                return (
                                  <Badge
                                    key={optIndex}
                                    variant={isCorrectOption ? "default" : isPlayerAnswer ? "secondary" : "outline"}
                                    className={`text-xs ${
                                      isCorrectOption
                                        ? "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50"
                                        : isPlayerAnswer && !isCorrectOption
                                          ? "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50"
                                          : ""
                                    }`}
                                  >
                                    {String.fromCharCode(65 + optIndex)}. {option}
                                    {isCorrectOption && <CheckCircle className="w-3 h-3 ml-1" />}
                                    {isPlayerAnswer && !isCorrectOption && <XCircle className="w-3 h-3 ml-1" />}
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                        )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTime(answer.timeSpent)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4" />
                            <span>{answer.points || 0} очков</span>
                          </div>
                          {answer.manuallyApproved && (
                            <Badge variant="outline" className="text-xs">
                              Засчитано вручную
                            </Badge>
                          )}
                          {answer.manuallyRejected && (
                            <Badge variant="outline" className="text-xs">
                              Аннулировано
                            </Badge>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {(!answer.isCorrect || answer.manuallyRejected) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveAnswer(answer)}
                              disabled={processing}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Засчитать
                            </Button>
                          )}
                          {(answer.isCorrect || answer.manuallyApproved) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectAnswer(answer)}
                              disabled={processing}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Аннулировать
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
