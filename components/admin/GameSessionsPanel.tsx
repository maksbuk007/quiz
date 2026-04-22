"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronUp,
  Trophy,
  Target,
  Timer,
  CheckCircle2,
  Trash2,
  FileText,
} from "lucide-react"
import SessionPlayerAnswersDialog from "@/components/admin/SessionPlayerAnswersDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SessionAnalyticsService } from "@/lib/services/sessionAnalyticsService"
import { ExportService } from "@/lib/services/exportService"
import type { SessionRecord, SessionPlayerRecord } from "@/types/sessionAnalytics"
import type { Game } from "@/types/game"
import { toast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

interface GameSessionsPanelProps {
  game: Game
}

export default function GameSessionsPanel({ game }: GameSessionsPanelProps) {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [viewingPlayer, setViewingPlayer] = useState<SessionPlayerRecord | null>(null)

  useEffect(() => {
    console.log("[v0] GameSessionsPanel v2.0 loaded - comprehensive statistics enabled")
  }, [])

  useEffect(() => {
    loadSessions()
  }, [game.id])

  useEffect(() => {
    if (sessions.length > 0 && !expandedSession) {
      console.log("[v0] Auto-expanding first session:", sessions[0].id)
      setExpandedSession(sessions[0].id)
    }
  }, [sessions])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const gameSessions = await SessionAnalyticsService.getGameSessions(game.id)
      setSessions(gameSessions)
    } catch (error) {
      console.error("Error loading sessions:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить сессии",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return
    
    try {
      await SessionAnalyticsService.deleteSession(game.id, sessionToDelete)
      setSessions(sessions.filter(s => s.id !== sessionToDelete))
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
      toast({
        title: "Успешно",
        description: "Сессия удалена",
      })
    } catch (error) {
      console.error("Error deleting session:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось удалить сессию",
        variant: "destructive",
      })
    }
  }

  const handleExport = async (session: SessionRecord, format: "excel" | "pdf" | "csv") => {
    try {
      const exportData = {
        gameInfo: game,
        session: {
          players: session.players.reduce((acc, p) => {
            acc[p.playerId] = {
              id: p.playerId,
              name: p.nickname,
              avatar: p.avatar,
              score: p.finalScore,
              answers: p.answers,
              joinedAt: session.startedAt,
              isConnected: true,
            }
            return acc
          }, {} as any),
        },
        results: {
          players: session.players.map((p) => ({
            nickname: p.nickname,
            avatar: p.avatar || "",
            finalScore: p.finalScore,
            correctAnswers: p.correctAnswers,
            totalAnswers: p.totalAnswers,
            accuracy: p.accuracy,
            averageTime: p.averageTimePerQuestion,
            rank: p.rank,
            answers: p.answers as any[],
            achievements: [],
          })),
          questions: session.questionStats.map((q) => ({
            question: q.questionText,
            type: q.type,
            correctAnswer: "",
            totalAnswers: q.totalAnswers,
            correctCount: q.correctAnswers,
            accuracy: q.accuracy,
            averageTime: q.averageTime,
            answerDistribution: q.answerDistribution,
          })),
          summary: {
            totalPlayers: session.playerCount,
            totalQuestions: session.questionCount,
            averageScore: session.overallStats.averageScore,
            averageAccuracy: session.overallStats.averageAccuracy,
            averageTime: session.overallStats.averageTime,
            completionRate: session.overallStats.completionRate,
            topScore: session.overallStats.highestScore,
            difficulty:
              session.overallStats.averageAccuracy >= 80
                ? "Легкая"
                : session.overallStats.averageAccuracy >= 60
                  ? "Средняя"
                  : "Сложная",
          },
        },
        timestamp: session.completedAt,
        format,
      }

      if (format === "excel") {
        await ExportService.exportToExcel(exportData as any)
      } else if (format === "pdf") {
        await ExportService.exportToPDF(exportData as any)
      } else {
        await ExportService.exportToCSV(exportData as any)
      }

      toast({
        title: "Успешно",
        description: `Отчет экспортирован в формате ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error("Error exporting session:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось экспортировать отчет",
        variant: "destructive",
      })
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes} мин ${secs} сек`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Загрузка сессий...</p>
        </CardContent>
      </Card>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Нет завершенных сессий для этой игры</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            История сессий ({sessions.length})
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Расширенная статистика v2.0: игроки, рейтинги, статистика по вопросам, экспорт
          </CardDescription>
        </div>
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Полная статистика
        </Badge>
      </div>

      {sessions.map((session) => (
        <Card key={session.id} className="overflow-hidden">
          <CardHeader className="bg-muted/50 pb-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(session.completedAt)}
                </CardTitle>
                <CardDescription className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {session.playerCount} участников
                  </span>
                  <span className="font-mono text-xs">Код: {session.gameCode}</span>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select onValueChange={(value) => handleExport(session, value as any)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Download className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Экспорт" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={expandedSession === session.id ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                  className="min-w-[120px]"
                >
                  {expandedSession === session.id ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-2" />
                      Скрыть
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Подробнее
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSessionToDelete(session.id)
                    setDeleteDialogOpen(true)
                  }}
                  className="h-9"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Trophy className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{session.overallStats.highestScore}</p>
                  <p className="text-xs text-muted-foreground">Макс. счет</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{session.overallStats.averageAccuracy}%</p>
                  <p className="text-xs text-muted-foreground">Точность</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{formatDuration(session.duration)}</p>
                  <p className="text-xs text-muted-foreground">Время игры</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Timer className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{session.overallStats.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">Вопросов отвечено</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Target className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{session.overallStats.averageScore}</p>
                  <p className="text-xs text-muted-foreground">Средний счет</p>
                </div>
              </div>
            </div>

            {expandedSession === session.id && (
              <div className="border-t pt-4 mt-1">
                <Tabs defaultValue="players" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="players">Участники ({session.playerCount})</TabsTrigger>
                    <TabsTrigger value="questions">Вопросы ({session.questionCount})</TabsTrigger>
                    <TabsTrigger value="stats">Статистика</TabsTrigger>
                  </TabsList>

                  <TabsContent value="players" className="space-y-3 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm">Полный список участников</h4>
                      <Badge variant="secondary">{session.playerCount} игроков</Badge>
                    </div>
                    <div className="space-y-2">
                      {session.players.map((player) => (
                        <Card key={player.playerId} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between mb-3 gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Badge
                                variant={player.rank === 1 ? "default" : player.rank <= 3 ? "secondary" : "outline"}
                                className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                              >
                                #{player.rank}
                              </Badge>
                              <div className="min-w-0">
                                <p className="font-semibold text-base truncate">{player.nickname}</p>
                                <p className="text-sm text-muted-foreground">
                                  {player.correctAnswers} из {player.totalAnswers} правильных
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="font-bold text-xl">{player.finalScore}</p>
                                <p className="text-xs text-muted-foreground">очков</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-9 shrink-0"
                                onClick={() => setViewingPlayer(player)}
                                title="Просмотреть все ответы игрока"
                              >
                                <FileText className="w-4 h-4" />
                                <span className="hidden sm:inline">Ответы</span>
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs mb-1">Точность</p>
                              <div className="flex items-center gap-2">
                                <Progress value={player.accuracy} className="h-2.5 flex-1" />
                                <span className="font-semibold text-sm">{player.accuracy}%</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs mb-1">Среднее время</p>
                              <p className="font-semibold">{player.averageTimePerQuestion}с</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs mb-1">Всего времени</p>
                              <p className="font-semibold">
                                {Math.floor(player.totalTimeSpent / 60)}м {player.totalTimeSpent % 60}с
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="questions" className="space-y-3 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm">Статистика по каждому вопросу</h4>
                      <Badge variant="secondary">{session.questionCount} вопросов</Badge>
                    </div>
                    <div className="space-y-3">
                      {session.questionStats.map((stat) => (
                        <Card key={stat.questionId} className="p-4">
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-start justify-between mb-2">
                                <p className="font-semibold">Вопрос {stat.questionIndex + 1}</p>
                                <Badge variant="outline" className="text-xs">
                                  {stat.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">{stat.questionText}</p>
                            </div>

                            <div className="grid grid-cols-4 gap-4 py-2 border-y">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Ответили</p>
                                <p className="text-lg font-bold">{stat.totalAnswers}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Правильно</p>
                                <p className="text-lg font-bold text-green-600">{stat.correctAnswers}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Точность</p>
                                <p className="text-lg font-bold">{stat.accuracy}%</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Сред. время</p>
                                <p className="text-lg font-bold">{stat.averageTime}с</p>
                              </div>
                            </div>

                            {Object.keys(stat.answerDistribution).length > 0 && (
                              <div className="pt-3">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold">Распределение ответов</p>
                                  <p className="text-xs text-muted-foreground">Всего ответов: {stat.totalAnswers}</p>
                                </div>
                                <div className="space-y-3">
                                  {Object.entries(stat.answerDistribution)
                                    .sort(([, a], [, b]) => b - a) // Sort by count descending
                                    .map(([answer, count]) => {
                                      const percentage =
                                        stat.totalAnswers > 0 ? Math.round((count / stat.totalAnswers) * 100) : 0
                                      return (
                                        <div key={answer} className="space-y-1.5">
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm text-muted-foreground break-words flex-1 leading-relaxed">
                                              {answer}
                                            </p>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="font-semibold text-sm">{count}</span>
                                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full min-w-[3rem] text-center">
                                                {percentage}%
                                              </span>
                                            </div>
                                          </div>
                                          <div className="relative">
                                            <Progress value={percentage} className="h-2.5" />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                              <span className="text-[10px] font-bold text-white/80 drop-shadow-sm">
                                                {percentage > 10 ? `${percentage}%` : ""}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="stats" className="space-y-4 mt-4">
                    <div className="grid gap-4">
                      <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10">
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Общая статистика сессии
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Всего участников</p>
                            <p className="text-3xl font-bold">{session.playerCount}</p>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Всего вопросов</p>
                            <p className="text-3xl font-bold">{session.questionCount}</p>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Завершили тест</p>
                            <p className="text-3xl font-bold text-green-600">{session.overallStats.completionRate}%</p>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-4 bg-gradient-to-br from-green-500/5 to-green-500/10">
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Trophy className="w-4 h-4" />
                          Результаты участников
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Максимальный счет</p>
                            <p className="text-3xl font-bold text-green-600">{session.overallStats.highestScore}</p>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Средний счет</p>
                            <p className="text-3xl font-bold">{session.overallStats.averageScore}</p>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Минимальный счет</p>
                            <p className="text-3xl font-bold text-orange-600">{session.overallStats.lowestScore}</p>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Медианный счет</p>
                            <p className="text-3xl font-bold">{session.overallStats.medianScore}</p>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Средняя точность</p>
                            <p className="text-3xl font-bold">{session.overallStats.averageAccuracy}%</p>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Среднее время</p>
                            <p className="text-3xl font-bold">{session.overallStats.averageTime}с</p>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Временные показатели
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Общая длительность</p>
                            <p className="text-3xl font-bold">{formatDuration(session.duration)}</p>
                          </div>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-muted-foreground mb-1">Начало сессии</p>
                            <p className="text-lg font-semibold">{formatDate(session.startedAt)}</p>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сессию?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все данные сессии будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {viewingPlayer && (
        <SessionPlayerAnswersDialog
          isOpen={!!viewingPlayer}
          onClose={() => setViewingPlayer(null)}
          player={viewingPlayer}
          questions={game.questions}
        />
      )}
    </div>
  )
}
