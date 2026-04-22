"use client"

import { useEffect, useState } from "react"
import AchievementNotification from "@/components/achievements/AchievementNotification"
import { useCheckAchievements } from "@/contexts/GameContext"
import { useSession } from "next-auth/react"

const GameRoomClient = () => {
  const { data: session, status: isLoading } = useSession()
  const playerId = session?.user?.id
  const [newAchievements, setNewAchievements] = useState<string[]>([])
  const { checkAchievements } = useCheckAchievements()

  useEffect(() => {
    if (session?.status === "finished" && playerId && session.players[playerId]) {
      const player = session.players[playerId]
      const answers = player.answers || []

      const correctAnswers = answers.filter((a) => a.isCorrect).length
      const totalQuestions = answers.length
      const timeSpent = answers.reduce((sum, a) => sum + a.timeSpent, 0)
      const fastestAnswer = Math.min(...answers.map((a) => a.timeSpent))

      // Определяем, выиграл ли игрок
      const sortedPlayers = Object.values(session.players).sort((a, b) => b.score - a.score)
      const isWinner = sortedPlayers[0]?.id === playerId

      // Проверяем, было ли возвращение (comeback)
      const wasComeback = false // Требует дополнительной логики отслеживания позиций

      checkAchievements({
        score: player.score,
        correctAnswers,
        totalQuestions,
        timeSpent,
        fastestAnswer,
        isWinner,
        wasComeback,
      }).then((unlockedIds) => {
        if (unlockedIds.length > 0) {
          setNewAchievements(unlockedIds)
        }
      })
    }
  }, [session?.status])

  return (
    <div>
      {/* Game room content here */}
      {newAchievements.length > 0 && (
        <AchievementNotification achievementIds={newAchievements} onClose={() => setNewAchievements([])} />
      )}
    </div>
  )
}

export default GameRoomClient
