"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import CreateGameAdvanced from "@/components/game/CreateGameAdvanced"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import AchievementService from "@/lib/services/achievementService"
import { toast } from "@/hooks/use-toast"

export default function CreateGamePage() {
  const router = useRouter()
  const { user, isAdmin, loading } = useAuth()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push("/")
    }
  }, [loading, isAdmin, router])

  const handleGameCreated = async (gameId: string) => {
    if (user) {
      // Обновляем статистику создания игр
      const newAchievements = await AchievementService.updateGameCreationStats(user.uid)

      // Показываем уведомления о новых достижениях
      if (newAchievements.length > 0) {
        const achievements = AchievementService.getAllAchievements()
        newAchievements.forEach((achId) => {
          const achievement = achievements.find((a) => a.id === achId)
          if (achievement) {
            toast({
              title: "🎉 Новое достижение!",
              description: `${achievement.icon} ${achievement.name} - ${achievement.description}`,
              duration: 5000,
            })
          }
        })
      }
    }

    router.push(`/host/${gameId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Button variant="outline" onClick={() => router.push("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к списку игр
        </Button>
      </div>
      <CreateGameAdvanced onGameCreated={handleGameCreated} />
    </div>
  )
}
