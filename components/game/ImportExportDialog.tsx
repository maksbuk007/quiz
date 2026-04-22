"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Download, Upload, FileJson, FileSpreadsheet, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react"
import ImportExportService from "@/lib/services/importExportService"
import type { Game, Question } from "@/types/game"

interface ImportExportDialogProps {
  game?: Game
  questions?: Question[]
  onImportGame?: (gameData: Partial<Game>) => void
  onImportQuestions?: (questions: Question[]) => void
  trigger?: React.ReactNode
}

export default function ImportExportDialog({
  game,
  questions,
  onImportGame,
  onImportQuestions,
  trigger,
}: ImportExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportGameJSON = () => {
    try {
      if (!game) {
        setMessage({ type: "error", text: "Нет данных игры для экспорта" })
        return
      }
      ImportExportService.exportGameToJSON(game)
      setMessage({ type: "success", text: "Игра успешно экспортирована в JSON" })
    } catch (error) {
      setMessage({ type: "error", text: "Ошибка экспорта игры" })
    }
  }

  const handleExportQuestionsCSV = () => {
    try {
      if (!questions || questions.length === 0) {
        setMessage({ type: "error", text: "Нет вопросов для экспорта" })
        return
      }
      ImportExportService.exportQuestionsToCSV(questions, game?.title || "quiz")
      setMessage({ type: "success", text: "Вопросы успешно экспортированы в CSV" })
    } catch (error) {
      setMessage({ type: "error", text: "Ошибка экспорта вопросов" })
    }
  }

  const handleExportTemplate = () => {
    try {
      ImportExportService.exportCSVTemplate()
      setMessage({ type: "success", text: "Шаблон CSV успешно скачан" })
    } catch (error) {
      setMessage({ type: "error", text: "Ошибка скачивания шаблона" })
    }
  }

  const handleExportJSONTemplate = () => {
    try {
      ImportExportService.exportJSONTemplate()
      setMessage({ type: "success", text: "Шаблон JSON успешно скачан" })
    } catch (error) {
      setMessage({ type: "error", text: "Ошибка скачивания шаблона" })
    }
  }

  const handleImportGameJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setMessage(null)

    try {
      const gameData = await ImportExportService.importGameFromJSON(file)
      if (onImportGame) {
        onImportGame(gameData)
        setMessage({ type: "success", text: "Игра успешно импортирована" })
        setTimeout(() => setOpen(false), 1500)
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Ошибка импорта игры" })
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleImportQuestionsCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setMessage(null)

    try {
      const importedQuestions = await ImportExportService.importQuestionsFromCSV(file)
      if (onImportQuestions) {
        onImportQuestions(importedQuestions)
        setMessage({
          type: "success",
          text: `Успешно импортировано вопросов: ${importedQuestions.length}`,
        })
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Ошибка импорта вопросов" })
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Импорт/Экспорт
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Импорт и экспорт данных</DialogTitle>
          <DialogDescription>
            Экспортируйте игры для резервного копирования или импортируйте существующие игры
          </DialogDescription>
        </DialogHeader>

        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">
              <Download className="w-4 h-4 mr-2" />
              Экспорт
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="w-4 h-4 mr-2" />
              Импорт
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileJson className="w-5 h-5 mt-0.5 text-blue-500" />
                  <div className="flex-1">
                    <h4 className="font-medium">Экспорт игры в JSON</h4>
                    <p className="text-sm text-muted-foreground">
                      Экспортируйте всю игру (вопросы, настройки, категории) в JSON формат
                    </p>
                  </div>
                  <Button onClick={handleExportGameJSON} disabled={!game} size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Скачать JSON
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 mt-0.5 text-green-500" />
                  <div className="flex-1">
                    <h4 className="font-medium">Экспорт вопросов в CSV</h4>
                    <p className="text-sm text-muted-foreground">
                      Экспортируйте только вопросы в CSV формат для редактирования в Excel
                    </p>
                  </div>
                  <Button onClick={handleExportQuestionsCSV} disabled={!questions || questions.length === 0} size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Скачать CSV
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 mt-0.5 text-blue-500" />
                  <div className="flex-1">
                    <h4 className="font-medium">Скачать шаблон JSON</h4>
                    <p className="text-sm text-muted-foreground">
                      Скачайте шаблон JSON с примерами вопросов для импорта
                    </p>
                  </div>
                  <Button onClick={handleExportJSONTemplate} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Скачать шаблон
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 mt-0.5 text-purple-500" />
                  <div className="flex-1">
                    <h4 className="font-medium">Скачать шаблон CSV</h4>
                    <p className="text-sm text-muted-foreground">
                      Скачайте шаблон CSV с примерами вопросов для импорта
                    </p>
                  </div>
                  <Button onClick={handleExportTemplate} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Скачать шаблон
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileJson className="w-5 h-5 mt-0.5 text-blue-500" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-medium">Импорт игры из JSON</h4>
                      <p className="text-sm text-muted-foreground">
                        Импортируйте ранее экспортированную игру из JSON файла
                      </p>
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImportGameJSON}
                        className="hidden"
                        id="import-game-json"
                      />
                      <Label htmlFor="import-game-json" className="cursor-pointer">
                        <Button asChild variant="outline" disabled={importing || !onImportGame} size="sm">
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            {importing ? "Импорт..." : "Выбрать JSON файл"}
                          </span>
                        </Button>
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 mt-0.5 text-green-500" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-medium">Импорт вопросов из CSV</h4>
                      <p className="text-sm text-muted-foreground">
                        Импортируйте вопросы из CSV файла (например, созданного в Excel)
                      </p>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleImportQuestionsCSV}
                        className="hidden"
                        id="import-questions-csv"
                      />
                      <Label htmlFor="import-questions-csv" className="cursor-pointer">
                        <Button asChild variant="outline" disabled={importing || !onImportQuestions} size="sm">
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            {importing ? "Импорт..." : "Выбрать CSV файл"}
                          </span>
                        </Button>
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Формат CSV:</strong>
                  <br />
                  Тип, Вопрос, Варианты ответов (через |), Правильные ответы (через |), Время (сек), Баллы, Объяснение
                  <br />
                  <br />
                  <strong>Типы вопросов:</strong> MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE, TEXT_INPUT
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
