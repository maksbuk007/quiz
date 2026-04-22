"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db } from "@/lib/firebase/config"
import { collection, getDocs, updateDoc, doc } from "firebase/firestore"
import { Search, Shield, User, Crown, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface UserWithRole {
  id: string
  email: string
  displayName?: string
  role: "creator" | "admin" | "user"
  createdAt?: number
}

export default function RoleManagementPanel() {
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const usersRef = collection(db, "users")
      const snapshot = await getDocs(usersRef)

      const loadedUsers: UserWithRole[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        loadedUsers.push({
          id: doc.id,
          email: data.email || "",
          displayName: data.displayName,
          role: data.role || "user",
          createdAt: data.createdAt,
        })
      })

      // Sort by role priority (creator > admin > user) and then by email
      loadedUsers.sort((a, b) => {
        const roleOrder = { creator: 0, admin: 1, user: 2 }
        if (roleOrder[a.role] !== roleOrder[b.role]) {
          return roleOrder[a.role] - roleOrder[b.role]
        }
        return a.email.localeCompare(b.email)
      })

      setUsers(loadedUsers)
    } catch (error) {
      console.error("Error loading users:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список пользователей",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: "admin" | "user") => {
    setUpdatingUserId(userId)
    try {
      const userRef = doc(db, "users", userId)
      await updateDoc(userRef, { role: newRole })

      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))

      toast({
        title: "Роль обновлена",
        description: `Роль пользователя успешно изменена на ${newRole === "admin" ? "Администратор" : "Пользователь"}`,
      })
    } catch (error) {
      console.error("Error updating role:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось обновить роль пользователя",
        variant: "destructive",
      })
    } finally {
      setUpdatingUserId(null)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "creator":
        return <Crown className="w-4 h-4" />
      case "admin":
        return <Shield className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "creator":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Crown className="w-3 h-3 mr-1" />
            Создатель
          </Badge>
        )
      case "admin":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Shield className="w-3 h-3 mr-1" />
            Администратор
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <User className="w-3 h-3 mr-1" />
            Пользователь
          </Badge>
        )
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Управление ролями пользователей
        </CardTitle>
        <CardDescription>
          Назначайте роли администраторов и управляйте правами доступа пользователей платформы
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Поиск пользователей по email или имени..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Загрузка пользователей...</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? "Пользователи не найдены" : "Нет зарегистрированных пользователей"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-shrink-0">{getRoleIcon(user.role)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{user.displayName || "Без имени"}</p>
                      {getRoleBadge(user.role)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>

                {user.role !== "creator" && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role}
                      onValueChange={(newRole: "admin" | "user") => updateUserRole(user.id, newRole)}
                      disabled={updatingUserId === user.id}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Администратор
                          </div>
                        </SelectItem>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Пользователь
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {updatingUserId === user.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                )}
                {user.role === "creator" && (
                  <Badge variant="outline" className="border-yellow-500/20">
                    Создатель платформы
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
