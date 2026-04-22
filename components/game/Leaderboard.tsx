"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Medal, Award } from "lucide-react"
import type { Player } from "@/types/game"

interface LeaderboardProps {
  players: Record<string, Player>
}

export default function Leaderboard({ players }: LeaderboardProps) {
  const sortedPlayers = Object.values(players)
    .filter((player) => player.id !== "host")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold">{rank}</span>
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5" />
          Лидерборд
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                index < 3 ? "bg-gradient-to-r from-yellow-50 to-orange-50" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                {getRankIcon(index + 1)}
                <div>
                  <div className="font-medium">{player.nickname}</div>
                  <div className="text-sm text-gray-500">{player.answers.length} ответов</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{player.score}</div>
                <div className="text-sm text-gray-500">баллов</div>
              </div>
            </div>
          ))}
        </div>

        {sortedPlayers.length === 0 && <div className="text-center text-gray-500 py-8">Пока нет игроков</div>}
      </CardContent>
    </Card>
  )
}
