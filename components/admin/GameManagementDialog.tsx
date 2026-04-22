"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MoreVertical, Trash2, Plus, X, Tag } from "lucide-react"
import type { Game, GamePermission } from "@/types/game"
import GameSessionsPanel from "@/components/admin/GameSessionsPanel"

interface GameManagementDialogProps {
  game: Game
  isCreator: boolean
  onDelete: (gameId: string) => void
  onShare: (gameId: string, email: string, permission: GamePermission) => void
  onRevokeAccess: (gameId: string, email: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function GameManagementDialog({
  game,
  isCreator,
  onDelete,
  onShare,
  onRevokeAccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: GameManagementDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [shareEmail, setShareEmail] = useState("")
  const [shareRole, setShareRole] = useState<"view" | "edit" | "host" | "admin">("view")
  const [canViewAnalytics, setCanViewAnalytics] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const open = controlledOpen !== undefined ? controlledOpen : isOpen
  const handleOpenChange = (newOpen: boolean) => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(newOpen)
    } else {
      setIsOpen(newOpen)
    }
  }

  const handleShare = () => {
    if (shareEmail.trim()) {
      const permission: GamePermission = {
        email: shareEmail,
        role: shareRole,
        createdAt: Date.now(),
      }

      // Добавляем опциональные поля только если они имеют значения
      if (canViewAnalytics) {
        permission.canViewAnalytics = true
      }

      if (selectedTags.length > 0) {
        permission.tagFilter = selectedTags
      }

      onShare(game.id, shareEmail, permission)
      setShareEmail("")
      setShareRole("view")
      setCanViewAnalytics(false)
      setSelectedTags([])
    }
  }

  const addTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()])
      setNewTag("")
    }
  }

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 bg-transparent">
            <MoreVertical className="w-4 h-4" />
            Управление
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Управление игрой: {game.title}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sessions" className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="sessions">Сессии</TabsTrigger>
            <TabsTrigger value="access">Доступ</TabsTrigger>
            {isCreator && <TabsTrigger value="danger">Удалить</TabsTrigger>}
          </TabsList>

          <TabsContent value="sessions" className="flex-1 overflow-y-auto mt-4 pr-2">
            <GameSessionsPanel game={game} />
          </TabsContent>

          <TabsContent value="access" className="space-y-4 overflow-y-auto mt-4 pr-2">
            <Card className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Предоставить доступ</Label>
                <p className="text-sm text-muted-foreground">Настройте детальные права доступа для пользователей</p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="shareEmail">Email пользователя</Label>
                  <Input
                    id="shareEmail"
                    placeholder="user@example.com"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="shareRole">Уровень доступа</Label>
                  <select
                    id="shareRole"
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value as any)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm mt-1"
                  >
                    <option value="view">Просмотр - только читать игру</option>
                    <option value="edit">Редактирование - изменять вопросы</option>
                    <option value="host">Проведение - запускать игры</option>
                    <option value="admin">Администратор - полный доступ</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="space-y-0.5">
                    <Label htmlFor="analytics" className="text-sm font-medium">
                      Доступ к аналитике
                    </Label>
                    <p className="text-xs text-muted-foreground">Просмотр статистики и результатов сессий</p>
                  </div>
                  <Switch id="analytics" checked={canViewAnalytics} onCheckedChange={setCanViewAnalytics} />
                </div>

                <div className="space-y-2">
                  <Label>Фильтр по тегам (опционально)</Label>
                  <p className="text-xs text-muted-foreground">Пользователь увидит только игры с этими тегами</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Добавить тег"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && addTag()}
                    />
                    <Button type="button" onClick={addTag} size="sm" variant="outline">
                      <Tag className="w-4 h-4" />
                    </Button>
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="ml-1">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={handleShare} className="w-full gap-1">
                  <Plus className="w-4 h-4" />
                  Предоставить доступ
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <Label className="text-base font-semibold mb-3 block">Текущие права доступа</Label>
              {game.sharedWith && Object.keys(game.sharedWith).length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(game.sharedWith).map(([key, access]) => (
                    <Card key={key} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{access.email}</p>
                            <Badge variant="outline" className="text-xs">
                              {access.role === "view" && "Просмотр"}
                              {access.role === "edit" && "Редактирование"}
                              {access.role === "host" && "Проведение"}
                              {access.role === "admin" && "Администратор"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {access.canViewAnalytics && (
                              <Badge variant="secondary" className="text-xs">
                                Аналитика
                              </Badge>
                            )}
                            {access.tagFilter && access.tagFilter.length > 0 && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Tag className="w-3 h-3" />
                                Фильтр: {access.tagFilter.join(", ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRevokeAccess(game.id, access.email)}
                          className="flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Доступ не предоставлен другим пользователям</p>
              )}
            </Card>
          </TabsContent>

          {isCreator && (
            <TabsContent value="danger" className="space-y-3 mt-4">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive mb-3">
                  Удаление игры необратимо. Это действие нельзя отменить.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => {
                    onDelete(game.id)
                    setIsOpen(false)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить игру
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default GameManagementDialog
