import { GameService } from "../firebase/gameService"
import type { TournamentData, TournamentRound, TournamentMatch, Player } from "@/types/game"

export class TournamentService {
  // Создание турнирного дерева
  static createTournamentBracket(players: Player[]): TournamentData {
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
    const rounds: TournamentRound[] = []

    // Определяем количество раундов
    const totalRounds = Math.ceil(Math.log2(shuffledPlayers.length))

    // Создаем первый раунд
    const firstRoundMatches: TournamentMatch[] = []
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
      const match: TournamentMatch = {
        id: `match_${i / 2}`,
        players: [shuffledPlayers[i].id, shuffledPlayers[i + 1]?.id].filter(Boolean),
        score: {},
        status: "waiting",
      }
      firstRoundMatches.push(match)
    }

    rounds.push({
      id: "round_1",
      name: "1/8 финала",
      matches: firstRoundMatches,
      status: "waiting",
    })

    // Создаем последующие раунды
    for (let round = 2; round <= totalRounds; round++) {
      const roundName = this.getRoundName(round, totalRounds)
      const matches: TournamentMatch[] = []

      const previousRoundMatches = rounds[round - 2].matches.length
      for (let i = 0; i < Math.ceil(previousRoundMatches / 2); i++) {
        matches.push({
          id: `round_${round}_match_${i}`,
          players: [],
          score: {},
          status: "waiting",
        })
      }

      rounds.push({
        id: `round_${round}`,
        name: roundName,
        matches,
        status: "waiting",
      })
    }

    return {
      rounds,
      currentRound: 0,
      participants: shuffledPlayers.map((p) => p.id),
      winners: [],
      bracket: { rounds, finalWinner: undefined },
    }
  }

  // Получение названия раунда
  private static getRoundName(round: number, totalRounds: number): string {
    const roundsFromEnd = totalRounds - round + 1
    switch (roundsFromEnd) {
      case 1:
        return "Финал"
      case 2:
        return "Полуфинал"
      case 3:
        return "1/4 финала"
      case 4:
        return "1/8 финала"
      default:
        return `Раунд ${round}`
    }
  }

  // Завершение матча
  static async finishMatch(
    gameId: string,
    roundIndex: number,
    matchIndex: number,
    results: Record<string, number>,
  ): Promise<void> {
    try {
      const session = await GameService.getSession(gameId)
      if (!session?.tournamentData) return

      const tournament = session.tournamentData
      const match = tournament.rounds[roundIndex].matches[matchIndex]

      // Определяем победителя
      const winner = Object.entries(results).reduce((a, b) => (results[a[0]] > results[b[0]] ? a : b))[0]

      // Обновляем матч
      match.winner = winner
      match.score = results
      match.status = "finished"

      // Проверяем, завершен ли раунд
      const round = tournament.rounds[roundIndex]
      const allMatchesFinished = round.matches.every((m) => m.status === "finished")

      if (allMatchesFinished) {
        round.status = "finished"

        // Переходим к следующему раунду
        if (roundIndex + 1 < tournament.rounds.length) {
          const nextRound = tournament.rounds[roundIndex + 1]
          const winners = round.matches.map((m) => m.winner!).filter(Boolean)

          // Заполняем следующий раунд
          for (let i = 0; i < nextRound.matches.length; i++) {
            const match = nextRound.matches[i]
            match.players = [winners[i * 2], winners[i * 2 + 1]].filter(Boolean)
          }

          nextRound.status = "active"
          tournament.currentRound = roundIndex + 1
        } else {
          // Турнир завершен
          tournament.bracket.finalWinner = winner
          tournament.winners = [winner]
        }
      }

      // Обновляем сессию
      await GameService.updateGameState(gameId, {
        tournamentData: tournament,
      })
    } catch (error) {
      console.error("Ошибка завершения матча:", error)
      throw error
    }
  }

  // Запуск следующего матча
  static async startNextMatch(gameId: string): Promise<boolean> {
    try {
      const session = await GameService.getSession(gameId)
      if (!session?.tournamentData) return false

      const tournament = session.tournamentData
      const currentRound = tournament.rounds[tournament.currentRound]

      if (!currentRound) return false

      // Находим следующий матч для запуска
      const nextMatch = currentRound.matches.find((m) => m.status === "waiting" && m.players.length >= 2)

      if (nextMatch) {
        nextMatch.status = "active"
        currentRound.status = "active"

        await GameService.updateGameState(gameId, {
          tournamentData: tournament,
          status: "active",
        })

        return true
      }

      return false
    } catch (error) {
      console.error("Ошибка запуска следующего матча:", error)
      return false
    }
  }

  // Получение текущего матча
  static getCurrentMatch(tournament: TournamentData): TournamentMatch | null {
    const currentRound = tournament.rounds[tournament.currentRound]
    if (!currentRound) return null

    return currentRound.matches.find((m) => m.status === "active") || null
  }

  // Получение статистики турнира
  static getTournamentStats(tournament: TournamentData) {
    const totalMatches = tournament.rounds.reduce((sum, round) => sum + round.matches.length, 0)
    const finishedMatches = tournament.rounds.reduce(
      (sum, round) => sum + round.matches.filter((m) => m.status === "finished").length,
      0,
    )

    return {
      totalRounds: tournament.rounds.length,
      currentRound: tournament.currentRound + 1,
      totalMatches,
      finishedMatches,
      progress: Math.round((finishedMatches / totalMatches) * 100),
      isFinished: !!tournament.bracket.finalWinner,
      winner: tournament.bracket.finalWinner,
    }
  }
}
