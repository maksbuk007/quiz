"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import AchievementService from "@/lib/services/achievementService"
import type { Achievement } from "@/types/achievements"

interface AchievementNotificationProps {
  achievementIds: string[]
  onClose: () => void
}

export default function AchievementNotification({ achievementIds, onClose }: AchievementNotificationProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const loadAchievements = async () => {
      const allAchievements = AchievementService.getAllAchievements()
      const unlocked = allAchievements.filter((a) => achievementIds.includes(a.id))
      setAchievements(unlocked)
    }

    if (achievementIds.length > 0) {
      loadAchievements()
    }
  }, [achievementIds])

  useEffect(() => {
    if (achievements.length > 0 && currentIndex < achievements.length) {
      const timer = setTimeout(() => {
        if (currentIndex === achievements.length - 1) {
          onClose()
        } else {
          setCurrentIndex(currentIndex + 1)
        }
      }, 4000)

      return () => clearTimeout(timer)
    }
  }, [currentIndex, achievements.length, onClose])

  if (achievements.length === 0) return null

  const currentAchievement = achievements[currentIndex]

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "from-gray-500 to-gray-700"
      case "rare":
        return "from-blue-500 to-blue-700"
      case "super_rare":
        return "from-purple-500 to-purple-700"
      case "epic":
        return "from-pink-500 to-pink-700"
      case "mythic":
        return "from-red-500 to-red-700"
      case "legendary":
        return "from-yellow-500 to-yellow-700"
      case "secret":
        return "from-purple-500 via-pink-500 to-red-500"
      default:
        return "from-gray-500 to-gray-700"
    }
  }

  const getRarityName = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "Обычное"
      case "rare":
        return "Редкое"
      case "super_rare":
        return "Супер-редкое"
      case "epic":
        return "Эпическое"
      case "mythic":
        return "Мифическое"
      case "legendary":
        return "Легендарное"
      case "secret":
        return "Секретное"
      default:
        return "Неизвестно"
    }
  }

  return (
    <AnimatePresence>
      {currentAchievement && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          className="fixed bottom-4 right-4 z-50 max-w-md"
        >
          <Card className={`bg-gradient-to-br ${getRarityColor(currentAchievement.rarity)} border-none shadow-2xl`}>
            <CardHeader className="relative pb-2">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
              <CardTitle className="flex items-center gap-2 text-white">
                <Trophy className="h-5 w-5" />
                Достижение разблокировано!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="text-4xl"
                >
                  <Trophy className="w-12 h-12 text-white" />
                </motion.div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-white">{currentAchievement.name}</h3>
                  <p className="text-sm text-white/90 mt-1">{currentAchievement.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {getRarityName(currentAchievement.rarity)}
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white">
                  +{currentAchievement.points} очков
                </Badge>
              </div>

              {achievements.length > 1 && (
                <div className="flex gap-1 justify-center pt-2">
                  {achievements.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentIndex ? "w-8 bg-white" : "w-1.5 bg-white/30"
                      }`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
