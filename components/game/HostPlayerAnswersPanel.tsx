"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle, XCircle, Clock, User, Check } from "lucide-react"
import { AVATARS } from "@/components/ui/AvatarSelector"
import type { Player, Question } from "@/types/game"
import { ref, update } from "firebase/database"
import { realtimeDb } from "@/lib/firebase/config"
import { toast } from "@/hooks/use-toast"

interface HostPlayerAnswersPanelProps {
  gameId: string
  players: Record<string, Player>
  currentQuestion: Question | null
}

export default function HostPlayerAnswersPanel({ gameId, players, currentQuestion }: HostPlayerAnswersPanelProps) {
  const [approvingAnswer, setApprovingAnswer] = useState<string | null>(null)

  const getAvatarDisplay = (avatarId: string) => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    if (!avatar) {
      return <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">?</div>
    }

    return <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${avatar.color}`}>{avatar.emoji}</div>
  }

  const handleApproveAnswer = async (playerId: string, answerIndex: number) => {
    if (!currentQuestion) return

    setApprovingAnswer(playerId)

    try {
      const player = players[playerId]
      const answer = player.answers?.[answerIndex]

      if (!answer) {
        toast({
          title: "Ошибка",
          description: "Ответ не найден",
          variant: "destructive",
        })
        setApprovingAnswer(null)
        return
      }

      if (answer.isCorrect) {
        toast({
          title: "Информация",
          description: "Ответ уже засчитан как правильный",
        })
        setApprovingAnswer(null)
        return
      }

      // Calculate points based on time spent
      const timeSpentSeconds = answer.timeSpent / 1000
      const timeLimit = currentQuestion.timeLimit
      const basePoints = currentQuestion.points

      // Time bonus calculation: faster answer = more points
      const timeBonus = Math.max(0, (timeLimit - timeSpentSeconds) / timeLimit) * (basePoints * 0.5)
      const totalPoints = Math.round(basePoints + timeBonus)

      // Update answer to be correct
      const updatedAnswers = [...(player.answers || [])]
      updatedAnswers[answerIndex] = {
        ...answer,
        isCorrect: true,
        points: totalPoints,
        manuallyApproved: true,
      }

      const newScore = (player.score || 0) + totalPoints

      const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${playerId}`)
      await update(playerRef, {
        answers: updatedAnswers,
        score: newScore,
      })

      toast({
        title: "Ответ засчитан",
        description: `Игроку ${player.nickname} добавлено ${totalPoints} очков`,
      })
    } catch (error) {
      console.error("Ошибка засчитывания ответа:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось засчитать ответ",
        variant: "destructive",
      })
    } finally {
      setApprovingAnswer(null)
    }
  }

  if (!currentQuestion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Ответы игроков
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Начните игру, чтобы увидеть ответы игроков</p>
        </CardContent>
      </Card>
    )
  }

  const playerAnswers = Object.values(players)
    .filter((p) => p.id !== "host")
    .map((player) => {
      const answer = player.answers?.find((a) => a.questionId === currentQuestion.id)
      const answerIndex = player.answers?.findIndex((a) => a.questionId === currentQuestion.id) ?? -1
      return {
        player,
        answer,
        answerIndex,
      }
    })
    .filter(({ answer }) => answer !== undefined)
    .sort((a, b) => {
      // Sort by answer time
      return (a.answer?.timeSpent || 0) - (b.answer?.timeSpent || 0)
    })

  const getAnswerDisplay = (answer: any) => {
    if (!answer) return "Нет ответа"

    if (currentQuestion.type === "TEXT_INPUT") {
      return answer.answer || "Нет ответа"
    }

    if (currentQuestion.type === "TRUE_FALSE") {
      const answerValue = Array.isArray(answer.answer) ? answer.answer[0] : answer.answer
      return answerValue === 0 ? "Правда" : "Ложь"
    }

    if (currentQuestion.type === "MULTIPLE_CHOICE") {
      const answerValue = Array.isArray(answer.answer) ? answer.answer[0] : answer.answer
      if (currentQuestion.options && answerValue !== undefined) {
        return currentQuestion.options[answerValue] || "Нет ответа"
      }
    }

    if (currentQuestion.type === "MULTIPLE_SELECT") {
      if (Array.isArray(answer.answer) && currentQuestion.options) {
        return answer.answer.map((idx: number) => currentQuestion.options![idx]).join(", ") || "Нет ответа"
      }
    }

    return "Нет ответа"
  }

  const getCorrectAnswerDisplay = () => {
    if (currentQuestion.type === "TEXT_INPUT") {
      return Array.isArray(currentQuestion.correctAnswers)
        ? currentQuestion.correctAnswers.join(" или ")
        : currentQuestion.correctAnswers
    }

    if (currentQuestion.type === "TRUE_FALSE") {
      const correctValue = Array.isArray(currentQuestion.correctAnswers)
        ? currentQuestion.correctAnswers[0]
        : currentQuestion.correctAnswers
      return correctValue === 0 ? "Правда" : "Ложь"
    }

    if (currentQuestion.type === "MULTIPLE_CHOICE" || currentQuestion.type === "MULTIPLE_SELECT") {
      if (currentQuestion.options && Array.isArray(currentQuestion.correctAnswers)) {
        return currentQuestion.correctAnswers.map((idx: number) => currentQuestion.options![idx]).join(", ")
      }
    }

    return "Не указано"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Ответы игроков
          </div>
          <Badge variant="outline">
            {playerAnswers.length} / {Object.keys(players).length - 1}
          </Badge>
        </CardTitle>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Правильный ответ:</div>
          <div className="text-sm text-blue-800 dark:text-blue-200">{getCorrectAnswerDisplay()}</div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {playerAnswers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Пока никто не ответил на этот вопрос</p>
            ) : (
              playerAnswers.map(({ player, answer, answerIndex }) => {
                if (!answer) return null

                return (
                  <div
                    key={player.id}
                    className={`p-4 rounded-lg border-2 ${
                      answer.isCorrect
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getAvatarDisplay(player.avatar)}
                        <div>
                          <div className="font-medium">{player.nickname}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {(answer.timeSpent / 1000).toFixed(1)}с
                          </div>
                        </div>
                      </div>
                      {answer.isCorrect ? (
                        <Badge className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />+{answer.points}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />0
                        </Badge>
                      )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-3 rounded mb-3">
                      <div className="text-sm font-medium mb-1">Ответ игрока:</div>
                      <div className="text-sm font-mono">{getAnswerDisplay(answer)}</div>
                    </div>

                    {!answer.isCorrect && answerIndex >= 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApproveAnswer(player.id, answerIndex)}
                        disabled={approvingAnswer === player.id}
                        className="w-full bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {approvingAnswer === player.id ? "Засчитывается..." : "Засчитать как правильный"}
                      </Button>
                    )}

                    {answer.manuallyApproved && (
                      <Badge
                        variant="outline"
                        className="mt-2 w-full justify-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300"
                      >
                        Засчитан вручную администратором
                      </Badge>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
