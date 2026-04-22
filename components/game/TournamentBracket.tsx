"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AVATARS } from "@/components/ui/AvatarSelector"
import { TournamentService } from "@/lib/services/tournamentService"
import type { TournamentData, Player } from "@/types/game"
import { Trophy, Crown, Play, Clock, CheckCircle } from "lucide-react"

interface TournamentBracketProps {
  tournament: TournamentData
  players: Record<string, Player>
  gameId: string
  isHost?: boolean
  onStartMatch?: (roundIndex: number, matchIndex: number) => void
}

export default function TournamentBracket({
  tournament,
  players,
  gameId,
  isHost = false,
  onStartMatch,
}: TournamentBracketProps) {
  const [selectedMatch, setSelectedMatch] = useState<{ round: number; match: number } | null>(null)

  const getPlayerDisplay = (playerId: string) => {
    const player = players[playerId]
    if (!player) return { name: "Неизвестный", avatar: "❓", score: 0 }

    const avatar = AVATARS.find((a) => a.id === player.avatar)
    return {
      name: player.nickname,
      avatar: avatar?.emoji || "❓",
      score: player.score,
    }
  }

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 border-green-300 text-green-800"
      case "finished":
        return "bg-blue-100 border-blue-300 text-blue-800"
      default:
        return "bg-gray-100 border-gray-300 text-gray-600"
    }
  }

  const getMatchStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="w-4 h-4" />
      case "finished":
        return <CheckCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const stats = TournamentService.getTournamentStats(tournament)

  return (
    <div className="space-y-6">
      {/* Статистика турнира */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Турнир
            </CardTitle>
            <Badge variant={stats.isFinished ? "default" : "secondary"}>
              {stats.isFinished ? "Завершен" : `Раунд ${stats.currentRound}/${stats.totalRounds}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Прогресс турнира</span>
                <span>
                  {stats.finishedMatches}/{stats.totalMatches} матчей
                </span>
              </div>
              <Progress value={stats.progress} className="h-2" />
            </div>

            {stats.isFinished && stats.winner && (
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <Crown className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-bold text-lg">Победитель турнира</h3>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-2xl">{getPlayerDisplay(stats.winner).avatar}</span>
                  <span className="font-medium">{getPlayerDisplay(stats.winner).name}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Турнирная сетка */}
      <div className="space-y-6">
        {tournament.rounds.map((round, roundIndex) => (
          <Card key={round.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{round.name}</CardTitle>
                <Badge
                  variant={
                    round.status === "active" ? "default" : round.status === "finished" ? "secondary" : "outline"
                  }
                >
                  {round.status === "active" ? "Активный" : round.status === "finished" ? "Завершен" : "Ожидание"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {round.matches.map((match, matchIndex) => (
                  <div
                    key={match.id}
                    className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${getMatchStatusColor(match.status)} ${
                      selectedMatch?.round === roundIndex && selectedMatch?.match === matchIndex
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                    onClick={() => setSelectedMatch({ round: roundIndex, match: matchIndex })}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Матч {matchIndex + 1}</span>
                      <div className="flex items-center gap-1">
                        {getMatchStatusIcon(match.status)}
                        {isHost && match.status === "waiting" && match.players.length >= 2 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              onStartMatch?.(roundIndex, matchIndex)
                            }}
                          >
                            Начать
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {match.players.map((playerId, playerIndex) => {
                        const playerData = getPlayerDisplay(playerId)
                        const isWinner = match.winner === playerId
                        const score = match.score[playerId] || 0

                        return (
                          <div
                            key={playerId}
                            className={`flex items-center justify-between p-2 rounded ${
                              isWinner ? "bg-yellow-100 border border-yellow-300" : "bg-white/50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{playerData.avatar}</span>
                              <span className="font-medium">{playerData.name}</span>
                              {isWinner && <Crown className="w-4 h-4 text-yellow-600" />}
                            </div>
                            {match.status === "finished" && <span className="font-bold">{score}</span>}
                          </div>
                        )
                      })}

                      {match.players.length < 2 && (
                        <div className="text-center text-muted-foreground py-2">
                          <Clock className="w-4 h-4 mx-auto mb-1" />
                          <span className="text-sm">Ожидание игроков</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
