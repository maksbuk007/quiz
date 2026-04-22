"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { Game, Question, QuestionType, GameSettings } from "@/types/game"
import ImportExportDialog from "@/components/game/ImportExportDialog"
import ImportExportService from "@/lib/services/importExportService"
import {
  ArrowLeft,
  Save,
  Trash2,
  Edit,
  Loader2,
  FileJson,
  Plus,
  Settings,
  FileText,
  HelpCircle,
  ImageIcon,
  X,
} from "lucide-react"

const TIME_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300]
const POINTS_PRESETS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 500, 1000]

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "MULTIPLE_CHOICE", label: "Один правильный ответ", description: "Игрок выбирает один вариант из списка" },
  {
    value: "MULTIPLE_SELECT",
    label: "Несколько правильных ответов",
    description: "Игрок может выбрать несколько вариантов",
  },
  { value: "TRUE_FALSE", label: "Правда/Ложь", description: "Простой вопрос с двумя вариантами" },
  { value: "TEXT_INPUT", label: "Текстовый ответ", description: "Игрок вводит ответ текстом" },
]

export default function EditGamePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [game, setGame] = useState<Game | null>(null)
  const [activeTab, setActiveTab] = useState("info")
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)

  const [settings, setSettings] = useState<GameSettings>({
    defaultTimeLimit: 30,
    defaultPoints: 100,
    defaultImageUrl: "",
    allowLateJoin: false,
    showLeaderboard: true,
    randomizeQuestions: false,
    showCorrectAnswers: true,
    allowReplay: false,
    enableChat: true,
    moderateChat: false,
    allowHints: false,
    penaltyForWrongAnswer: 0,
    autoShowResultsWhenAllAnswered: true,
  })

  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    type: "MULTIPLE_CHOICE",
    question: "",
    options: ["", "", "", ""],
    correctAnswers: [],
    timeLimit: 30,
    points: 100,
    explanation: "",
    imageUrl: "",
  })

  const [customTimeLimit, setCustomTimeLimit] = useState("")
  const [customPoints, setCustomPoints] = useState("")
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [useCustomPoints, setUseCustomPoints] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      router.push("/")
      return
    }

    const loadGame = async () => {
      try {
        const gameDoc = await getDoc(doc(db, "games", params.id))
        if (gameDoc.exists()) {
          const gameData = { id: gameDoc.id, ...gameDoc.data() } as Game
          setGame(gameData)
          if (gameData.settings) {
            setSettings({
              ...gameData.settings,
              autoShowResultsWhenAllAnswered: gameData.settings.autoShowResultsWhenAllAnswered ?? true,
            })
            setCurrentQuestion((prev) => ({
              ...prev,
              timeLimit: gameData.settings.defaultTimeLimit,
              points: gameData.settings.defaultPoints,
              imageUrl: gameData.settings.defaultImageUrl || "",
            }))
          }
        } else {
          alert("Игра не найдена")
          router.push("/admin")
        }
      } catch (error) {
        console.error("Ошибка загрузки игры:", error)
        alert("Ошибка загрузки игры")
      } finally {
        setLoading(false)
      }
    }

    loadGame()
  }, [params.id, isAdmin, router])

  const handleQuestionTypeChange = (type: QuestionType) => {
    const newQuestion: Partial<Question> = {
      ...currentQuestion,
      type,
    }

    if (type === "TRUE_FALSE") {
      newQuestion.options = ["Правда", "Ложь"]
      newQuestion.correctAnswers = []
    } else if (type === "TEXT_INPUT") {
      newQuestion.options = undefined
      newQuestion.correctAnswers = []
    } else if (type === "MULTIPLE_CHOICE" || type === "MULTIPLE_SELECT") {
      if (!newQuestion.options || newQuestion.options.length < 2) {
        newQuestion.options = ["", "", "", ""]
      }
      newQuestion.correctAnswers = []
    }

    setCurrentQuestion(newQuestion)
  }

  const handleSave = async () => {
    if (!game) return

    setSaving(true)
    try {
      const cleanedQuestions = game.questions.map((q) => ImportExportService.cleanObject(q))

      const updateData = {
        title: game.title,
        description: game.description || "",
        questions: cleanedQuestions,
        categories: game.categories || [],
        maxPlayers: game.maxPlayers || 0,
        settings: settings,
        updatedAt: Date.now(),
        // Preserve the original creation date
        createdAt: game.createdAt,
      }

      const cleanedData = ImportExportService.cleanObject(updateData)
      await updateDoc(doc(db, "games", params.id), cleanedData)
      alert("Изменения сохранены!")
    } catch (error) {
      console.error("Ошибка сохранения:", error)
      alert("Ошибка сохранения изменений")
    } finally {
      setSaving(false)
    }
  }

  const getTimeLimit = (): number => {
    if (useCustomTime && customTimeLimit) {
      const custom = Number.parseInt(customTimeLimit)
      return !isNaN(custom) && custom > 0 ? custom : settings.defaultTimeLimit
    }
    return currentQuestion.timeLimit || settings.defaultTimeLimit
  }

  const getPoints = (): number => {
    if (useCustomPoints && customPoints) {
      const custom = Number.parseInt(customPoints)
      return !isNaN(custom) && custom > 0 ? custom : settings.defaultPoints
    }
    return currentQuestion.points || settings.defaultPoints
  }

  const addOrUpdateQuestion = () => {
    if (!game || !currentQuestion.question?.trim()) {
      alert("Введите текст вопроса")
      return
    }

    if (
      currentQuestion.type !== "TEXT_INPUT" &&
      (!currentQuestion.correctAnswers || currentQuestion.correctAnswers.length === 0)
    ) {
      alert("Выберите хотя бы один правильный ответ")
      return
    }

    const questionData: Question = {
      id: editingQuestion?.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: currentQuestion.type || "MULTIPLE_CHOICE",
      question: currentQuestion.question.trim(),
      correctAnswers: currentQuestion.correctAnswers || [],
      timeLimit: getTimeLimit(),
      points: getPoints(),
      order: editingQuestion?.order ?? game.questions.length,
    }

    if (currentQuestion.type !== "TEXT_INPUT" && currentQuestion.options && currentQuestion.options.length > 0) {
      const filteredOptions = currentQuestion.options.filter((opt) => opt.trim() !== "")
      if (filteredOptions.length > 0) {
        questionData.options = filteredOptions
      }
    }

    if (currentQuestion.explanation?.trim()) {
      questionData.explanation = currentQuestion.explanation.trim()
    }

    const finalImageUrl = currentQuestion.imageUrl?.trim() || settings.defaultImageUrl?.trim() || ""
    if (finalImageUrl) {
      questionData.imageUrl = finalImageUrl
    }

    if (editingQuestion) {
      setGame({
        ...game,
        questions: game.questions.map((q) => (q.id === editingQuestion.id ? questionData : q)),
      })
      setEditingQuestion(null)
    } else {
      setGame({
        ...game,
        questions: [...game.questions, questionData],
      })
    }

    resetCurrentQuestion()
    setActiveTab("questions")
  }

  const resetCurrentQuestion = () => {
    setCurrentQuestion({
      type: "MULTIPLE_CHOICE",
      question: "",
      options: ["", "", "", ""],
      correctAnswers: [],
      timeLimit: settings.defaultTimeLimit,
      points: settings.defaultPoints,
      explanation: "",
      imageUrl: settings.defaultImageUrl || "",
    })
    setCustomTimeLimit("")
    setCustomPoints("")
    setUseCustomTime(false)
    setUseCustomPoints(false)
  }

  const removeQuestion = (id: string) => {
    if (!game) return
    if (confirm("Вы уверены, что хотите удалить этот вопрос?")) {
      setGame({
        ...game,
        questions: game.questions.filter((q) => q.id !== id),
      })
    }
  }

  const editQuestion = (question: Question) => {
    setCurrentQuestion({
      ...question,
      options: question.options || (question.type === "TRUE_FALSE" ? ["Правда", "Ложь"] : ["", "", "", ""]),
      explanation: question.explanation || "",
      imageUrl: question.imageUrl || settings.defaultImageUrl || "",
    })

    const isCustomTime = !TIME_PRESETS.includes(question.timeLimit)
    const isCustomPoints = !POINTS_PRESETS.includes(question.points)

    if (isCustomTime) {
      setUseCustomTime(true)
      setCustomTimeLimit(question.timeLimit.toString())
    }

    if (isCustomPoints) {
      setUseCustomPoints(true)
      setCustomPoints(question.points.toString())
    }

    setEditingQuestion(question)
    setActiveTab("questions")
    setTimeout(() => {
      document.getElementById("question-form")?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  const addOption = () => {
    const currentOptions = currentQuestion.options || []
    setCurrentQuestion({
      ...currentQuestion,
      options: [...currentOptions, ""],
    })
  }

  const removeOption = (index: number) => {
    const currentOptions = currentQuestion.options || []
    if (currentOptions.length <= 2) {
      alert("Должно быть минимум 2 варианта ответа")
      return
    }
    const newOptions = currentOptions.filter((_, i) => i !== index)
    const newCorrectAnswers = (currentQuestion.correctAnswers || [])
      .filter((ansIndex) => ansIndex !== index)
      .map((ansIndex) => (typeof ansIndex === "number" && ansIndex > index ? ansIndex - 1 : ansIndex))

    setCurrentQuestion({
      ...currentQuestion,
      options: newOptions,
      correctAnswers: newCorrectAnswers,
    })
  }

  const handleImportGame = (gameData: Partial<Game>) => {
    if (!game) return
    setGame({
      ...game,
      title: gameData.title || game.title,
      description: gameData.description || game.description,
      questions: gameData.questions || game.questions,
      categories: gameData.categories || game.categories,
      maxPlayers: gameData.maxPlayers ?? game.maxPlayers,
      settings: gameData.settings || game.settings,
    })
    if (gameData.settings) {
      setSettings(gameData.settings)
    }
  }

  const handleImportQuestions = (questions: Question[]) => {
    if (!game) return
    setGame({
      ...game,
      questions: [...game.questions, ...questions],
    })
  }

  const applyDefaultSettings = () => {
    if (confirm("Применить настройки по умолчанию ко всем существующим вопросам?")) {
      if (!game) return
      setGame({
        ...game,
        questions: game.questions.map((q) => ({
          ...q,
          timeLimit: settings.defaultTimeLimit,
          points: settings.defaultPoints,
          imageUrl: q.imageUrl || settings.defaultImageUrl || q.imageUrl,
        })),
      })
      alert("Настройки применены ко всем вопросам")
    }
  }

  const getQuestionTypeLabel = (type: QuestionType) => {
    const typeObj = QUESTION_TYPES.find((t) => t.value === type)
    return typeObj?.label || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!game) {
    return null
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{game.title}</h1>
            <p className="text-sm text-muted-foreground">
              Код: {game.code} • ID: {game.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ImportExportDialog
            game={game}
            questions={game.questions}
            onImportGame={handleImportGame}
            onImportQuestions={handleImportQuestions}
            trigger={
              <Button variant="outline" size="sm">
                <FileJson className="w-4 h-4 mr-2" />
                Импорт/Экспорт
              </Button>
            }
          />
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full flex gap-2 overflow-x-auto bg-transparent p-0 h-auto">
          <TabsTrigger
            value="info"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <FileText className="w-4 h-4" />
            Информация
          </TabsTrigger>
          <TabsTrigger
            value="questions"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <HelpCircle className="w-4 h-4" />
            Вопросы ({game.questions?.length || 0})
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <FileText className="w-4 h-4" />
            Просмотр
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Settings className="w-4 h-4" />
            Настройки
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Основная информация об игре</CardTitle>
              <CardDescription>Настройте название, описание и базовые параметры игры</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Название игры *</Label>
                <Input
                  id="title"
                  value={game.title}
                  onChange={(e) => setGame({ ...game, title: e.target.value })}
                  placeholder="Введите название игры"
                  className="text-lg font-medium"
                />
              </div>

              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={game.description || ""}
                  onChange={(e) => setGame({ ...game, description: e.target.value })}
                  placeholder="Краткое описание игры (необязательно)"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxPlayers">Максимум игроков</Label>
                  <Input
                    id="maxPlayers"
                    type="number"
                    min="0"
                    value={game.maxPlayers}
                    onChange={(e) => setGame({ ...game, maxPlayers: Number.parseInt(e.target.value) || 0 })}
                    placeholder="0 = без ограничений"
                  />
                  <p className="text-xs text-muted-foreground mt-1">0 означает без ограничений</p>
                </div>

                <div>
                  <Label htmlFor="categories">Категории (через запятую)</Label>
                  <Input
                    id="categories"
                    value={(game.categories || []).join(", ")}
                    onChange={(e) =>
                      setGame({
                        ...game,
                        categories: e.target.value
                          .split(",")
                          .map((c) => c.trim())
                          .filter((c) => c),
                      })
                    }
                    placeholder="Например: География, История"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card id="question-form">
                <CardHeader>
                  <CardTitle>{editingQuestion ? "Редактировать вопрос" : "Добавить новый вопрос"}</CardTitle>
                  <CardDescription>
                    {editingQuestion ? "Внесите изменения в существующий вопрос" : "Создайте новый вопрос для игры"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="questionType">Тип вопроса *</Label>
                    <Select
                      value={currentQuestion.type}
                      onValueChange={(value) => handleQuestionTypeChange(value as QuestionType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-muted-foreground">{type.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="question">Текст вопроса *</Label>
                    <Textarea
                      id="question"
                      value={currentQuestion.question}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                      placeholder="Введите текст вопроса"
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  <div>
                    <Label htmlFor="imageUrl">URL изображения</Label>
                    <div className="flex gap-2">
                      <Input
                        id="imageUrl"
                        value={currentQuestion.imageUrl || ""}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, imageUrl: e.target.value })}
                        placeholder={
                          settings.defaultImageUrl
                            ? `По умолчанию: ${settings.defaultImageUrl}`
                            : "https://example.com/image.jpg"
                        }
                      />
                      {currentQuestion.imageUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setCurrentQuestion({ ...currentQuestion, imageUrl: settings.defaultImageUrl || "" })
                          }
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {(currentQuestion.imageUrl || settings.defaultImageUrl) && (
                      <div className="mt-2 rounded border p-2">
                        <img
                          src={currentQuestion.imageUrl || settings.defaultImageUrl || "/placeholder.svg"}
                          alt="Preview"
                          className="max-h-40 mx-auto object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Время на ответ (секунды) *</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="custom-time"
                          checked={useCustomTime}
                          onCheckedChange={(checked) => {
                            setUseCustomTime(checked)
                            if (!checked) {
                              setCustomTimeLimit("")
                              setCurrentQuestion({ ...currentQuestion, timeLimit: settings.defaultTimeLimit })
                            }
                          }}
                        />
                        <Label htmlFor="custom-time" className="text-sm cursor-pointer">
                          Своё значение
                        </Label>
                      </div>
                      {useCustomTime ? (
                        <Input
                          type="number"
                          min="1"
                          max="600"
                          value={customTimeLimit}
                          onChange={(e) => setCustomTimeLimit(e.target.value)}
                          placeholder="Введите время"
                        />
                      ) : (
                        <Select
                          value={currentQuestion.timeLimit?.toString()}
                          onValueChange={(value) =>
                            setCurrentQuestion({ ...currentQuestion, timeLimit: Number.parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_PRESETS.map((time) => (
                              <SelectItem key={time} value={time.toString()}>
                                {time < 60 ? `${time} сек` : `${time / 60} мин`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Максимальные баллы *</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="custom-points"
                          checked={useCustomPoints}
                          onCheckedChange={(checked) => {
                            setUseCustomPoints(checked)
                            if (!checked) {
                              setCustomPoints("")
                              setCurrentQuestion({ ...currentQuestion, points: settings.defaultPoints })
                            }
                          }}
                        />
                        <Label htmlFor="custom-points" className="text-sm cursor-pointer">
                          Своё значение
                        </Label>
                      </div>
                      {useCustomPoints ? (
                        <Input
                          type="number"
                          min="1"
                          value={customPoints}
                          onChange={(e) => setCustomPoints(e.target.value)}
                          placeholder="Введите баллы"
                        />
                      ) : (
                        <Select
                          value={currentQuestion.points?.toString()}
                          onValueChange={(value) =>
                            setCurrentQuestion({ ...currentQuestion, points: Number.parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {POINTS_PRESETS.map((points) => (
                              <SelectItem key={points} value={points.toString()}>
                                {points} баллов
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {currentQuestion.type !== "TEXT_INPUT" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Варианты ответов *</Label>
                        {currentQuestion.type !== "TRUE_FALSE" && (
                          <Button type="button" variant="outline" size="sm" onClick={addOption}>
                            <Plus className="w-4 h-4 mr-1" />
                            Добавить
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {currentQuestion.options?.map((option, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                            <Input
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(currentQuestion.options || [])]
                                newOptions[index] = e.target.value
                                setCurrentQuestion({ ...currentQuestion, options: newOptions })
                              }}
                              placeholder={`Вариант ${index + 1}`}
                              disabled={currentQuestion.type === "TRUE_FALSE"}
                              className="flex-1"
                            />
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={currentQuestion.correctAnswers?.includes(index)}
                                onCheckedChange={(checked) => {
                                  const current = currentQuestion.correctAnswers || []
                                  let newAnswers: number[]

                                  if (
                                    currentQuestion.type === "MULTIPLE_CHOICE" ||
                                    currentQuestion.type === "TRUE_FALSE"
                                  ) {
                                    newAnswers = checked ? [index] : []
                                  } else {
                                    newAnswers = checked ? [...current, index] : current.filter((i) => i !== index)
                                  }

                                  setCurrentQuestion({ ...currentQuestion, correctAnswers: newAnswers })
                                }}
                              />
                              <Label className="text-sm whitespace-nowrap cursor-pointer">Правильный</Label>
                            </div>
                            {currentQuestion.type !== "TRUE_FALSE" &&
                              currentQuestion.options &&
                              currentQuestion.options.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeOption(index)}
                                  className="shrink-0"
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentQuestion.type === "TEXT_INPUT" && (
                    <div>
                      <Label htmlFor="correctAnswers">Правильные ответы (через запятую) *</Label>
                      <Input
                        value={
                          Array.isArray(currentQuestion.correctAnswers) ? currentQuestion.correctAnswers.join(", ") : ""
                        }
                        onChange={(e) => {
                          const answers = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s)
                          setCurrentQuestion({ ...currentQuestion, correctAnswers: answers as any })
                        }}
                        placeholder="Например: Москва, москва, МОСКВА"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Можно указать несколько вариантов (разные регистры, синонимы)
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="explanation">Объяснение ответа (необязательно)</Label>
                    <Textarea
                      id="explanation"
                      value={currentQuestion.explanation || ""}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })}
                      placeholder="Объяснение, которое увидят игроки после ответа"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={addOrUpdateQuestion} className="flex-1">
                      {editingQuestion ? (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Сохранить изменения
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Добавить вопрос
                        </>
                      )}
                    </Button>
                    {editingQuestion && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingQuestion(null)
                          resetCurrentQuestion()
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Отмена
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Список вопросов</CardTitle>
                  <CardDescription>{game.questions.length} вопросов в игре</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {game.questions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Вопросов пока нет</p>
                        <p className="text-xs">Добавьте первый вопрос</p>
                      </div>
                    ) : (
                      game.questions.map((question, index) => (
                        <div
                          key={question.id}
                          className={`group flex items-start gap-2 p-3 border rounded transition-all hover:shadow-md cursor-pointer ${
                            editingQuestion?.id === question.id ? "border-primary bg-primary/5 shadow-md" : ""
                          }`}
                          onClick={() => editQuestion(question)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 mb-1">
                              <span className="text-xs font-bold text-muted-foreground shrink-0">#{index + 1}</span>
                              {question.imageUrl && <ImageIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                            </div>
                            <p className="font-medium text-sm line-clamp-2 mb-1">{question.question}</p>
                            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                              <span className="px-2 py-0.5 bg-secondary rounded">
                                {getQuestionTypeLabel(question.type)}
                              </span>
                              <span className="px-2 py-0.5 bg-secondary rounded">{question.points} б</span>
                              <span className="px-2 py-0.5 bg-secondary rounded">{question.timeLimit}с</span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation()
                                editQuestion(question)
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeQuestion(question.id)
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Просмотр вопросов</CardTitle>
              <CardDescription>Все вопросы игры с деталями и правильными ответами</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {game.questions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Вопросов пока нет</p>
                  </div>
                ) : (
                  game.questions.map((question, index) => (
                    <div key={question.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                              {getQuestionTypeLabel(question.type)}
                            </span>
                            <span className="text-xs px-2 py-1 bg-secondary rounded">{question.timeLimit}с</span>
                            <span className="text-xs px-2 py-1 bg-secondary rounded">{question.points} баллов</span>
                          </div>
                          <h3 className="font-semibold text-base mb-2">{question.question}</h3>
                          {question.imageUrl && (
                            <div className="mb-3 rounded border p-2 bg-muted/50">
                              <img
                                src={question.imageUrl || "/placeholder.svg"}
                                alt="Question"
                                className="max-h-32 mx-auto object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => editQuestion(question)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>

                      {question.type !== "TEXT_INPUT" && question.options && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Варианты ответов:</p>
                          <div className="space-y-1">
                            {question.options.map((option, optIndex) => {
                              const isCorrect = question.correctAnswers?.includes(optIndex)
                              return (
                                <div
                                  key={optIndex}
                                  className={`p-2 rounded text-sm ${
                                    isCorrect
                                      ? "bg-green-500/20 text-green-700 border border-green-500/50 font-medium"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isCorrect && "✓ "}
                                  {option}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {question.type === "TEXT_INPUT" && Array.isArray(question.correctAnswers) && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Правильные ответы:</p>
                          <div className="flex flex-wrap gap-2">
                            {question.correctAnswers.map((answer, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-green-500/20 text-green-700 rounded text-sm border border-green-500/50"
                              >
                                {answer}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {question.explanation && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Объяснение:</p>
                          <p className="text-sm text-blue-600">{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Настройки по умолчанию</CardTitle>
              <CardDescription>Эти настройки будут применяться к новым вопросам</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="defaultTimeLimit">Время по умолчанию (секунды)</Label>
                  <Input
                    id="defaultTimeLimit"
                    type="number"
                    min="5"
                    max="600"
                    value={settings.defaultTimeLimit}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultTimeLimit: Number.parseInt(e.target.value) || 30 })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="defaultPoints">Баллы по умолчанию</Label>
                  <Input
                    id="defaultPoints"
                    type="number"
                    min="1"
                    value={settings.defaultPoints}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultPoints: Number.parseInt(e.target.value) || 100 })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="defaultImageUrl">Изображение по умолчанию (URL)</Label>
                <div className="flex gap-2">
                  <Input
                    id="defaultImageUrl"
                    value={settings.defaultImageUrl || ""}
                    onChange={(e) => setSettings({ ...settings, defaultImageUrl: e.target.value })}
                    placeholder="https://example.com/default-image.jpg"
                  />
                  {settings.defaultImageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSettings({ ...settings, defaultImageUrl: "" })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {settings.defaultImageUrl && (
                  <div className="mt-2 rounded border p-2">
                    <img
                      src={settings.defaultImageUrl || "/placeholder.svg"}
                      alt="Default preview"
                      className="max-h-32 mx-auto object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Будет использоваться для всех вопросов без своего изображения
                </p>
              </div>

              <Button variant="outline" onClick={applyDefaultSettings} className="w-full bg-transparent">
                Применить ко всем существующим вопросам
              </Button>

              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold">Игровые настройки</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoShowResults">Автопереход к результатам</Label>
                      <p className="text-sm text-muted-foreground">
                        Показывать результаты автоматически, когда все игроки ответили
                      </p>
                    </div>
                    <Switch
                      id="autoShowResults"
                      checked={settings.autoShowResultsWhenAllAnswered}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, autoShowResultsWhenAllAnswered: checked })
                      }
                    />
                  </div>

                  {[
                    {
                      key: "allowLateJoin",
                      label: "Разрешить позднее присоединение",
                      desc: "Игроки могут присоединиться после начала",
                    },
                    { key: "showLeaderboard", label: "Показывать лидерборд", desc: "Отображать рейтинг во время игры" },
                    {
                      key: "randomizeQuestions",
                      label: "Перемешать вопросы",
                      desc: "Случайный порядок для каждой игры",
                    },
                    {
                      key: "showCorrectAnswers",
                      label: "Показывать правильные ответы",
                      desc: "После каждого вопроса",
                    },
                    { key: "allowReplay", label: "Разрешить повтор", desc: "Игроки могут переиграть викторину" },
                    { key: "enableChat", label: "Включить чат", desc: "Разрешить общение между игроками" },
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={setting.key}>{setting.label}</Label>
                        <p className="text-sm text-muted-foreground">{setting.desc}</p>
                      </div>
                      <Switch
                        id={setting.key}
                        checked={settings[setting.key as keyof GameSettings] as boolean}
                        onCheckedChange={(checked) => setSettings({ ...settings, [setting.key]: checked })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
