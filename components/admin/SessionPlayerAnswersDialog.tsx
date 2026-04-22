"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle, XCircle, Clock, Award, Trophy } from "lucide-react"
import type { Question } from "@/types/game"
import type { SessionPlayerRecord, SessionPlayerAnswer } from "@/types/sessionAnalytics"
import { AVATARS } from "@/components/ui/AvatarSelector"

interface SessionPlayerAnswersDialogProps {
  isOpen: boolean
  onClose: () => void
  player: SessionPlayerRecord
  questions: Question[]
}

/**
 * Read-only dialog that displays every answer a player gave during a
 * completed session — used in Admin → Management → Sessions → Participants.
 *
 * Unlike PlayerAnswersDialog (which manipulates the live realtime DB),
 * this one works off the saved session snapshot and does not allow edits.
 */
export default function SessionPlayerAnswersDialog({
  isOpen,
  onClose,
  player,
  questions,
}: SessionPlayerAnswersDialogProps) {
  const getAvatarDisplay = (avatarId?: string) => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    if (!avatar) {
      return (
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
          {player.nickname?.[0]?.toUpperCase() ?? "?"}
        </div>
      )
    }
    return (
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }

  const formatTime = (ms: number) => {
    const seconds = ms / 1000
    if (seconds < 10) return `${seconds.toFixed(1)}с`
    return `${Math.floor(seconds)}с`
  }

  const getQuestionById = (questionId: string) => questions.find((q) => q.id === questionId)

  // Normalize the raw stored answer (handles legacy field names)
  const getRawAnswer = (a: SessionPlayerAnswer): any => {
    if (a.answer !== undefined && a.answer !== null) return a.answer
    if (a.selectedOption !== undefined) return a.selectedOption
    if (a.answerText !== undefined) return a.answerText
    return null
  }

  const getAnswerText = (a: SessionPlayerAnswer, q: Question): string => {
    const raw = getRawAnswer(a)

    if (q.type === "TEXT_INPUT") {
      if (typeof raw === "string" && raw.trim().length > 0) return raw
      return "Нет ответа"
    }

    if (q.type === "TRUE_FALSE") {
      const val = Array.isArray(raw) ? raw[0] : raw
      if (val === true || val === "true" || val === 1 || val === 0) {
        // TRUE/FALSE stored as index: 0 = Верно, 1 = Неверно (matches question.options convention)
        if (q.options && q.options.length >= 2) {
          const idx = typeof val === "number" ? val : val === true ? 0 : 1
          return q.options[idx] ?? String(val)
        }
      }
      return String(val ?? "Нет ответа")
    }

    if (q.type === "MULTIPLE_SELECT" && Array.isArray(raw)) {
      if (!q.options?.length) return raw.map((i: number) => `Вариант ${i + 1}`).join(", ")
      return raw
        .map((idx: number) =>
          typeof idx === "number" && q.options![idx] ? q.options![idx] : `Вариант ${Number(idx) + 1}`,
        )
        .join(", ")
    }

    // MULTIPLE_CHOICE — single index
    if (typeof raw === "number") {
      return q.options?.[raw] ?? `Вариант ${raw + 1}`
    }
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "number") {
      return q.options?.[raw[0]] ?? `Вариант ${raw[0] + 1}`
    }

    return raw == null ? "Нет ответа" : String(raw)
  }

  const getCorrectAnswerText = (q: Question): string => {
    if (!q.correctAnswers?.length) return "Не указан"

    if (q.type === "TEXT_INPUT") {
      return (q.correctAnswers as string[]).join(" / ")
    }

    if (q.type === "MULTIPLE_SELECT") {
      return (q.correctAnswers as number[])
        .map((idx) => q.options?.[idx] ?? `Вариант ${idx + 1}`)
        .join(", ")
    }

    const correctIdx = q.correctAnswers[0]
    if (typeof correctIdx === "number") {
      return q.options?.[correctIdx] ?? `Вариант ${correctIdx + 1}`
    }
    return String(correctIdx)
  }

  const answers = player.answers ?? []

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getAvatarDisplay(player.avatar)}
            <div className="min-w-0 flex-1">
              <div className="text-xl truncate">{player.nickname}</div>
              <div className="flex items-center gap-3 text-sm font-normal text-muted-foreground mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  {player.finalScore.toLocaleString()} очков
                </span>
                <span>•</span>
                <span>Место #{player.rank}</span>
                <span>•</span>
                <span>
                  {player.correctAnswers}/{player.totalAnswers} верных ({player.accuracy}%)
                </span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh] -mx-6 px-6">
          <div className="space-y-3 pb-2">
            {answers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">Этот игрок не дал ни одного ответа</p>
              </div>
            ) : (
              answers.map((answer, idx) => {
                const question = getQuestionById(answer.questionId)
                if (!question) {
                  return (
                    <Card key={`${answer.questionId}-${idx}`} className="border-muted">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">
                          Вопрос не найден (возможно, удалён из игры после сессии)
                        </p>
                      </CardContent>
                    </Card>
                  )
                }

                const userAnswerText = getAnswerText(answer, question)
                const correctAnswerText = getCorrectAnswerText(question)

                return (
                  <Card
                    key={`${answer.questionId}-${idx}`}
                    className={answer.isCorrect ? "border-green-500/40" : "border-red-500/40"}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">Вопрос {idx + 1}</span>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {question.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{question.question}</p>
                        </div>
                        <Badge
                          variant={answer.isCorrect ? "default" : "destructive"}
                          className="shrink-0"
                        >
                          {answer.isCorrect ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {answer.isCorrect ? "Верно" : "Неверно"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="bg-muted/40 rounded-lg p-2.5">
                          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                            Ответ игрока
                          </p>
                          <p className="font-medium break-words">{userAnswerText}</p>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-2.5 border border-green-500/20">
                          <p className="text-xs text-green-700 dark:text-green-400 mb-1 uppercase tracking-wider">
                            Правильный ответ
                          </p>
                          <p className="font-medium break-words text-green-700 dark:text-green-400">
                            {correctAnswerText}
                          </p>
                        </div>
                      </div>

                      {(question.type === "MULTIPLE_CHOICE" || question.type === "MULTIPLE_SELECT") &&
                        question.options &&
                        question.options.length > 0 && (
                          <div className="pt-2 border-t border-dashed">
                            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                              Все варианты
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {question.options.map((opt, optIdx) => {
                                const correctIdx = Array.isArray(question.correctAnswers)
                                  ? (question.correctAnswers as number[]).includes(optIdx)
                                  : false
                                const raw = getRawAnswer(answer)
                                const playerSelected = Array.isArray(raw)
                                  ? raw.includes(optIdx)
                                  : raw === optIdx

                                return (
                                  <div
                                    key={optIdx}
                                    className={`text-xs px-2 py-1 rounded-md border flex items-center gap-1.5 ${
                                      correctIdx
                                        ? "bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-400"
                                        : playerSelected
                                          ? "bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400"
                                          : "bg-muted border-border text-muted-foreground"
                                    }`}
                                  >
                                    <span className="font-semibold">{String.fromCharCode(65 + optIdx)}.</span>
                                    <span className="max-w-[160px] truncate">{opt}</span>
                                    {correctIdx && <CheckCircle className="w-3 h-3" />}
                                    {playerSelected && !correctIdx && <XCircle className="w-3 h-3" />}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                      <div className="flex items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatTime(answer.timeSpent ?? 0)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5" />
                          <span>{(answer.points ?? 0).toLocaleString()} очков</span>
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
