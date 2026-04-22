"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { ref, onValue } from "firebase/database"
import { db, realtimeDb } from "@/lib/firebase/config"
import { AVATARS } from "@/components/ui/AvatarSelector"
import type { Game, GameSession, Player } from "@/types/game"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, Clock, Flag, Loader2, Target, Trophy, Users } from "lucide-react"

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, "0")}`
}

function AvatarTile({ avatarId }: { avatarId?: string }) {
  const avatar = AVATARS.find((item) => item.id === avatarId)
  if (!avatar) {
    return <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-bold">?</div>
  }

  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${avatar.color}`}>
      {avatar.emoji}
    </div>
  )
}

type RowData = {
  player: Player
  rank: number
  score: number
  done: number
  progressPct: number
  correctCount: number
  accuracy: number
  finished: boolean
}

export default function SelfPacedScreenPage() {
  const { id } = useParams<{ id: string }>()
  const [game, setGame] = useState<Game | null>(null)
  const [session, setSession] = useState<GameSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, "games", id)).then((snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    const sessionRef = ref(realtimeDb, `sessions/${id}`)
    const unsub = onValue(sessionRef, (snap) => setSession(snap.val() as GameSession | null))
    return () => unsub()
  }, [id])

  useEffect(() => {
    if (!session?.startTime) return

    const tick = () => {
      const frozenAt = session.timersFrozenAt ?? (session.status === "finished" ? session.finishedAt : null)
      const endpoint = frozenAt ?? Date.now()
      const startTime = session.startTime ?? endpoint
      setElapsed(Math.max(0, Math.floor((endpoint - startTime) / 1000)))
    }

    tick()
    if (session.timersFrozenAt || session.status === "finished") return

    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [session?.startTime, session?.timersFrozenAt, session?.status, session?.finishedAt])

  const totalQuestions = game?.questions.length ?? 0
  const rows = useMemo<RowData[]>(() => {
    const players = Object.values(session?.players ?? {})
      .filter((player) => !player.isHost && player.id !== "host" && !player.isKicked)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

    return players.map((player, index) => {
      const answers = Array.isArray(player.answers) ? player.answers : []
      const correctCount = answers.filter((answer: any) => answer.isCorrect).length
      const done = Math.min(player.selfPaced?.currentIndex ?? answers.length, totalQuestions)
      const accuracy = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0

      return {
        player,
        rank: index + 1,
        score: player.score ?? 0,
        done,
        progressPct: totalQuestions > 0 ? Math.round((done / totalQuestions) * 100) : 0,
        correctCount,
        accuracy,
        finished: player.selfPaced?.finished ?? false,
      }
    })
  }, [session?.players, totalQuestions])

  const finishedCount = rows.filter((row) => row.finished).length
  const avgAccuracy = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.accuracy, 0) / rows.length) : 0
  const avgProgress = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.progressPct, 0) / rows.length) : 0
  const isFinished = session?.status === "finished"

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-[1800px] space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold">Прогресс игроков</h1>
              {game?.title && <Badge variant="outline">{game.title}</Badge>}
              {game?.code && <Badge variant="outline">Код: {game.code}</Badge>}
              {isFinished && (
                <Badge variant="outline" className="text-green-600 border-green-500/50">
                  <Flag className="w-3.5 h-3.5 mr-1" /> Завершена
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Экран прогресса для режима «в своём темпе»
            </p>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            <StatCard icon={<Users className="w-4 h-4" />} label="Игроки" value={rows.length} />
            <StatCard icon={<CheckCircle className="w-4 h-4 text-green-500" />} label="Финиш" value={`${finishedCount}/${rows.length}`} />
            <StatCard icon={<Target className="w-4 h-4 text-primary" />} label="Точность" value={`${avgAccuracy}%`} />
            <StatCard icon={<Clock className="w-4 h-4 text-amber-500" />} label="Время" value={formatClock(elapsed)} />
            <StatCard icon={<Trophy className="w-4 h-4 text-yellow-500" />} label="Прогресс" value={`${avgProgress}%`} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Таблица лидеров и прогресса</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                Пока нет игроков
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Место</TableHead>
                    <TableHead>Игрок</TableHead>
                    <TableHead className="w-[280px]">Прогресс</TableHead>
                    <TableHead className="w-[140px]">Верных</TableHead>
                    <TableHead className="w-[140px]">Точность</TableHead>
                    <TableHead className="w-[160px] text-right">Очки</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.player.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {row.rank <= 3 ? <Trophy className="w-4 h-4 text-yellow-500" /> : <span className="w-4" />}
                          <span className="font-semibold">#{row.rank}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarTile avatarId={row.player.avatar} />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{row.player.nickname ?? row.player.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              {row.finished ? (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                  Финишировал
                                </>
                              ) : (
                                "В процессе"
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{row.progressPct}%</span>
                            <span>{row.done}/{totalQuestions}</span>
                          </div>
                          <Progress value={row.progressPct} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{row.correctCount}</TableCell>
                      <TableCell className="font-semibold">{row.accuracy}%</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {row.score.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}
