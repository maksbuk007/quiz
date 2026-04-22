"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Trophy, Lock, Crown, Sparkles, Info, CheckCircle, RefreshCw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import AchievementService from "@/lib/services/achievementService"
import type { Achievement, PlayerAchievement } from "@/types/achievements"

interface AchievementsListProps {
  userId: string
}

export default function AchievementsList({ userId }: AchievementsListProps) {
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([])
  const [playerAchievements, setPlayerAchievements] = useState<PlayerAchievement[]>([])
  const [achievementProgress, setAchievementProgress] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | "unlocked" | "locked">("all")

  const loadAchievements = async () => {
    try {
      setLoading(true)
      const all = AchievementService.getAllAchievements()
      const player = await AchievementService.getPlayerAchievements(userId)

      const progressMap: Record<string, number> = {}
      await Promise.all(
        all.map(async (achievement) => {
          const progress = await AchievementService.getAchievementProgress(userId, achievement.id)
          progressMap[achievement.id] = progress
        }),
      )

      setAllAchievements(all)
      setPlayerAchievements(player)
      setAchievementProgress(progressMap)
    } catch (error) {
      console.error("Error loading achievements:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) {
      loadAchievements()
    }
  }, [userId])

  useEffect(() => {
    const autoCheckAchievements = async () => {
      if (!userId || loading) return

      try {
        console.log("[v0] Auto-checking achievements on mount")
        const newlyUnlocked = await AchievementService.checkAndUnlockAllAchievements(userId)

        if (newlyUnlocked.length > 0) {
          console.log("[v0] Auto-unlocked achievements:", newlyUnlocked)
          // Reload achievements to show newly unlocked
          await loadAchievements()
        }
      } catch (error) {
        console.error("[v0] Error auto-checking achievements:", error)
      }
    }

    autoCheckAchievements()
  }, [userId, loading])

  const handleCheckAchievements = async () => {
    try {
      setChecking(true)
      console.log("[v0] Manual achievement check triggered")
      const newlyUnlocked = await AchievementService.checkAndUnlockAllAchievements(userId)

      if (newlyUnlocked.length > 0) {
        console.log("[v0] Manually unlocked achievements:", newlyUnlocked)
      }

      await loadAchievements()
    } catch (error) {
      console.error("[v0] Error checking achievements:", error)
    } finally {
      setChecking(false)
    }
  }

  const isUnlocked = (achievementId: string) => {
    return playerAchievements.some((pa) => pa.achievementId === achievementId)
  }

  const getProgress = (achievementId: string) => {
    return achievementProgress[achievementId] || 0
  }

  const getFilteredAchievements = () => {
    switch (activeTab) {
      case "unlocked":
        return allAchievements.filter((a) => isUnlocked(a.id))
      case "locked":
        return allAchievements.filter((a) => !isUnlocked(a.id))
      default:
        return allAchievements
    }
  }

  const filteredAchievements = getFilteredAchievements()
  const unlockedCount = allAchievements.filter((a) => isUnlocked(a.id)).length
  const totalPoints = playerAchievements.reduce((sum, pa) => {
    const achievement = allAchievements.find((a) => a.id === pa.achievementId)
    return sum + (achievement?.points || 0)
  }, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Разблокировано
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {unlockedCount} / {allAchievements.length}
            </div>
            <Progress value={(unlockedCount / allAchievements.length) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Всего очков
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPoints}</div>
            <p className="text-xs text-muted-foreground mt-2">За достижения</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Прогресс
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((unlockedCount / allAchievements.length) * 100)}%</div>
            <p className="text-xs text-muted-foreground mt-2">Выполнено</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleCheckAchievements} disabled={checking}>
          <RefreshCw className={`w-4 h-4 mr-2 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Проверка..." : "Проверить достижения"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "all" | "unlocked" | "locked")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Все ({allAchievements.length})
          </TabsTrigger>
          <TabsTrigger value="unlocked" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Разблокированные ({unlockedCount})
          </TabsTrigger>
          <TabsTrigger value="locked" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Закрытые ({allAchievements.length - unlockedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredAchievements.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {activeTab === "unlocked" && "Вы еще не разблокировали ни одного достижения"}
                  {activeTab === "locked" && "Все достижения разблокированы!"}
                  {activeTab === "all" && "Достижений не найдено"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAchievements.map((achievement) => {
                const unlocked = isUnlocked(achievement.id)
                const progress = getProgress(achievement.id)

                return (
                  <Card
                    key={achievement.id}
                    className={`transition-all hover:shadow-lg ${unlocked ? "border-primary bg-primary/5" : "opacity-75"}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`text-4xl transition-all ${unlocked ? "scale-110" : "grayscale opacity-50"}`}>
                            {achievement.icon}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2 text-base">
                              {achievement.name}
                              {unlocked && <Trophy className="w-4 h-4 text-yellow-500" />}
                            </CardTitle>
                            <CardDescription className="mt-1 text-sm">{achievement.description}</CardDescription>
                          </div>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Категория: {achievement.category}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge className={AchievementService.getRarityColor(achievement.rarity)}>
                            {AchievementService.getRarityName(achievement.rarity)}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Sparkles className="w-3 h-3" />
                            {achievement.points}
                          </Badge>
                        </div>

                        {!unlocked && progress > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Прогресс</span>
                              <span className="font-medium">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        )}

                        {!unlocked && progress === 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Lock className="w-3 h-3" />
                            <span>Не начато</span>
                          </div>
                        )}

                        {unlocked && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Разблокировано</span>
                            <span className="font-medium">
                              {new Date(
                                playerAchievements.find((pa) => pa.achievementId === achievement.id)?.unlockedAt || 0,
                              ).toLocaleDateString("ru-RU")}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
