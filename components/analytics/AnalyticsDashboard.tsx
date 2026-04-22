"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AnalyticsService } from "@/lib/services/analyticsService"
import type { OverallAnalytics, GameAnalytics } from "@/types/analytics"
import { BarChart3, Users, Trophy, Clock, TrendingUp, Target, Zap, Award } from "lucide-react"

interface AnalyticsDashboardProps {
  gameId?: string
}

export default function AnalyticsDashboard({ gameId }: AnalyticsDashboardProps) {
  const [overallAnalytics, setOverallAnalytics] = useState<OverallAnalytics | null>(null)
  const [gameAnalytics, setGameAnalytics] = useState<GameAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)

        if (gameId) {
          const analytics = await AnalyticsService.getGameAnalytics(gameId)
          setGameAnalytics(analytics)
        } else {
          const analytics = await AnalyticsService.getOverallAnalytics()
          setOverallAnalytics(analytics)
        }
      } catch (error) {
        console.error("Ошибка загрузки аналитики:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [gameId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка аналитики...</p>
        </div>
      </div>
    )
  }

  if (gameId && gameAnalytics) {
    return <GameAnalyticsView analytics={gameAnalytics} />
  }

  if (!gameId && overallAnalytics) {
    return <OverallAnalyticsView analytics={overallAnalytics} />
  }

  return (
    <div className="text-center py-12">
      <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">Нет данных для отображения</p>
    </div>
  )
}

function GameAnalyticsView({ analytics }: { analytics: GameAnalytics }) {
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}м ${seconds}с`
  }

  return (
    <div className="space-y-6">
      {/* Общая статистика игры */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего игроков</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalPlayers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средний счет</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analytics.averageScore)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Завершили игру</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analytics.completionRate)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Длительность</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(analytics.sessionDuration)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="questions">Анализ вопросов</TabsTrigger>
          <TabsTrigger value="players">Анализ игроков</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Статистика по вопросам</CardTitle>
              <CardDescription>Анализ сложности и времени ответов</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.questionStats.map((question, index) => (
                  <div key={question.questionId} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">Вопрос {index + 1}</h4>
                      <Badge
                        variant={
                          question.difficultyScore > 70
                            ? "default"
                            : question.difficultyScore > 40
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {question.difficultyScore > 70
                          ? "Легкий"
                          : question.difficultyScore > 40
                            ? "Средний"
                            : "Сложный"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{question.questionText}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Правильных ответов:</span>
                        <div className="font-medium">
                          {question.correctAnswers} из {question.totalAnswers}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Среднее время:</span>
                        <div className="font-medium">{Math.round(question.averageTime)}с</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Успешность:</span>
                        <div className="font-medium">{Math.round(question.difficultyScore)}%</div>
                      </div>
                    </div>

                    {Object.keys(question.answerDistribution).length > 0 && (
                      <div className="mt-3">
                        <span className="text-sm text-muted-foreground">Распределение ответов:</span>
                        <div className="mt-2 space-y-1">
                          {Object.entries(question.answerDistribution).map(([answer, count]) => (
                            <div key={answer} className="flex justify-between items-center">
                              <span className="text-sm">{answer}</span>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Результаты игроков</CardTitle>
              <CardDescription>Детальная статистика по каждому игроку</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.playerStats
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div key={player.playerId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                          <span className="text-sm font-bold">#{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium">{player.nickname}</div>
                          <div className="text-sm text-muted-foreground">
                            {player.correctAnswers} из {player.totalAnswers} правильных
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{player.score} очков</div>
                        <div className="text-sm text-muted-foreground">
                          Среднее время: {Math.round(player.averageTime)}с
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OverallAnalyticsView({ analytics }: { analytics: OverallAnalytics }) {
  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`
  }

  return (
    <div className="space-y-6">
      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего игр</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalGames}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего игроков</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalPlayers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Игроков на игру</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analytics.averagePlayersPerGame)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средняя длительность</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(analytics.averageGameDuration)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Популярные категории */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Популярные категории
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.mostPopularCategories.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">#{index + 1}</span>
                    <span>{category.category}</span>
                  </div>
                  <Badge variant="outline">{category.count} игр</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Топ игр */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Лучшие игры по результатам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topPerformingGames.slice(0, 5).map((game, index) => (
                <div key={game.gameId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">#{index + 1}</span>
                    <span className="truncate">{game.title}</span>
                  </div>
                  <Badge variant="outline">{Math.round(game.averageScore)} очков</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
