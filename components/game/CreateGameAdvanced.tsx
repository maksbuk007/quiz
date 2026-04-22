"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { CategoryMultiSelect } from "@/components/ui/CategoryMultiSelect"
import type { Game, Question, GameSettings } from "@/types/game"
import { collection, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { useAuth } from "@/contexts/AuthContext"
import { generateUniqueGameCode } from "@/lib/utils/gameUtils"
import {
  Plus,
  Trash2,
  Edit,
  Save,
  ArrowUp,
  ArrowDown,
  Copy,
  Settings,
  FileText,
  CheckSquare,
  Type,
  Infinity,
  X,
} from "lucide-react"

const TIME_OPTIONS = [
  { value: 5, label: "5 секунд" },
  { value: 10, label: "10 секунд" },
  { value: 15, label: "15 секунд" },
  { value: 20, label: "20 секунд" },
  { value: 30, label: "30 секунд" },
  { value: 45, label: "45 секунд" },
  { value: 60, label: "1 минута" },
  { value: 90, label: "1.5 минуты" },
  { value: 120, label: "2 минуты" },
  { value: 180, label: "3 минуты" },
  { value: 300, label: "5 минут" },
]

// Расширенные опции баллов
const POINTS_OPTIONS = [
  { value: 10, label: "10 баллов" },
  { value: 25, label: "25 баллов" },
  { value: 50, label: "50 баллов" },
  { value: 75, label: "75 баллов" },
  { value: 100, label: "100 баллов" },
  { value: 125, label: "125 баллов" },
  { value: 150, label: "150 баллов" },
  { value: 200, label: "200 баллов" },
  { value: 250, label: "250 баллов" },
  { value: 300, label: "300 баллов" },
  { value: 400, label: "400 баллов" },
  { value: 500, label: "500 баллов" },
  { value: 750, label: "750 баллов" },
  { value: 1000, label: "1000 баллов" },
  { value: 1500, label: "1500 баллов" },
  { value: 2000, label: "2000 баллов" },
  { value: 2500, label: "2500 баллов" },
  { value: 3000, label: "3000 баллов" },
  { value: 5000, label: "5000 баллов" },
  { value: 10000, label: "10000 баллов" },
]

const PLAYER_LIMIT_OPTIONS = [
  { value: 0, label: "Без ограничений", icon: <Infinity className="w-4 h-4" /> },
  { value: 5, label: "5 игроков" },
  { value: 10, label: "10 игроков" },
  { value: 15, label: "15 игроков" },
  { value: 20, label: "20 игроков" },
  { value: 25, label: "25 игроков" },
  { value: 30, label: "30 игроков" },
  { value: 40, label: "40 игроков" },
  { value: 50, label: "50 игроков" },
  { value: 75, label: "75 игроков" },
  { value: 100, label: "100 игроков" },
  { value: 150, label: "150 игроков" },
  { value: 200, label: "200 игроков" },
  { value: 250, label: "250 игроков" },
  { value: 300, label: "300 игроков" },
  { value: 500, label: "500 игроков" },
  { value: 750, label: "750 игроков" },
  { value: 1000, label: "1000 игроков" },
  { value: 1500, label: "1500 игроков" },
  { value: 2000, label: "2000 игроков" },
  { value: 2500, label: "2500 баллов" },
  { value: 3000, label: "3000 баллов" },
  { value: 5000, label: "5000 баллов" },
]

export default function CreateGameAdvanced() {
  const { user, isAdmin } = useAuth()
  const [gameData, setGameData] = useState({
    title: "",
    description: "",
    categories: [] as string[],
    maxPlayers: 0,
  })

  const [questions, setQuestions] = useState<Question[]>([])
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    type: "MULTIPLE_CHOICE",
    question: "",
    options: ["", "", "", ""],
    correctAnswers: [],
    timeLimit: 30,
    points: 100,
    explanation: "",
    caseSensitive: false,
    numbersOnly: false,
  })

  const [settings, setSettings] = useState<GameSettings>({
    defaultTimeLimit: 30,
    allowLateJoin: false,
    showLeaderboard: true,
    randomizeQuestions: false,
    showCorrectAnswers: true,
    allowReplay: false,
    enableChat: true,
    moderateChat: false,
    allowHints: false,
    penaltyForWrongAnswer: 0,
  })

  const [activeTab, setActiveTab] = useState<"basic" | "questions" | "settings">("basic")
  const [loading, setLoading] = useState(false)

  if (!isAdmin) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="text-center p-8">
          <h2 className="text-xl font-bold mb-4">Доступ запрещен</h2>
          <p className="text-muted-foreground">Только администраторы могут создавать игры</p>
        </CardContent>
      </Card>
    )
  }

  const questionTypes = [
    { value: "MULTIPLE_CHOICE", label: "Один правильный ответ", icon: <CheckSquare className="w-4 h-4" /> },
    { value: "MULTIPLE_SELECT", label: "Несколько правильных ответов", icon: <CheckSquare className="w-4 h-4" /> },
    { value: "TEXT_INPUT", label: "Текстовый ответ", icon: <Type className="w-4 h-4" /> },
    { value: "TRUE_FALSE", label: "Правда/Ложь", icon: <CheckSquare className="w-4 h-4" /> },
  ]

  const addOrUpdateQuestion = () => {
    if (!currentQuestion.question) return

    let processedOptions = currentQuestion.options
    let processedCorrectAnswers = currentQuestion.correctAnswers

    // Для типа TRUE_FALSE автоматически создаем варианты
    if (currentQuestion.type === "TRUE_FALSE") {
      processedOptions = ["Правда", "Ложь"]
      // Если не выбран правильный ответ, по умолчанию "Правда"
      if (!processedCorrectAnswers || processedCorrectAnswers.length === 0) {
        processedCorrectAnswers = [0]
      }
    }

    const questionData: Question = {
      id: editingQuestion?.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: currentQuestion.type || "MULTIPLE_CHOICE",
      question: currentQuestion.question,
      options: processedOptions?.filter((opt) => opt.trim() !== ""),
      correctAnswers: processedCorrectAnswers || [],
      timeLimit: currentQuestion.timeLimit || settings.defaultTimeLimit,
      points: currentQuestion.points || 100,
      explanation: currentQuestion.explanation,
      order: editingQuestion?.order || questions.length,
      caseSensitive: currentQuestion.caseSensitive || false,
      numbersOnly: currentQuestion.numbersOnly || false,
    }

    if (editingQuestion) {
      setQuestions(questions.map((q) => (q.id === editingQuestion.id ? questionData : q)))
      setEditingQuestion(null)
    } else {
      setQuestions([...questions, questionData])
    }

    resetCurrentQuestion()
  }

  const resetCurrentQuestion = () => {
    setCurrentQuestion({
      type: "MULTIPLE_CHOICE",
      question: "",
      options: ["", "", "", ""],
      correctAnswers: [],
      timeLimit: settings.defaultTimeLimit,
      points: 100,
      explanation: "",
      caseSensitive: false,
      numbersOnly: false,
    })
  }

  const editQuestion = (question: Question) => {
    setCurrentQuestion(question)
    setEditingQuestion(question)
  }

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id))
  }

  const duplicateQuestion = (question: Question) => {
    const newQuestion: Question = {
      ...question,
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order: questions.length,
    }
    setQuestions([...questions, newQuestion])
  }

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newQuestions = [...questions]
    const targetIndex = direction === "up" ? index - 1 : index + 1

    if (targetIndex >= 0 && targetIndex < newQuestions.length) {
      ;[newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]]
      setQuestions(newQuestions)
    }
  }

  const createGame = async () => {
    if (!gameData.title || questions.length === 0 || !user) return

    setLoading(true)
    try {
      const gameCode = await generateUniqueGameCode()

      const newGame: Omit<Game, "id"> = {
        code: gameCode,
        title: gameData.title || "Импортированная игра",
        description: gameData.description || "",
        categories: gameData.categories || [],
        hostId: user.uid,
        hostEmail: user.email || "",
        questions: questions.map((q, index) => ({ ...q, order: index })),
        maxPlayers: gameData.maxPlayers,
        status: "draft",
        currentQuestionIndex: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        settings,
        createdBy: user.uid,
      }

      const docRef = await addDoc(collection(db, "games"), newGame)
      alert(`Игра создана! Код игры: ${gameCode}`)

      // Reset form
      setGameData({ title: "", description: "", categories: [], maxPlayers: 0 })
      setQuestions([])
      resetCurrentQuestion()
    } catch (error) {
      console.error("Ошибка создания игры:", error)
      alert("Ошибка создания игры")
    } finally {
      setLoading(false)
    }
  }

  const renderQuestionForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="questionType">Тип вопроса</Label>
        <Select
          value={currentQuestion.type}
          onValueChange={(value: any) => {
            setCurrentQuestion({ ...currentQuestion, type: value })
            // Сброс вариантов ответов при смене типа
            if (value === "TRUE_FALSE") {
              setCurrentQuestion({
                ...currentQuestion,
                type: value,
                options: ["Правда", "Ложь"],
                correctAnswers: [0],
              })
            } else if (value === "TEXT_INPUT") {
              setCurrentQuestion({
                ...currentQuestion,
                type: value,
                options: [],
                correctAnswers: [""],
                caseSensitive: false,
                numbersOnly: false,
              })
            } else {
              setCurrentQuestion({
                ...currentQuestion,
                type: value,
                options: ["", "", "", ""],
                correctAnswers: [],
              })
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {questionTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  {type.icon}
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="question">Текст вопроса</Label>
        <Textarea
          id="question"
          value={currentQuestion.question}
          onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
          placeholder="Введите текст вопроса"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="timeLimit">Время на ответ</Label>
          <Select
            value={currentQuestion.timeLimit?.toString()}
            onValueChange={(value) => setCurrentQuestion({ ...currentQuestion, timeLimit: Number.parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="points">Максимальные баллы</Label>
          <Select
            value={currentQuestion.points?.toString()}
            onValueChange={(value) => setCurrentQuestion({ ...currentQuestion, points: Number.parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POINTS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Максимальные баллы за ответ в первые 3% времени</p>
        </div>
      </div>

      {currentQuestion.type === "TRUE_FALSE" && (
        <div className="space-y-2">
          <Label>Правильный ответ</Label>
          <div className="flex gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="true"
                checked={currentQuestion.correctAnswers?.includes(0)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setCurrentQuestion({ ...currentQuestion, correctAnswers: [0] })
                  }
                }}
              />
              <Label htmlFor="true">Правда</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="false"
                checked={currentQuestion.correctAnswers?.includes(1)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setCurrentQuestion({ ...currentQuestion, correctAnswers: [1] })
                  }
                }}
              />
              <Label htmlFor="false">Ложь</Label>
            </div>
          </div>
        </div>
      )}

      {(currentQuestion.type === "MULTIPLE_CHOICE" || currentQuestion.type === "MULTIPLE_SELECT") && (
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
              <Checkbox
                checked={currentQuestion.correctAnswers?.includes(index)}
                onCheckedChange={(checked) => {
                  const current = currentQuestion.correctAnswers || []
                  if (currentQuestion.type === "MULTIPLE_CHOICE") {
                    setCurrentQuestion({ ...currentQuestion, correctAnswers: checked ? [index] : [] })
                  } else {
                    const newAnswers = checked ? [...current, index] : current.filter((i) => i !== index)
                    setCurrentQuestion({ ...currentQuestion, correctAnswers: newAnswers })
                  }
                }}
              />
              <Label className="text-sm">Правильный</Label>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newOptions = [...(currentQuestion.options || []), ""]
              setCurrentQuestion({ ...currentQuestion, options: newOptions })
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить вариант
          </Button>
        </div>
      )}

      {currentQuestion.type === "TEXT_INPUT" && (
        <div className="space-y-3">
          <div>
            <Label>Правильные ответы</Label>
            <p className="text-xs text-muted-foreground mb-2">Добавьте все возможные варианты правильного ответа</p>
            <div className="space-y-2">
              {currentQuestion.correctAnswers &&
                Array.isArray(currentQuestion.correctAnswers) &&
                currentQuestion.correctAnswers.map((answer, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={answer as string}
                      onChange={(e) => {
                        const newAnswers = [...(currentQuestion.correctAnswers as string[])]
                        newAnswers[index] = e.target.value
                        setCurrentQuestion({ ...currentQuestion, correctAnswers: newAnswers })
                      }}
                      placeholder={`Вариант ${index + 1}`}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newAnswers = (currentQuestion.correctAnswers as string[]).filter((_, i) => i !== index)
                        setCurrentQuestion({
                          ...currentQuestion,
                          correctAnswers: newAnswers.length > 0 ? newAnswers : [""],
                        })
                      }}
                      disabled={(currentQuestion.correctAnswers as string[]).length <= 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentAnswers = Array.isArray(currentQuestion.correctAnswers)
                    ? currentQuestion.correctAnswers
                    : [""]
                  setCurrentQuestion({
                    ...currentQuestion,
                    correctAnswers: [...(currentAnswers as string[]), ""],
                  })
                }}
                className="w-full gap-1"
              >
                <Plus className="w-4 h-4" />
                Добавить вариант ответа
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="caseSensitive"
              checked={currentQuestion.caseSensitive || false}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, caseSensitive: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="caseSensitive" className="text-sm font-normal cursor-pointer">
              Учитывать регистр (тигр ≠ Тигр)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="numbersOnly"
              checked={currentQuestion.numbersOnly || false}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, numbersOnly: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Label htmlFor="numbersOnly" className="text-sm font-normal cursor-pointer">
              Только числа (принимать только цифровой ввод)
            </Label>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="explanation">Объяснение (необязательно)</Label>
        <Textarea
          id="explanation"
          value={currentQuestion.explanation}
          onChange={(e) => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })}
          placeholder="Объяснение правильного ответа"
          rows={2}
        />
      </div>

      <Button onClick={addOrUpdateQuestion} className="w-full">
        {editingQuestion ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
        {editingQuestion ? "Сохранить изменения" : "Добавить вопрос"}
      </Button>

      {editingQuestion && (
        <Button
          variant="outline"
          onClick={() => {
            setEditingQuestion(null)
            resetCurrentQuestion()
          }}
          className="w-full"
        >
          Отменить редактирование
        </Button>
      )}
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Создание игры</h1>
        <p className="text-muted-foreground">Создайте интерактивную викторину для ваших участников</p>
      </div>

      <div className="flex gap-4 mb-6">
        <Button
          variant={activeTab === "basic" ? "default" : "outline"}
          onClick={() => setActiveTab("basic")}
          className="flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Основное
        </Button>
        <Button
          variant={activeTab === "questions" ? "default" : "outline"}
          onClick={() => setActiveTab("questions")}
          className="flex items-center gap-2"
        >
          <CheckSquare className="w-4 h-4" />
          Вопросы ({questions.length})
        </Button>
        <Button
          variant={activeTab === "settings" ? "default" : "outline"}
          onClick={() => setActiveTab("settings")}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Настройки
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab === "basic" && (
            <Card>
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
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
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="categories">Категории</Label>
                  <CategoryMultiSelect
                    value={gameData.categories || []}
                    onChange={(categories) => setGameData({ ...gameData, categories })}
                  />
                </div>

                <div>
                  <Label htmlFor="maxPlayers">Лимит игроков</Label>
                  <Select
                    value={gameData.maxPlayers.toString()}
                    onValueChange={(value) => setGameData({ ...gameData, maxPlayers: Number.parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAYER_LIMIT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          <div className="flex items-center gap-2">
                            {option.icon}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "questions" && (
            <Card>
              <CardHeader>
                <CardTitle>{editingQuestion ? "Редактировать вопрос" : "Добавить вопрос"}</CardTitle>
              </CardHeader>
              <CardContent>{renderQuestionForm()}</CardContent>
            </Card>
          )}

          {activeTab === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Настройки игры</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="defaultTimeLimit">Время по умолчанию</Label>
                  <Select
                    value={settings.defaultTimeLimit.toString()}
                    onValueChange={(value) => setSettings({ ...settings, defaultTimeLimit: Number.parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Разрешить позднее присоединение</Label>
                      <p className="text-sm text-muted-foreground">Игроки могут присоединиться после начала игры</p>
                    </div>
                    <Switch
                      checked={settings.allowLateJoin}
                      onCheckedChange={(checked) => setSettings({ ...settings, allowLateJoin: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Показывать лидерборд</Label>
                      <p className="text-sm text-muted-foreground">Отображать рейтинг игроков во время игры</p>
                    </div>
                    <Switch
                      checked={settings.showLeaderboard}
                      onCheckedChange={(checked) => setSettings({ ...settings, showLeaderboard: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Перемешать вопросы</Label>
                      <p className="text-sm text-muted-foreground">Случайный порядок вопросов для каждой игры</p>
                    </div>
                    <Switch
                      checked={settings.randomizeQuestions}
                      onCheckedChange={(checked) => setSettings({ ...settings, randomizeQuestions: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Показывать правильные ответы</Label>
                      <p className="text-sm text-muted-foreground">
                        Показывать правильные ответы после каждого вопроса
                      </p>
                    </div>
                    <Switch
                      checked={settings.showCorrectAnswers}
                      onCheckedChange={(checked) => setSettings({ ...settings, showCorrectAnswers: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Включить чат</Label>
                      <p className="text-sm text-muted-foreground">Разрешить игрокам общаться в чате</p>
                    </div>
                    <Switch
                      checked={settings.enableChat}
                      onCheckedChange={(checked) => setSettings({ ...settings, enableChat: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Разрешить повтор</Label>
                      <p className="text-sm text-muted-foreground">Игроки могут переиграть викторину</p>
                    </div>
                    <Switch
                      checked={settings.allowReplay}
                      onCheckedChange={(checked) => setSettings({ ...settings, allowReplay: checked })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Вопросы ({questions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {questions.map((question, index) => (
                    <div key={question.id} className="flex items-center gap-2 p-3 border rounded">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{question.question}</p>
                        <p className="text-sm text-muted-foreground">
                          {question.type} • {question.points} баллов • {question.timeLimit}с
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveQuestion(index, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveQuestion(index, "down")}
                          disabled={index === questions.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => duplicateQuestion(question)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editQuestion(question)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeQuestion(question.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Предпросмотр</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div>
                  <strong>Название:</strong> {gameData.title || "Не указано"}
                </div>
                <div>
                  <strong>Вопросов:</strong> {questions.length}
                </div>
                <div>
                  <strong>Категории:</strong> {gameData.categories.join(", ") || "Не указано"}
                </div>
                <div>
                  <strong>Лимит игроков:</strong> {gameData.maxPlayers === 0 ? "Без ограничений" : gameData.maxPlayers}
                </div>
                <div>
                  <strong>Время по умолчанию:</strong> {settings.defaultTimeLimit}с
                </div>
                <div>
                  <strong>Чат:</strong> {settings.enableChat ? "Включен" : "Отключен"}
                </div>
              </div>

              <Button
                onClick={createGame}
                className="w-full"
                size="lg"
                disabled={!gameData.title || questions.length === 0 || loading}
              >
                {loading ? "Создание..." : "Создать игру"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
