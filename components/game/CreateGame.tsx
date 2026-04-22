"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { Game, Question, GameSettings } from "@/types/game"
import { collection, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { Plus, Trash2 } from "lucide-react"

export default function CreateGame() {
  const [gameData, setGameData] = useState({
    title: "",
    description: "",
    maxPlayers: 50,
  })

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    type: "MULTIPLE_CHOICE",
    question: "",
    options: ["", "", "", ""],
    correctAnswers: [],
    timeLimit: 30,
    points: 1000,
  })

  const [settings, setSettings] = useState<GameSettings>({
    defaultTimeLimit: 30,
    allowLateJoin: false,
    showLeaderboard: true,
    randomizeQuestions: false,
  })

  const addQuestion = () => {
    if (!currentQuestion.question) return

    const newQuestion: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: currentQuestion.type || "MULTIPLE_CHOICE",
      question: currentQuestion.question,
      options: currentQuestion.options?.filter((opt) => opt.trim() !== ""),
      correctAnswers: currentQuestion.correctAnswers || [],
      timeLimit: currentQuestion.timeLimit || settings.defaultTimeLimit,
      points: currentQuestion.points || 100,
      explanation: currentQuestion.explanation,
    }

    setQuestions([...questions, newQuestion])
    setCurrentQuestion({
      type: "MULTIPLE_CHOICE",
      question: "",
      options: ["", "", "", ""],
      correctAnswers: [],
      timeLimit: 30,
      points: 1000,
    })
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const createGame = async () => {
    if (!gameData.title || questions.length === 0) return

    try {
      const newGame: Omit<Game, "id"> = {
        title: gameData.title,
        description: gameData.description,
        hostId: `host_${Date.now()}`, // В реальном приложении это будет ID аутентифицированного пользователя
        questions,
        maxPlayers: gameData.maxPlayers,
        status: "waiting",
        currentQuestionIndex: 0,
        createdAt: new Date(),
        settings,
      }

      const docRef = await addDoc(collection(db, "games"), newGame)
      alert(`Игра создана! ID: ${docRef.id}`)

      // Reset form
      setGameData({ title: "", description: "", maxPlayers: 50 })
      setQuestions([])
    } catch (error) {
      console.error("Ошибка создания игры:", error)
      alert("Ошибка создания игры")
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Создать новую игру</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Название игры</Label>
            <Input
              id="title"
              value={gameData.title}
              onChange={(e) => setGameData({ ...gameData, title: e.target.value })}
              placeholder="Введите название игры"
            />
          </div>

          <div>
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={gameData.description}
              onChange={(e) => setGameData({ ...gameData, description: e.target.value })}
              placeholder="Краткое описание игры"
            />
          </div>

          <div>
            <Label htmlFor="maxPlayers">Максимум игроков</Label>
            <Input
              id="maxPlayers"
              type="number"
              value={gameData.maxPlayers}
              onChange={(e) => setGameData({ ...gameData, maxPlayers: Number.parseInt(e.target.value) })}
              min="1"
              max="100"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Добавить вопрос</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="question">Вопрос</Label>
            <Textarea
              id="question"
              value={currentQuestion.question}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
              placeholder="Введите текст вопроса"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timeLimit">Время на ответ (сек)</Label>
              <Input
                id="timeLimit"
                type="number"
                value={currentQuestion.timeLimit}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, timeLimit: Number.parseInt(e.target.value) })}
                min="5"
                max="300"
              />
            </div>
            <div>
              <Label htmlFor="points">Баллы за правильный ответ</Label>
              <Input
                id="points"
                type="number"
                value={currentQuestion.points}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, points: Number.parseInt(e.target.value) })}
                min="10"
                max="1000"
              />
            </div>
          </div>

          {currentQuestion.type === "MULTIPLE_CHOICE" && (
            <div className="space-y-2">
              <Label>Варианты ответов</Label>
              {currentQuestion.options?.map((option, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(currentQuestion.options || [])]
                      newOptions[index] = e.target.value
                      setCurrentQuestion({ ...currentQuestion, options: newOptions })
                    }}
                    placeholder={`Вариант ${index + 1}`}
                  />
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={currentQuestion.correctAnswers?.includes(index)}
                    onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswers: [index] })}
                  />
                  <Label className="text-sm">Правильный</Label>
                </div>
              ))}
            </div>
          )}

          <Button onClick={addQuestion} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Добавить вопрос
          </Button>
        </CardContent>
      </Card>

      {questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Вопросы ({questions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {questions.map((question, index) => (
                <div key={question.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <p className="font-medium">{question.question}</p>
                    <p className="text-sm text-gray-500">
                      {question.points} баллов • {question.timeLimit}с
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => removeQuestion(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={createGame} className="w-full" size="lg" disabled={!gameData.title || questions.length === 0}>
        Создать игру
      </Button>
    </div>
  )
}
