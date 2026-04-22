"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Clock, Send, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Question } from "@/types/game"

interface QuestionDisplayProps {
  question: Question
  onAnswer: (answer: string) => void
  timeLeft: number
  totalTime: number
  hasAnswered: boolean
}

export default function QuestionDisplay({
  question,
  onAnswer,
  timeLeft,
  totalTime,
  hasAnswered,
}: QuestionDisplayProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setSelectedAnswer(null)
    setIsSubmitting(false)
  }, [question.id])

  const handleSubmit = async () => {
    if (!selectedAnswer || hasAnswered || isSubmitting) return

    setIsSubmitting(true)
    await onAnswer(selectedAnswer)
    setIsSubmitting(false)
  }

  const progressPercentage = (timeLeft / totalTime) * 100
  const isLowTime = timeLeft <= 5

  return (
    <div className="space-y-6">
      {/* Таймер */}
      <Card className={cn("border-2", isLowTime && "border-red-500 animate-pulse")}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className={cn("w-6 h-6", isLowTime ? "text-red-500" : "text-blue-500")} />
              <div>
                <div className="text-sm text-muted-foreground">Осталось времени</div>
                <div className={cn("text-3xl font-bold tabular-nums", isLowTime && "text-red-500")}>{timeLeft}с</div>
              </div>
            </div>
            {hasAnswered && (
              <Badge className="bg-green-500">
                <CheckCircle className="w-4 h-4 mr-1" />
                Ответ отправлен
              </Badge>
            )}
          </div>
          <Progress value={progressPercentage} className={cn("h-3", isLowTime && "bg-red-100")} />
        </CardContent>
      </Card>

      {/* Вопрос */}
      <Card>
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-4">
              Вопрос {question.order + 1}
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold">{question.text}</h2>
          </div>

          {/* Варианты ответов */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === option
              const optionLabels = ["A", "B", "C", "D"]

              return (
                <button
                  key={index}
                  onClick={() => !hasAnswered && !isSubmitting && setSelectedAnswer(option)}
                  disabled={hasAnswered || isSubmitting}
                  className={cn(
                    "relative p-6 rounded-lg border-2 transition-all text-left",
                    "hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
                    isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-gray-700",
                    (hasAnswered || isSubmitting) && "opacity-60 cursor-not-allowed",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0",
                        isSelected
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                      )}
                    >
                      {optionLabels[index]}
                    </div>
                    <span className="text-lg flex-1 pt-1">{option}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Кнопка отправки */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!selectedAnswer || hasAnswered || isSubmitting}
              className="min-w-[200px]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Отправка...
                </>
              ) : hasAnswered ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Ответ отправлен
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Отправить ответ
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
