"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { collection, query, where, getDocs, doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { updateProfile } from "firebase/auth"
import type { Game } from "@/types/game"
import {
  User,
  Trophy,
  Gamepad2,
  Calendar,
  Star,
  LogOut,
  Loader2,
  TrendingUp,
  Edit,
  Save,
  X,
  AlertCircle,
} from "lucide-react"
import AchievementsList from "@/components/achievements/AchievementsList"
import PlayerAnalytics from "@/components/analytics/PlayerAnalytics"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UserStats {
  gamesCreated: number
  gamesPlayed: number
  totalScore: number
  averageScore: number
  bestScore: number
  lastPlayed?: number
}

interface UserProfileProps {
  isOpen: boolean
  onClose: () => void
}

export default function UserProfile({ isOpen, onClose }: UserProfileProps) {
  const { user, logout, isAdmin } = useAuth()
  const [stats, setStats] = useState<UserStats>({
    gamesCreated: 0,
    gamesPlayed: 0,
    totalScore: 0,
    averageScore: 0,
    bestScore: 0,
  })
  const [recentGames, setRecentGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [lastNameChange, setLastNameChange] = useState<number | null>(null)
  const [nameChangeCooldown, setNameChangeCooldown] = useState<number>(0)

  useEffect(() => {
    if (!user || !isOpen) return

    const fetchUserStats = async () => {
      try {
        setLoading(true)

        const createdGamesQuery = query(collection(db, "games"), where("createdBy", "==", user.uid))
        const createdGamesSnapshot = await getDocs(createdGamesQuery)
        const createdGames = createdGamesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Game)

        const userStatsDoc = await getDoc(doc(db, "users", user.uid, "stats", "global"))
        let userStats: UserStats = {
          gamesCreated: createdGames.length,
          gamesPlayed: 0,
          totalScore: 0,
          averageScore: 0,
          bestScore: 0,
        }

        if (userStatsDoc.exists()) {
          const data = userStatsDoc.data()
          userStats = {
            gamesCreated: createdGames.length,
            gamesPlayed: data.gamesPlayed || 0,
            totalScore: data.totalScore || 0,
            averageScore: data.gamesPlayed > 0 ? Math.round(data.totalScore / data.gamesPlayed) : 0,
            bestScore: data.bestScore || 0,
            lastPlayed: data.lastPlayed,
          }
        } else {
          await setDoc(doc(db, "users", user.uid, "stats", "global"), {
            gamesPlayed: 0,
            gamesCreated: 0,
            totalScore: 0,
            bestScore: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            fastestAnswer: Number.POSITIVE_INFINITY,
            averageAnswerTime: 0,
            perfectGames: 0,
            currentWinStreak: 0,
            bestWinStreak: 0,
            lastPlayed: null,
          })
        }

        const userProfileDoc = await getDoc(doc(db, "users", user.uid))
        if (userProfileDoc.exists()) {
          const profileData = userProfileDoc.data()
          setLastNameChange(profileData.lastNameChange || null)
        }

        setStats(userStats)
        setRecentGames(createdGames.slice(0, 5))
      } catch (error) {
        console.error("Ошибка при загрузке статистики:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserStats()
  }, [user, isOpen])

  useEffect(() => {
    if (!lastNameChange) {
      setNameChangeCooldown(0)
      return
    }

    const updateCooldown = () => {
      const now = Date.now()
      const timeSinceLastChange = now - lastNameChange
      const cooldownPeriod = 24 * 60 * 60 * 1000
      const remaining = cooldownPeriod - timeSinceLastChange

      if (remaining <= 0) {
        setNameChangeCooldown(0)
      } else {
        setNameChangeCooldown(remaining)
      }
    }

    updateCooldown()
    const interval = setInterval(updateCooldown, 1000)
    return () => clearInterval(interval)
  }, [lastNameChange])

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await logout()
      onClose()
    } catch (error) {
      console.error("Logout error:", error)
      alert("Ошибка при выходе из аккаунта")
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleStartEditName = () => {
    if (nameChangeCooldown > 0) {
      return
    }
    setNewDisplayName(user?.displayName || "")
    setIsEditingName(true)
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setNewDisplayName("")
  }

  const handleSaveName = async () => {
    if (!user || !newDisplayName.trim()) return

    if (nameChangeCooldown > 0) {
      alert("Вы можете изменить имя только раз в 24 часа")
      return
    }

    try {
      setIsUpdatingName(true)

      const now = Date.now()

      await updateProfile(user, {
        displayName: newDisplayName.trim(),
      })

      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: newDisplayName.trim(),
          lastNameChange: now,
          email: user.email,
          updatedAt: now,
        },
        { merge: true },
      )

      setLastNameChange(now)
      setIsEditingName(false)

      alert("Имя успешно обновлено!")
    } catch (error) {
      console.error("Ошибка при обновлении имени:", error)
      alert("Не удалось обновить имя")
    } finally {
      setIsUpdatingName(false)
    }
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Никогда"
    return new Date(timestamp).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const formatCooldown = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours} ч ${minutes} мин`
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback>
                <User className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Введите ваше имя"
                    className="max-w-xs"
                    disabled={isUpdatingName}
                  />
                  <Button size="sm" onClick={handleSaveName} disabled={isUpdatingName || !newDisplayName.trim()}>
                    {isUpdatingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEditName} disabled={isUpdatingName}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{user.displayName || "Пользователь"}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartEditName}
                    className="h-8 w-8 p-0"
                    disabled={nameChangeCooldown > 0}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Ваш профиль и статистика в MaxQuiz
            {isAdmin && (
              <Badge variant="default" className="ml-2">
                Администратор
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {nameChangeCooldown > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Вы сможете изменить имя через {formatCooldown(nameChangeCooldown)}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Загрузка статистики...</p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="stats" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stats">Статистика</TabsTrigger>
              <TabsTrigger value="achievements">Достижения</TabsTrigger>
              <TabsTrigger value="games">Мои игры</TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Создано игр</CardTitle>
                    <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.gamesCreated}</div>
                    <p className="text-xs text-muted-foreground">{isAdmin ? "Как администратор" : "Всего созданных"}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Игр сыграно</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.gamesPlayed}</div>
                    <p className="text-xs text-muted-foreground">Как участник</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Лучший результат</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.bestScore}</div>
                    <p className="text-xs text-muted-foreground">Максимальный счет</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Средний счет</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.averageScore}</div>
                    <p className="text-xs text-muted-foreground">За игру</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Информация об аккаунте</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                        Email
                      </Label>
                      <p id="email" className="text-sm">
                        {user.email}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="displayName" className="text-sm font-medium text-muted-foreground">
                        Имя
                      </Label>
                      <div className="flex items-center gap-2">
                        {isEditingName ? (
                          <div className="flex items-center gap-2">
                            <Input
                              id="displayName"
                              value={newDisplayName}
                              onChange={(e) => setNewDisplayName(e.target.value)}
                              placeholder="Введите ваше имя"
                              className="max-w-xs"
                              disabled={isUpdatingName}
                            />
                            <Button
                              size="sm"
                              onClick={handleSaveName}
                              disabled={isUpdatingName || !newDisplayName.trim()}
                            >
                              {isUpdatingName ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEditName}
                              disabled={isUpdatingName}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p id="displayName" className="text-sm">
                              {user.displayName || "Не указано"}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleStartEditName}
                              className="h-8 w-8 p-0"
                              disabled={nameChangeCooldown > 0}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {nameChangeCooldown > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Можно изменить через {formatCooldown(nameChangeCooldown)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Последняя игра</p>
                      <p className="text-sm">{formatDate(stats.lastPlayed)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Роль</p>
                      <p className="text-sm">{isAdmin ? "Администратор" : "Пользователь"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Детальная аналитика</CardTitle>
                </CardHeader>
                <CardContent>
                  <PlayerAnalytics userId={user.uid} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6">
              <AchievementsList userId={user.uid} />
            </TabsContent>

            <TabsContent value="games" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Созданные игры</CardTitle>
                  <CardDescription>
                    {stats.gamesCreated === 0
                      ? "Вы еще не создали ни одной игры"
                      : `Всего создано игр: ${stats.gamesCreated}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recentGames.length === 0 ? (
                    <div className="text-center py-8">
                      <Gamepad2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Нет созданных игр</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentGames.map((game) => (
                        <div
                          key={game.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <h3 className="font-medium">{game.title}</h3>
                            {game.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{game.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              <Badge variant="outline">{game.questions?.length || 0} вопросов</Badge>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                {formatDate(game.createdAt)}
                              </div>
                            </div>
                          </div>
                          {game.categories && game.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 ml-4">
                              {game.categories.slice(0, 2).map((category) => (
                                <Badge key={category} variant="secondary" className="text-xs">
                                  {category}
                                </Badge>
                              ))}
                              {game.categories.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{game.categories.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Выход...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4 mr-2" />
                Выйти
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
