"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/contexts/AuthContext"
import ThemeToggle from "@/components/ui/ThemeToggle"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { Game, Question } from "@/types/game"
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Tag,
  Trash2,
  Copy,
  Edit,
  MoveUp,
  MoveDown,
  Loader2,
  AlertTriangle,
  ImageIcon,
  Link,
  Settings,
} from "lucide-react"

export default function EditGamePage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, isAdmin, loading: authLoading, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  // Основное состояние
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("info")

  // Состояние формы
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [enableChat, setEnableChat] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState("")

  // Состояние вопросов
  const [questions, setQuestions] = useState<Question[]>([])
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [questionType, setQuestionType] = useState<string>("MULTIPLE_CHOICE")
  const [questionText, setQuestionText] = useState("")
  const [questionImageUrl, setQuestionImageUrl] = useState("")
  const [questionOptions, setQuestionOptions] = useState<string[]>(["", "", "", ""])
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([])
  const [textCorrectAnswers, setTextCorrectAnswers] = useState<string>("")
  const [questionPoints, setQuestionPoints] = useState(100)
  const [questionTimeLimit, setQuestionTimeLimit] = useState(30)
  const [questionExplanation, setQuestionExplanation] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Refs
  const questionFormRef = useRef<HTMLDivElement>(null)

  // Проверка доступа
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/")
    }
  }, [authLoading, isAdmin, router])

  // Загрузка игры
  useEffect(() => {
    if (!id || !user || !isAdmin || authLoading) return

    const fetchGame = async () => {
      try {
        setLoading(true)
        setError("")

        const gameDoc = await getDoc(doc(db, "games", id as string))

        if (!gameDoc.exists()) {
          setError("Игра не найдена")
          setLoading(false)
          return
        }

        const gameData = { id: gameDoc.id, ...gameDoc.data() } as Game

        // Проверка прав доступа
        if (gameData.createdBy !== user.uid) {
          setError("У вас нет прав на редактирование этой игры")
          setLoading(false)
          return
        }

        setGame(gameData)
        setTitle(gameData.title)
        setDescription(gameData.description || "")
        setEnableChat(gameData.settings?.enableChat !== false)
        setCategories(gameData.categories || [])
        setQuestions(gameData.questions || [])
      } catch (error) {
        console.error("Ошибка при загрузке игры:", error)
        setError("Ошибка при загрузке игры")
      } finally {
        setLoading(false)
      }
    }

    fetchGame()
  }, [id, user, isAdmin, authLoading])

  // Эффект для установки правильных опций при выборе типа TRUE_FALSE
  useEffect(() => {
    if (questionType === "TRUE_FALSE") {
      setQuestionOptions(["Правда", "Ложь"])
    }
  }, [questionType])

  // Сохранение основной информации
  const handleSaveInfo = async () => {
    if (!game) return
    if (!title.trim()) {
      setError("Название игры обязательно")
      return
    }

    try {
      setSaving(true)
      setError("")

      await updateDoc(doc(db, "games", game.id), {
        title: title.trim(),
        description: description.trim(),
        settings: {
          enableChat,
        },
        categories: categories.length > 0 ? categories : [],
        updatedAt: Date.now(),
      })

      setGame({
        ...game,
        title: title.trim(),
        description: description.trim(),
        settings: {
          enableChat,
        },
        categories: categories.length > 0 ? categories : [],
      })

      alert("Информация успешно сохранена")
    } catch (error) {
      console.error("Ошибка при сохранении информации:", error)
      setError("Ошибка при сохранении информации")
    } finally {
      setSaving(false)
    }
  }

  // Управление категориями
  const handleAddCategory = () => {
    if (!newCategory.trim() || categories.includes(newCategory.trim())) {
      return
    }
    setCategories([...categories, newCategory.trim()])
    setNewCategory("")
  }

  const handleRemoveCategory = (category: string) => {
    setCategories(categories.filter((c) => c !== category))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newCategory.trim()) {
      e.preventDefault()
      handleAddCategory()
    }
  }

  // Управление вопросами
  const resetQuestionForm = () => {
    setQuestionType("MULTIPLE_CHOICE")
    setQuestionText("")
    setQuestionImageUrl("")
    setQuestionOptions(["", "", "", ""])
    setCorrectAnswers([])
    setTextCorrectAnswers("")
    setQuestionPoints(100)
    setQuestionTimeLimit(30)
    setQuestionExplanation("")
    setEditingQuestion(null)
    setEditingIndex(null)
  }

  const handleAddOption = () => {
    if (questionOptions.length < 8) {
      setQuestionOptions([...questionOptions, ""])
    }
  }

  const handleRemoveOption = (index: number) => {
    const newOptions = [...questionOptions]
    newOptions.splice(index, 1)
    setQuestionOptions(newOptions)

    // Обновляем правильные ответы
    const newCorrectAnswers = correctAnswers.filter((answerIndex) => {
      if (answerIndex === index) return false
      if (answerIndex > index) return false
      return true
    })
    setCorrectAnswers(newCorrectAnswers)
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionOptions]
    newOptions[index] = value
    setQuestionOptions(newOptions)
  }

  const handleCorrectAnswerToggle = (index: number) => {
    if (questionType === "MULTIPLE_CHOICE" || questionType === "TRUE_FALSE") {
      setCorrectAnswers([index])
    } else if (questionType === "MULTIPLE_SELECT") {
      if (correctAnswers.includes(index)) {
        setCorrectAnswers(correctAnswers.filter((i) => i !== index))
      } else {
        setCorrectAnswers([...correctAnswers, index])
      }
    }
  }

  const handleEditQuestion = (question: Question, index: number) => {
    setEditingQuestion(question)
    setEditingIndex(index)
    setQuestionType(question.type)
    setQuestionText(question.question)
    setQuestionImageUrl(question.imageUrl || "")
    setQuestionPoints(question.points)
    setQuestionTimeLimit(question.timeLimit)
    setQuestionExplanation(question.explanation || "")

    if (question.type === "MULTIPLE_CHOICE" || question.type === "MULTIPLE_SELECT" || question.type === "TRUE_FALSE") {
      setQuestionOptions(question.options || ["", "", "", ""])
      setCorrectAnswers(question.correctAnswers as number[])
    } else if (question.type === "TEXT_INPUT") {
      setTextCorrectAnswers((question.correctAnswers as string[]).join(", "))
    }

    setActiveTab("add-question")

    // Прокручиваем к форме
    setTimeout(() => {
      questionFormRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  const handleDeleteQuestion = async (index: number) => {
    if (!game) return
    if (!confirm("Вы уверены, что хотите удалить этот вопрос?")) return

    try {
      setSaving(true)
      setError("")

      const newQuestions = [...questions]
      newQuestions.splice(index, 1)

      await updateDoc(doc(db, "games", game.id), {
        questions: newQuestions,
        updatedAt: Date.now(),
      })

      setQuestions(newQuestions)
      setGame({
        ...game,
        questions: newQuestions,
      })
    } catch (error) {
      console.error("Ошибка при удалении вопроса:", error)
      setError("Ошибка при удалении вопроса")
    } finally {
      setSaving(false)
    }
  }

  const handleMoveQuestion = async (index: number, direction: "up" | "down") => {
    if (!game) return
    if ((direction === "up" && index === 0) || (direction === "down" && index === questions.length - 1)) {
      return
    }

    try {
      setSaving(true)
      setError("")

      const newQuestions = [...questions]
      const newIndex = direction === "up" ? index - 1 : index + 1
      const temp = newQuestions[index]
      newQuestions[index] = newQuestions[newIndex]
      newQuestions[newIndex] = temp

      await updateDoc(doc(db, "games", game.id), {
        questions: newQuestions,
        updatedAt: Date.now(),
      })

      setQuestions(newQuestions)
      setGame({
        ...game,
        questions: newQuestions,
      })
    } catch (error) {
      console.error("Ошибка при перемещении вопроса:", error)
      setError("Ошибка при перемещении вопроса")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveQuestion = async () => {
    if (!game) return

    // Валидация
    if (!questionText.trim()) {
      setError("Текст вопроса обязателен")
      return
    }

    // Специальная обработка для TRUE_FALSE
    if (questionType === "TRUE_FALSE") {
      // Убедимся, что у нас есть правильные опции
      if (questionOptions.length !== 2) {
        setQuestionOptions(["Правда", "Ложь"])
      }

      // Убедимся, что выбран правильный ответ
      if (correctAnswers.length === 0) {
        setError("Выберите правильный ответ (Правда или Ложь)")
        return
      }
    } else if (
      (questionType === "MULTIPLE_CHOICE" || questionType === "MULTIPLE_SELECT") &&
      (questionOptions.some((opt) => !opt.trim()) || questionOptions.length < 2)
    ) {
      setError("Все варианты ответов должны быть заполнены")
      return
    }

    if ((questionType === "MULTIPLE_CHOICE" || questionType === "MULTIPLE_SELECT") && correctAnswers.length === 0) {
      setError("Выберите хотя бы один правильный ответ")
      return
    }

    if (questionType === "TEXT_INPUT" && !textCorrectAnswers.trim()) {
      setError("Введите хотя бы один правильный ответ")
      return
    }

    try {
      setSaving(true)
      setError("")

      let finalCorrectAnswers: number[] | string[] = correctAnswers
      if (questionType === "TEXT_INPUT") {
        finalCorrectAnswers = textCorrectAnswers
          .split(",")
          .map((answer) => answer.trim())
          .filter((answer) => answer)
      }

      const questionData: Question = {
        id: editingQuestion?.id || `q_${Date.now()}`,
        type: questionType as any,
        question: questionText.trim(),
        points: questionPoints,
        timeLimit: questionTimeLimit,
        explanation: questionExplanation.trim() || undefined,
        imageUrl: questionImageUrl.trim() || undefined,
      }

      if (questionType === "MULTIPLE_CHOICE" || questionType === "MULTIPLE_SELECT" || questionType === "TRUE_FALSE") {
        questionData.options =
          questionType === "TRUE_FALSE" ? ["Правда", "Ложь"] : questionOptions.filter((opt) => opt.trim())
        questionData.correctAnswers = finalCorrectAnswers as number[]
      } else if (questionType === "TEXT_INPUT") {
        questionData.correctAnswers = finalCorrectAnswers as string[]
      }

      const newQuestions = [...questions]
      if (editingIndex !== null && editingIndex >= 0) {
        newQuestions[editingIndex] = questionData
      } else {
        newQuestions.push(questionData)
      }

      await updateDoc(doc(db, "games", game.id), {
        questions: newQuestions,
        updatedAt: Date.now(),
      })

      setQuestions(newQuestions)
      setGame({
        ...game,
        questions: newQuestions,
      })

      resetQuestionForm()
      setActiveTab("questions")
    } catch (error) {
      console.error("Ошибка при сохранении вопроса:", error)
      setError("Ошибка при сохранении вопроса")
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicateQuestion = (question: Question) => {
    const duplicatedQuestion = {
      ...question,
      id: `q_${Date.now()}`,
    }
    handleEditQuestion(duplicatedQuestion, -1) // -1 означает, что это новый вопрос
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Загрузка игры...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-4 text-destructive">{error}</h2>
            <Button onClick={() => router.push("/admin")}>Вернуться к списку игр</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <h2 className="text-xl font-bold mb-4">Игра не найдена</h2>
            <Button onClick={() => router.push("/admin")}>Вернуться к списку игр</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button variant="outline" onClick={() => router.push("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <h1 className="text-2xl font-bold">Редактирование игры</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Профиль
          </Button>
        </div>
      </div>

      {/* Вкладки */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="info">Информация</TabsTrigger>
          <TabsTrigger value="questions">Вопросы ({questions.length})</TabsTrigger>
          <TabsTrigger value="add-question">{editingQuestion ? "Редактировать вопрос" : "Добавить вопрос"}</TabsTrigger>
        </TabsList>

        {/* Вкладка с информацией */}
        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Название игры *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Введите название игры"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Введите описание игры (необязательно)"
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categories">Категории</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {categories.map((category) => (
                    <Badge key={category} variant="secondary" className="flex items-center gap-1">
                      {category}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => handleRemoveCategory(category)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {categories.length === 0 && <span className="text-sm text-muted-foreground">Нет категорий</span>}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Добавить категорию"
                      className="pl-10"
                      maxLength={30}
                    />
                  </div>
                  <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="enableChat" checked={enableChat} onCheckedChange={setEnableChat} />
                <Label htmlFor="enableChat">Включить чат для игроков</Label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveInfo} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Сохранить информацию
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка с вопросами */}
        <TabsContent value="questions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Список вопросов</CardTitle>
              <CardDescription>
                {questions.length === 0
                  ? "Пока нет вопросов. Добавьте первый вопрос."
                  : `Всего вопросов: ${questions.length}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">Нет вопросов для отображения</p>
                  <Button onClick={() => setActiveTab("add-question")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить первый вопрос
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <Card key={question.id} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{question.type}</Badge>
                                <Badge variant="secondary">{question.points} баллов</Badge>
                                <Badge variant="outline">{question.timeLimit}с</Badge>
                              </div>
                              <h3 className="font-medium text-lg">{question.question}</h3>
                              {question.imageUrl && (
                                <div className="mt-2">
                                  <img
                                    src={question.imageUrl || "/placeholder.svg"}
                                    alt="Изображение к вопросу"
                                    className="max-w-xs h-auto rounded border"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveQuestion(index, "up")}
                                disabled={index === 0 || saving}
                              >
                                <MoveUp className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveQuestion(index, "down")}
                                disabled={index === questions.length - 1 || saving}
                              >
                                <MoveDown className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDuplicateQuestion(question)}
                                disabled={saving}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditQuestion(question, index)}
                                disabled={saving}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteQuestion(index)}
                                disabled={saving}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {(question.type === "MULTIPLE_CHOICE" ||
                            question.type === "MULTIPLE_SELECT" ||
                            question.type === "TRUE_FALSE") && (
                            <div className="space-y-2">
                              {question.options?.map((option, optionIndex) => (
                                <div
                                  key={optionIndex}
                                  className={`p-2 rounded border ${
                                    (question.correctAnswers as number[]).includes(optionIndex)
                                      ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-600"
                                      : "bg-muted"
                                  }`}
                                >
                                  {option}
                                  {(question.correctAnswers as number[]).includes(optionIndex) && (
                                    <Badge variant="default" className="ml-2">
                                      Правильный
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {question.type === "TEXT_INPUT" && (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">Правильные ответы:</p>
                              <div className="flex flex-wrap gap-2">
                                {(question.correctAnswers as string[]).map((answer, answerIndex) => (
                                  <Badge key={answerIndex} variant="default">
                                    {answer}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {question.explanation && (
                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-600">
                              <p className="text-sm font-medium mb-1">Объяснение:</p>
                              <p className="text-sm">{question.explanation}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка добавления/редактирования вопроса */}
        <TabsContent value="add-question" className="space-y-6">
          <Card ref={questionFormRef}>
            <CardHeader>
              <CardTitle>{editingQuestion ? "Редактировать вопрос" : "Добавить новый вопрос"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="questionType">Тип вопроса</Label>
                  <Select value={questionType} onValueChange={setQuestionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MULTIPLE_CHOICE">Один правильный ответ</SelectItem>
                      <SelectItem value="MULTIPLE_SELECT">Несколько правильных ответов</SelectItem>
                      <SelectItem value="TRUE_FALSE">Правда/Ложь</SelectItem>
                      <SelectItem value="TEXT_INPUT">Текстовый ответ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="questionPoints">Баллы за правильный ответ</Label>
                  <Input
                    id="questionPoints"
                    type="number"
                    value={questionPoints}
                    onChange={(e) => setQuestionPoints(Number(e.target.value))}
                    min={1}
                    max={1000}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="questionTimeLimit">Время на ответ (секунды)</Label>
                  <Input
                    id="questionTimeLimit"
                    type="number"
                    value={questionTimeLimit}
                    onChange={(e) => setQuestionTimeLimit(Number(e.target.value))}
                    min={5}
                    max={300}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="questionText">Текст вопроса *</Label>
                <Textarea
                  id="questionText"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Введите текст вопроса"
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="questionImageUrl" className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  URL изображения (необязательно)
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="questionImageUrl"
                      value={questionImageUrl}
                      onChange={(e) => setQuestionImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="pl-10"
                    />
                  </div>
                </div>
                {questionImageUrl && (
                  <div className="mt-2">
                    <img
                      src={questionImageUrl || "/placeholder.svg"}
                      alt="Предпросмотр изображения"
                      className="max-w-xs h-auto rounded border"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Варианты ответов для множественного выбора */}
              {(questionType === "MULTIPLE_CHOICE" ||
                questionType === "MULTIPLE_SELECT" ||
                questionType === "TRUE_FALSE") && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Варианты ответов</Label>
                    {questionType !== "TRUE_FALSE" && questionOptions.length < 8 && (
                      <Button variant="outline" size="sm" onClick={handleAddOption}>
                        <Plus className="w-4 h-4 mr-2" />
                        Добавить вариант
                      </Button>
                    )}
                  </div>

                  {questionType === "TRUE_FALSE" ? (
                    <div className="space-y-3">
                      {["Правда", "Ложь"].map((option, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded">
                          <input
                            type="radio"
                            name="truefalse"
                            checked={correctAnswers.includes(index)}
                            onChange={() => handleCorrectAnswerToggle(index)}
                            className="w-4 h-4"
                          />
                          <span className="flex-1">{option}</span>
                          <Badge variant={correctAnswers.includes(index) ? "default" : "outline"}>
                            {correctAnswers.includes(index) ? "Правильный" : "Неправильный"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {questionOptions.map((option, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <input
                            type={questionType === "MULTIPLE_CHOICE" ? "radio" : "checkbox"}
                            name="options"
                            checked={correctAnswers.includes(index)}
                            onChange={() => handleCorrectAnswerToggle(index)}
                            className="w-4 h-4"
                          />
                          <Input
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Вариант ${index + 1}`}
                            className="flex-1"
                          />
                          {questionOptions.length > 2 && (
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveOption(index)}>
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                          <Badge variant={correctAnswers.includes(index) ? "default" : "outline"}>
                            {correctAnswers.includes(index) ? "Правильный" : "Неправильный"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Текстовые ответы */}
              {questionType === "TEXT_INPUT" && (
                <div className="space-y-2">
                  <Label htmlFor="textCorrectAnswers">Правильные ответы (через запятую)</Label>
                  <Textarea
                    id="textCorrectAnswers"
                    value={textCorrectAnswers}
                    onChange={(e) => setTextCorrectAnswers(e.target.value)}
                    placeholder="Ответ 1, Ответ 2, Ответ 3"
                    rows={3}
                    className="resize-none bg-background text-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    Введите все возможные правильные ответы через запятую. Регистр не учитывается.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="questionExplanation">Объяснение (необязательно)</Label>
                <Textarea
                  id="questionExplanation"
                  value={questionExplanation}
                  onChange={(e) => setQuestionExplanation(e.target.value)}
                  placeholder="Объяснение правильного ответа"
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={resetQuestionForm} disabled={saving}>
                  Отмена
                </Button>
                <Button onClick={handleSaveQuestion} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {editingQuestion ? "Сохранить изменения" : "Добавить вопрос"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ошибки */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
