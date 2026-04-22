"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import ThemeToggle from "@/components/ui/ThemeToggle"
import UserProfile from "@/components/ui/UserProfile"
import ImportExportDialog from "@/components/game/ImportExportDialog"
import ImportExportService from "@/lib/services/importExportService"
import UserAnalyticsTable from "@/components/admin/UserAnalyticsTable"
import RoleManagementPanel from "@/components/admin/RoleManagementPanel"
import GameManagementDialog from "@/components/admin/GameManagementDialog"
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore"
import { ref, onValue } from "firebase/database"
import { db, realtimeDb } from "@/lib/firebase/config"
import { generateUniqueGameCode } from "@/lib/utils/gameUtils"
import type { Game, GamePermission } from "@/types/game"
import {
  Plus,
  Search,
  Edit,
  Play,
  Tag,
  Clock,
  Calendar,
  SortAsc,
  Loader2,
  ArrowLeft,
  Settings,
  BarChart3,
  Upload,
  Users,
  Lock,
  Unlock,
  MoreVertical,
  Info,
  MonitorPlay,
  Zap,
} from "lucide-react"
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export default function AdminPage() {
  const router = useRouter()
  const { user, isAdmin, isCreator, userRole, loading: authLoading } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("date-desc")
  const [activeTab, setActiveTab] = useState("my")
  const [gameToDelete, setGameToDelete] = useState<string | null>(null)
  const [gameToToggleLock, setGameToToggleLock] = useState<{ id: string; isLocked: boolean } | null>(null)
  const [viewingGameSessions, setViewingGameSessions] = useState<Game | null>(null)
  const [selectedGameForManagement, setSelectedGameForManagement] = useState<Game | null>(null)
  const [showManagementDialog, setShowManagementDialog] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  // Live session status per game so we can swap "Запустить" ↔ "Admin panel" in real time.
  // A session is considered "active" (= admin panel is resumable) when it exists
  // in the realtime DB AND its status is not "finished".
  const [activeSessions, setActiveSessions] = useState<
    Record<string, { status: string; mode?: string } | null>
  >({})

  const categories = useMemo(() => {
    const allCategories = new Set<string>()
    games.forEach((game) => {
      if (game.categories && Array.isArray(game.categories)) {
        game.categories.forEach((category) => allCategories.add(category))
      }
    })
    return Array.from(allCategories).sort()
  }, [games])

  const myGames = useMemo(() => {
    return games.filter((game) => game.createdBy === user?.uid)
  }, [games, user])

  const sharedGames = useMemo(() => {
    return games.filter((game) => game.sharedWith?.[user?.email || ""])
  }, [games, user])

  const filteredGames = useMemo(() => {
    let result = myGames

    if (searchQuery.trim()) {
      result = result.filter(
        (g) =>
          g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.code.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    if (selectedCategory !== "all") {
      result = result.filter((g) => g.categories && g.categories.includes(selectedCategory))
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return (b.createdAt || 0) - (a.createdAt || 0)
        case "date-asc":
          return (a.createdAt || 0) - (b.createdAt || 0)
        case "title-asc":
          return a.title.localeCompare(b.title, "ru")
        case "title-desc":
          return b.title.localeCompare(a.title, "ru")
        case "questions-desc":
          return (b.questions?.length || 0) - (a.questions?.length || 0)
        case "questions-asc":
          return (a.questions?.length || 0) - (b.questions?.length || 0)
        default:
          return 0
      }
    })

    return result
  }, [myGames, searchQuery, selectedCategory, sortBy])

  useEffect(() => {
    if (!user || !isAdmin) {
      router.push("/")
    }
  }, [authLoading, isAdmin, router])

  useEffect(() => {
    if (!user || !isAdmin) return

    const fetchGames = async () => {
      try {
        setLoading(true)
        const gamesQuery = query(collection(db, "games"), orderBy("createdAt", "desc"))
        const querySnapshot = await getDocs(gamesQuery)

        const gamesData: Game[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          gamesData.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt,
          } as Game)
        })

        setGames(gamesData)
      } catch (error) {
        console.error("Ошибка при загрузке игр:", error)
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить игры",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
  }, [user, isAdmin])

  // Subscribe to each game's session status so cards can live-toggle between
  // "Запустить" and "Admin panel". Enforces 1 session per game.
  useEffect(() => {
    if (!games.length) return

    const unsubscribers: (() => void)[] = []
    games.forEach((game) => {
      const sessionRef = ref(realtimeDb, `sessions/${game.id}`)
      const unsub = onValue(sessionRef, (snap) => {
        const data = snap.val() as { status?: string; mode?: string } | null
        setActiveSessions((prev) => ({
          ...prev,
          [game.id]: data
            ? { status: data.status ?? "waiting", mode: data.mode }
            : null,
        }))
      })
      unsubscribers.push(unsub)
    })

    return () => {
      unsubscribers.forEach((u) => u())
    }
  }, [games])

  const handleImportGame = async (gameData: Partial<Game>) => {
    if (!user) return

    try {
      const gameCode = await generateUniqueGameCode()

      const newGame: Omit<Game, "id"> = {
        code: gameCode,
        title: gameData.title || "Импортированная игра",
        description: gameData.description || "",
        hostId: user.uid,
        hostEmail: user.email || "",
        questions: gameData.questions || [],
        maxPlayers: gameData.maxPlayers || 0,
        status: "draft",
        currentQuestionIndex: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: user.uid,
        categories: gameData.categories || [],
        isLocked: false,
        settings: gameData.settings || {
          defaultTimeLimit: 30,
          defaultPoints: 10,
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
        },
      }

      const cleanedGame = ImportExportService.cleanObject(newGame)
      const docRef = await addDoc(collection(db, "games"), cleanedGame)

      toast({
        title: "Успешно",
        description: `Игра импортирована! Код: ${gameCode}`,
      })

      setGames([{ id: docRef.id, ...cleanedGame } as Game, ...games])
    } catch (error) {
      console.error("Ошибка импорта игры:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось импортировать игру",
        variant: "destructive",
      })
    }
  }

  const handleDeleteGame = async (gameId: string) => {
    try {
      await deleteDoc(doc(db, "games", gameId))
      setGames(games.filter((g) => g.id !== gameId))
      toast({
        title: "Игра удалена",
        description: "Игра успешно удалена",
      })
    } catch (error) {
      console.error("Ошибка удаления игры:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось удалить игру",
        variant: "destructive",
      })
    }
  }

  const handleToggleLock = async (gameId: string, isLocked: boolean) => {
    try {
      const newLockState = !isLocked
      await updateDoc(doc(db, "games", gameId), {
        isLocked: newLockState,
      })

      setGames(
        games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                isLocked: newLockState,
              }
            : g,
        ),
      )

      toast({
        title: newLockState ? "Игра заблокирована" : "Игра разблокирована",
        description: newLockState ? "Новые игроки не смогут присоединиться" : "Игроки могут присоединиться к игре",
      })
    } catch (error) {
      console.error("Ошибка изменения блокировки:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус блокировки",
        variant: "destructive",
      })
    }
  }

  const handleShareGame = async (gameId: string, email: string, permission: GamePermission) => {
    try {
      const gameRef = doc(db, "games", gameId)
      const game = games.find((g) => g.id === gameId)
      if (!game) return

      // Удаляем undefined значения из объекта permission перед сохранением в Firestore
      const cleanPermission: Record<string, any> = {
        email: permission.email,
        role: permission.role,
      }

      if (permission.canViewAnalytics !== undefined) {
        cleanPermission.canViewAnalytics = permission.canViewAnalytics
      }

      if (permission.tagFilter !== undefined && permission.tagFilter !== null && permission.tagFilter.length > 0) {
        cleanPermission.tagFilter = permission.tagFilter
      }

      if (permission.createdAt !== undefined) {
        cleanPermission.createdAt = permission.createdAt
      }

      const sharedWith = game.sharedWith ? { ...game.sharedWith } : {}
      sharedWith[email] = cleanPermission

      await updateDoc(gameRef, { sharedWith })

      setGames(games.map((g) => (g.id === gameId ? { ...g, sharedWith } : g)))

      toast({
        title: "Успешно",
        description: `Доступ предоставлен пользователю ${email}`,
      })
    } catch (error) {
      console.error("Error sharing game:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось предоставить доступ",
        variant: "destructive",
      })
    }
  }

  const handleRevokeAccess = async (gameId: string, email: string) => {
    try {
      const gameRef = doc(db, "games", gameId)
      const game = games.find((g) => g.id === gameId)
      if (!game) return

      const sharedWith = { ...game.sharedWith }
      delete sharedWith[email]

      await updateDoc(gameRef, { sharedWith })

      setGames(games.map((g) => (g.id === gameId ? { ...g, sharedWith } : g)))

      toast({
        title: "Успешно",
        description: `Доступ отозван у пользователя ${email}`,
      })
    } catch (error) {
      console.error("Error revoking access:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось отозвать доступ",
        variant: "destructive",
      })
    }
  }

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "Неизвестно"

    try {
      let date: Date

      // Handle Firestore Timestamp objects
      if (timestamp && typeof timestamp === "object" && "seconds" in timestamp) {
        date = new Date(timestamp.seconds * 1000)
      }
      // Handle objects with toDate method
      else if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
        date = timestamp.toDate()
      }
      // Handle Date objects
      else if (timestamp instanceof Date) {
        date = timestamp
      }
      // Handle ISO strings
      else if (typeof timestamp === "string") {
        date = new Date(timestamp)
      }
      // Handle millisecond timestamps
      else if (typeof timestamp === "number") {
        date = new Date(timestamp)
      }
      // Fallback
      else {
        return "Неизвестно"
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Неизвестно"
      }

      return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      console.error("[v0] Error formatting date:", error)
      return "Неизвестно"
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Проверка авторизации...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const GameCard = ({ game }: { game: Game }) => {
    const canView = isCreator || game.createdBy === user?.uid || game.sharedWith?.[user?.email || ""]
    const canManage = isCreator || game.createdBy === user?.uid

    // A session is "resumable" when it exists AND hasn't finished yet.
    // The admin can rejoin directly — the "Запустить" button becomes "Admin panel".
    const sessionInfo = activeSessions[game.id]
    const hasResumableSession = !!sessionInfo && sessionInfo.status !== "finished"
    const isSelfPacedSession = sessionInfo?.mode === "self_paced"
    const resumeHref = isSelfPacedSession ? `/host/${game.id}/selfpaced` : `/host/${game.id}`

    if (!canView) return null

    return (
      <Card className="hover:shadow-lg transition-shadow relative flex flex-col">
        {game.isLocked && (
          <div className="absolute top-2 right-2 z-10">
            <Badge variant="destructive" className="gap-1">
              <Lock className="w-3 h-3" />
              Закрыта
            </Badge>
          </div>
        )}
        {hasResumableSession && !game.isLocked && (
          <div className="absolute top-2 right-2 z-10">
            <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              Сессия активна
            </Badge>
          </div>
        )}
        <CardHeader>
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-lg line-clamp-2">{game.title}</CardTitle>
            <Badge variant="outline" className="shrink-0">
              {game.questions?.length || 0} вопросов
            </Badge>
          </div>
          {game.description && <CardDescription className="line-clamp-2">{game.description}</CardDescription>}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="font-mono text-sm">
              {game.code}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-3">
            {game.categories && game.categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {game.categories.slice(0, 3).map((category) => (
                  <Badge key={category} variant="secondary" className="text-xs">
                    {category}
                  </Badge>
                ))}
                {game.categories.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{game.categories.length - 3}
                  </Badge>
                )}
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDateTime(game.createdAt)}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {game.questions?.reduce((total, q) => total + (q.timeLimit || 30), 0) || 0}с
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 flex-wrap">
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/edit/${game.id}`)}
                className="gap-1 flex-1"
              >
                <Edit className="w-4 h-4" />
                Изменить
              </Button>
            </>
          )}
          {hasResumableSession ? (
            <Button
              size="sm"
              onClick={() => router.push(resumeHref)}
              className="gap-1 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSelfPacedSession ? <Zap className="w-4 h-4" /> : <MonitorPlay className="w-4 h-4" />}
              Admin panel
            </Button>
          ) : (
            <Button size="sm" onClick={() => router.push(`/host/${game.id}/launch`)} className="gap-1 flex-1">
              <Play className="w-4 h-4" />
              Запустить
            </Button>
          )}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 bg-transparent w-full sm:w-auto">
                  <MoreVertical className="w-4 h-4" />
                  Дополнительно
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowInfo(true)}>
                  <Info className="w-4 h-4 mr-2" />
                  Информация об игре
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggleLock(game.id, game.isLocked)}>
                  {game.isLocked ? (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      Разблокировать
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Заблокировать
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedGameForManagement(game)
                    setShowManagementDialog(true)
                  }}
                >
                  <MoreVertical className="w-4 h-4 mr-2" />
                  Управление
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={showInfo} onOpenChange={setShowInfo}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Информация об игре</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Название</p>
                  <p className="text-base font-medium">{game.title}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Дата создания</p>
                  <p className="text-base">{formatDateTime(game.createdAt)}</p>
                </div>
                {game.updatedAt && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Последнее редактирование</p>
                    <p className="text-base">{formatDateTime(game.updatedAt)}</p>
                  </div>
                )}
                {game.hostEmail && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Создатель</p>
                    <p className="text-base break-all">{game.hostEmail}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Количество вопросов</p>
                  <p className="text-base">{game.questions?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Время прохождения</p>
                  <p className="text-base">
                    {(() => {
                      const totalSeconds = game.questions?.reduce((total, q) => total + (q.timeLimit || 30), 0) || 0
                      const minutes = Math.floor(totalSeconds / 60)
                      const seconds = totalSeconds % 60
                      return `${minutes} мин ${seconds} сек`
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Максимальная сумма баллов</p>
                  <p className="text-base">
                    {game.questions?.reduce((total, q) => total + (q.points || 1000), 0) || 0}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            На главную
          </Button>
          <h1 className="text-2xl font-bold">Панель администратора</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Профиль
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push("/admin/create")} className="gap-2">
          <Plus className="w-4 h-4" />
          Создать новую игру
        </Button>
        <ImportExportDialog
          onImportGame={handleImportGame}
          trigger={
            <Button variant="outline" className="gap-2 bg-transparent">
              <Upload className="w-4 h-4" />
              Импортировать игру
            </Button>
          }
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          {isCreator && <TabsTrigger value="all">Все игры</TabsTrigger>}
          <TabsTrigger value="my">Мои игры</TabsTrigger>
          <TabsTrigger value="shared">Со мной поделились</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Пользователи
          </TabsTrigger>
          {isCreator && (
            <TabsTrigger value="roles">
              <Settings className="w-4 h-4 mr-2" />
              Управление ролями
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Поиск игр..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Tag className="text-muted-foreground w-4 h-4" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <SortAsc className="text-muted-foreground w-4 h-4" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Сначала новые</SelectItem>
                  <SelectItem value="date-asc">Сначала старые</SelectItem>
                  <SelectItem value="title-asc">По названию (А-Я)</SelectItem>
                  <SelectItem value="title-desc">По названию (Я-А)</SelectItem>
                  <SelectItem value="questions-desc">Больше вопросов</SelectItem>
                  <SelectItem value="questions-asc">Меньше вопросов</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">Загрузка игр...</p>
              </div>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchQuery || selectedCategory !== "all" ? "Игры не найдены" : "Пока нет игр"}
              </p>
              <Button onClick={() => router.push("/admin/create")}>
                <Plus className="w-4 h-4 mr-2" />
                Создать первую игру
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Поиск игр..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Tag className="text-muted-foreground w-4 h-4" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <SortAsc className="text-muted-foreground w-4 h-4" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Сначала новые</SelectItem>
                  <SelectItem value="date-asc">Сначала старые</SelectItem>
                  <SelectItem value="title-asc">По названию (А-Я)</SelectItem>
                  <SelectItem value="title-desc">По названию (Я-А)</SelectItem>
                  <SelectItem value="questions-desc">Больше вопросов</SelectItem>
                  <SelectItem value="questions-asc">Меньше вопросов</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">Загрузка ваших игр...</p>
              </div>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchQuery || selectedCategory !== "all" ? "Ваши игры не найдены" : "У вас пока нет игр"}
              </p>
              <Button onClick={() => router.push("/admin/create")}>
                <Plus className="w-4 h-4 mr-2" />
                Создать первую игру
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared" className="space-y-4">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-4">Игры, со мной поделились</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sharedGames.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
              {sharedGames.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Пока нет игр, со мной поделились</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Общая аналитика
              </CardTitle>
              <CardDescription>Статистика по всем играм и пользователям</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserAnalyticsTable />
        </TabsContent>

        {isCreator && (
          <TabsContent value="roles" className="space-y-4">
            <RoleManagementPanel />
          </TabsContent>
        )}
      </Tabs>

      {selectedGameForManagement && (
        <GameManagementDialog
          game={selectedGameForManagement}
          isCreator={user?.email === selectedGameForManagement.hostEmail}
          onDelete={handleDeleteGame}
          onShare={handleShareGame}
          onRevokeAccess={handleRevokeAccess}
          open={showManagementDialog}
          onOpenChange={setShowManagementDialog}
        />
      )}

      {user && <UserProfile isOpen={profileOpen} onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
