"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Trophy, Target, TrendingUp, Award } from "lucide-react"
import AnalyticsService from "@/lib/services/analyticsService"
import type { PlayerAnalytics as PlayerAnalyticsType } from "@/types/analytics"

interface PlayerAnalyticsProps {
  playerId: string
}

export default function PlayerAnalytics({ playerId }: PlayerAnalyticsProps) {
  const [analytics, setAnalytics] = useState<PlayerAnalyticsType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await AnalyticsService.getPlayerAnalytics(playerId)
        setAnalytics(data)
      } catch (error) {
        console.error("Error loading analytics:", error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [playerId])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка статистики...</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Статистика недоступна</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  const winRate = analytics.gamesPlayed > 0 ? Math.round((analytics.gamesWon / analytics.gamesPlayed) * 100) : 0

  const avgScore = analytics.gamesPlayed > 0 ? Math.round(analytics.totalScore / analytics.gamesPlayed) : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Всего игр</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.gamesPlayed}</div>
          <p className="text-xs text-muted-foreground">Побед: {analytics.gamesWon}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Процент побед</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{winRate}%</div>
          <Progress value={winRate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Средний балл</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgScore}</div>
          <p className="text-xs text-muted-foreground">Всего: {analytics.totalScore}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Достижения</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.achievements?.length || 0}</div>
          <p className="text-xs text-muted-foreground">Разблокировано</p>
        </CardContent>
      </Card>
    </div>
  )
}
