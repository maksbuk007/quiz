"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { AVATARS } from "@/components/ui/AvatarSelector"
import type { Player } from "@/types/game"

interface AnimatedLeaderboardProps {
  players: Record<string, Player>
  showAnimation?: boolean
  previousPlayers?: Record<string, Player>
  showScoreChanges?: boolean
  showPositionChanges?: boolean
  maxItems?: number
  compact?: boolean
  title?: string
  currentPlayerId?: string
}

export default function AnimatedLeaderboard({
  players,
  showAnimation = true,
  previousPlayers = {},
  showScoreChanges = true,
  showPositionChanges = true,
  maxItems = 10,
  compact = false,
  title = "Таблица лидеров",
  currentPlayerId,
}: AnimatedLeaderboardProps) {
  const [internalPreviousPlayers, setInternalPreviousPlayers] = useState<Record<string, Player>>(previousPlayers)

  useEffect(() => {
    if (Object.keys(previousPlayers).length > 0) {
      setInternalPreviousPlayers(previousPlayers)
    }
  }, [previousPlayers])

  const getAvatarDisplay = (avatarId: string) => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    if (!avatar) {
      return <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-200 flex items-center justify-center">?</div>
    }

    return (
      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-xl ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }

  const sortedPlayers = Object.values(players)
    .filter((p) => p.id !== "host")
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxItems)

  const getScoreChange = (playerId: string) => {
    const currentPlayer = players[playerId]

    if (!currentPlayer) return 0

    // Use stored delta from database if available
    if (currentPlayer.lastQuestionDelta !== undefined) {
      return currentPlayer.lastQuestionDelta
    }

    // Fallback: calculate from previous state
    const previousPlayer = internalPreviousPlayers[playerId]
    if (!previousPlayer) return 0

    const delta = (currentPlayer.score || 0) - (previousPlayer.score || 0)
    return delta
  }

  const getPositionChange = (playerId: string, currentPosition: number) => {
    const previousSorted = Object.values(internalPreviousPlayers)
      .filter((p) => p.id !== "host")
      .sort((a, b) => (b.score || 0) - (a.score || 0))

    const previousPosition = previousSorted.findIndex((p) => p.id === playerId)

    if (previousPosition === -1) return 0

    return previousPosition - currentPosition
  }

  const getRankIcon = (position: number) => {
    if (position === 0) return <Crown className="w-5 h-5 text-yellow-500" />
    if (position === 1) return <Medal className="w-5 h-5 text-gray-400" />
    if (position === 2) return <Medal className="w-5 h-5 text-amber-600" />
    return null
  }

  return (
    <Card className={compact ? "" : "shadow-xl"}>
      <CardHeader className={compact ? "pb-3" : "pb-4"}>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <Trophy className="w-5 h-5 text-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 md:p-6">
        <div className={`space-y-${compact ? "2" : "3"}`}>
          <AnimatePresence mode="popLayout">
            {sortedPlayers.map((player, index) => {
              const scoreChange = showScoreChanges ? getScoreChange(player.id) : 0
              const positionChange = showPositionChanges ? getPositionChange(player.id, index) : 0
              const isCurrentPlayer = currentPlayerId === player.id

              return (
                <motion.div
                  key={player.id}
                  initial={showAnimation ? { opacity: 0, x: -20 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  layout
                  className={`flex items-center justify-between p-3 md:p-${compact ? "3" : "4"} rounded-lg ${
                    isCurrentPlayer
                      ? "bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-700"
                      : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1 md:gap-2 w-8 md:w-12 flex-shrink-0">
                      {getRankIcon(index) || (
                        <span className={`font-bold text-base md:${compact ? "text-lg" : "text-xl"}`}>{index + 1}</span>
                      )}
                      {showPositionChanges && positionChange !== 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`${positionChange > 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {positionChange > 0 ? (
                            <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                          ) : (
                            <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
                          )}
                        </motion.div>
                      )}
                      {showPositionChanges && positionChange === 0 && internalPreviousPlayers[player.id] && (
                        <Minus className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
                      )}
                    </div>

                    <div className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0">{getAvatarDisplay(player.avatar)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold truncate text-sm md:${compact ? "text-sm" : "text-base"}`}>
                          {player.nickname}
                        </span>
                        {isCurrentPlayer && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            Вы
                          </Badge>
                        )}
                      </div>
                      {!compact && (
                        <div className="text-xs text-muted-foreground hidden md:block">
                          {player.answers?.filter((a) => a.isCorrect).length || 0} правильных ответов
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-end md:items-center gap-1 md:gap-3 flex-shrink-0">
                    {showScoreChanges && scoreChange > 0 && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-green-600 dark:text-green-400 font-bold text-xs md:text-sm px-1.5 md:px-2 py-0.5 md:py-1 bg-green-100 dark:bg-green-900/30 rounded-md"
                      >
                        +{scoreChange}
                      </motion.div>
                    )}

                    <div className={`font-bold text-lg md:${compact ? "text-xl" : "text-2xl"}`}>
                      {player.score || 0}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}
