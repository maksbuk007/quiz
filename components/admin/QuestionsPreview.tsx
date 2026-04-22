"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { Question } from "@/types/game"

interface QuestionsPreviewProps {
  questions: Question[]
}

export function QuestionsPreview({ questions }: QuestionsPreviewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (!questions || questions.length === 0) {
    return null
  }

  const getQuestionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      MULTIPLE_CHOICE: "МНОЖЕСТВЕННЫЙ ВЫБОР",
      MULTIPLE_SELECT: "НЕСКОЛЬКО ОТВЕТОВ",
      TEXT_INPUT: "ТЕКСТОВЫЙ ОТВЕТ",
      TRUE_FALSE: "ПРАВДА/ЛОЖЬ",
    }
    return types[type] || type
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{questions.length} вопросов</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {questions.map((question, index) => {
            if (!question) return null

            const options = question.options || []
            const correctAnswers = question.correctAnswers || []

            return (
              <div key={question.id} className="border rounded-lg overflow-hidden">
                {/* Question header */}
                <button
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{index + 1}.</span>
                      <Badge variant="outline" className="text-xs">
                        {getQuestionTypeLabel(question.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {question.timeLimit}с • {question.points} очков
                      </span>
                    </div>
                    <p className="font-medium line-clamp-2">{question.question}</p>
                  </div>
                  {expandedIndex === index ? (
                    <ChevronUp className="w-4 h-4 ml-2 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                  )}
                </button>

                {/* Question details */}
                {expandedIndex === index && (
                  <div className="border-t bg-muted/30 p-4 space-y-4">
                    {/* Answer options for multiple choice/select/true-false */}
                    {(question.type === "MULTIPLE_CHOICE" ||
                      question.type === "MULTIPLE_SELECT" ||
                      question.type === "TRUE_FALSE") &&
                      options.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">Варианты ответов:</p>
                          <div className="space-y-2 pl-2">
                            {options.map((option, optIndex) => {
                              const isCorrect = Array.isArray(correctAnswers) && correctAnswers.includes(optIndex)
                              return (
                                <div
                                  key={optIndex}
                                  className={`flex items-start gap-3 p-2 rounded ${
                                    isCorrect
                                      ? "bg-green-500/10 border border-green-500/30"
                                      : "border border-transparent"
                                  }`}
                                >
                                  <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                      isCorrect ? "border-green-500 bg-green-500" : "border-muted-foreground"
                                    }`}
                                  >
                                    {isCorrect && (
                                      <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-sm flex-1">{option}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                    {/* Text input correct answers */}
                    {question.type === "TEXT_INPUT" && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Правильные ответы:</p>
                        <div className="flex flex-wrap gap-2 pl-2">
                          {Array.isArray(correctAnswers) &&
                            correctAnswers.map((answer: string, idx: number) => (
                              <Badge key={idx} variant="secondary">
                                {answer}
                              </Badge>
                            ))}
                        </div>
                        {question.caseSensitive && (
                          <p className="text-xs text-amber-600 pl-2">⚠ Учитывается регистр букв</p>
                        )}
                      </div>
                    )}

                    {/* Explanation */}
                    {question.explanation && (
                      <div className="space-y-2 bg-blue-500/10 border border-blue-500/20 rounded p-3">
                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">Объяснение:</p>
                        <p className="text-sm text-blue-900 dark:text-blue-200">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
