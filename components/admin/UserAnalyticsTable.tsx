"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RefreshCw, TrendingUp, Award } from "lucide-react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase/config"

interface UserData {
  id: string
  email: string
  displayName: string
  photoURL?: string
  stats?: {
    gamesPlayed: number
    totalScore: number
    averageScore: number
    bestScore: number
  }
  createdAt: number
}

export default function UserAnalyticsTable() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const usersData: UserData[] = []

      for (const doc of usersSnapshot.docs) {
        const data = doc.data()
        usersData.push({
          id: doc.id,
          email: data.email || "",
          displayName: data.displayName || "Неизвестный",
          photoURL: data.photoURL,
          stats: data.stats || {
            gamesPlayed: 0,
            totalScore: 0,
            averageScore: 0,
            bestScore: 0,
          },
          createdAt: data.createdAt || Date.now(),
        })
      }

      usersData.sort((a, b) => (b.stats?.totalScore || 0) - (a.stats?.totalScore || 0))
      setUsers(usersData)
    } catch (error) {
      console.error("Error loading users:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Все пользователи ({users.length})</h3>
        <Button onClick={loadUsers} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Обновить
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Пользователь</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Игры</TableHead>
              <TableHead className="text-center">Общий счет</TableHead>
              <TableHead className="text-center">Средний счет</TableHead>
              <TableHead className="text-center">Лучший счет</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Нет пользователей
                </TableCell>
              </TableRow>
            ) : (
              users.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.photoURL || "/placeholder.svg"} />
                        <AvatarFallback>{user.displayName[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.displayName}</div>
                        {index < 3 && (
                          <Badge variant="secondary" className="text-xs">
                            <Award className="w-3 h-3 mr-1" />
                            Топ {index + 1}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{user.stats?.gamesPlayed || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">{user.stats?.totalScore || 0}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      {user.stats?.averageScore || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-bold text-primary">{user.stats?.bestScore || 0}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
