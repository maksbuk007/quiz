import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import "jspdf-autotable"
import type { Game, GameSession, GameExport, PlayerResult, QuestionResult } from "@/types/game"
import { AVATARS } from "@/components/ui/AvatarSelector"

export class ExportService {
  // Подготовка данных для экспорта
  static prepareExportData(game: Game, session: GameSession): GameExport {
    const players = Object.values(session.players).filter((p) => p.isConnected)
    const sortedPlayers = players.sort((a, b) => b.score - a.score)

    const playerResults: PlayerResult[] = sortedPlayers.map((player, index) => ({
      nickname: player.nickname,
      avatar: AVATARS.find((a) => a.id === player.avatar)?.name || player.avatar,
      finalScore: player.score,
      correctAnswers: player.answers?.filter((a) => a.isCorrect).length || 0,
      totalAnswers: player.answers?.length || 0,
      accuracy: player.answers?.length
        ? Math.round((player.answers.filter((a) => a.isCorrect).length / player.answers.length) * 100)
        : 0,
      averageTime: player.answers?.length
        ? Math.round(player.answers.reduce((sum, a) => sum + a.timeSpent, 0) / player.answers.length / 1000)
        : 0,
      rank: index + 1,
      answers: player.answers || [],
      achievements: player.achievements || [],
    }))

    const questionResults: QuestionResult[] = game.questions.map((question, index) => {
      const answers = players.flatMap((p) => p.answers?.filter((a) => a.questionId === question.id) || [])
      const correctAnswers = answers.filter((a) => a.isCorrect)

      const answerDistribution: Record<string, number> = {}
      if (question.options) {
        question.options.forEach((option, optIndex) => {
          const count = answers.filter((a) => {
            if (Array.isArray(a.selectedOption)) {
              return a.selectedOption.includes(optIndex)
            }
            return a.selectedOption === optIndex
          }).length
          answerDistribution[option] = count
        })
      }

      return {
        question: question.question,
        type: question.type,
        correctAnswer: question.options
          ? (question.correctAnswers as number[]).map((i) => question.options![i]).join(", ")
          : question.correctAnswers.join(", "),
        totalAnswers: answers.length,
        correctCount: correctAnswers.length,
        accuracy: answers.length ? Math.round((correctAnswers.length / answers.length) * 100) : 0,
        averageTime: answers.length
          ? Math.round(answers.reduce((sum, a) => sum + a.timeSpent, 0) / answers.length / 1000)
          : 0,
        answerDistribution,
      }
    })

    const summary = {
      totalPlayers: players.length,
      totalQuestions: game.questions.length,
      averageScore: players.length ? Math.round(players.reduce((sum, p) => sum + p.score, 0) / players.length) : 0,
      averageAccuracy: playerResults.length
        ? Math.round(playerResults.reduce((sum, p) => sum + p.accuracy, 0) / playerResults.length)
        : 0,
      averageTime: playerResults.length
        ? Math.round(playerResults.reduce((sum, p) => sum + p.averageTime, 0) / playerResults.length)
        : 0,
      completionRate: players.length
        ? Math.round((players.filter((p) => p.answers?.length === game.questions.length).length / players.length) * 100)
        : 0,
      topScore: Math.max(...players.map((p) => p.score), 0),
      difficulty: this.calculateDifficulty(questionResults),
    }

    return {
      gameInfo: game,
      session,
      results: {
        players: playerResults,
        questions: questionResults,
        summary,
      },
      timestamp: Date.now(),
      format: "excel",
    }
  }

  // Вычисление сложности игры
  private static calculateDifficulty(questions: QuestionResult[]): string {
    const averageAccuracy = questions.reduce((sum, q) => sum + q.accuracy, 0) / questions.length

    if (averageAccuracy >= 80) return "Легкая"
    if (averageAccuracy >= 60) return "Средняя"
    return "Сложная"
  }

  // Экспорт в Excel
  static async exportToExcel(exportData: GameExport): Promise<void> {
    try {
      const workbook = XLSX.utils.book_new()

      // Лист с результатами игроков
      const playersData = [
        ["Место", "Игрок", "Аватар", "Очки", "Правильных", "Всего", "Точность (%)", "Среднее время (сек)"],
        ...exportData.results.players.map((player) => [
          player.rank,
          player.nickname,
          player.avatar,
          player.finalScore,
          player.correctAnswers,
          player.totalAnswers,
          player.accuracy,
          player.averageTime,
        ]),
      ]

      const playersSheet = XLSX.utils.aoa_to_sheet(playersData)
      XLSX.utils.book_append_sheet(workbook, playersSheet, "Результаты игроков")

      // Лист с результатами по вопросам
      const questionsData = [
        ["№", "Вопрос", "Тип", "Правильный ответ", "Ответили", "Правильно", "Точность (%)", "Среднее время (сек)"],
        ...exportData.results.questions.map((question, index) => [
          index + 1,
          question.question,
          question.type,
          question.correctAnswer,
          question.totalAnswers,
          question.correctCount,
          question.accuracy,
          question.averageTime,
        ]),
      ]

      const questionsSheet = XLSX.utils.aoa_to_sheet(questionsData)
      XLSX.utils.book_append_sheet(workbook, questionsSheet, "Анализ вопросов")

      // Лист с общей статистикой
      const summaryData = [
        ["Параметр", "Значение"],
        ["Название игры", exportData.gameInfo.title],
        ["Код игры", exportData.gameInfo.code],
        ["Дата проведения", new Date(exportData.timestamp).toLocaleString("ru-RU")],
        ["Всего игроков", exportData.results.summary.totalPlayers],
        ["Всего вопросов", exportData.results.summary.totalQuestions],
        ["Средний балл", exportData.results.summary.averageScore],
        ["Средняя точность (%)", exportData.results.summary.averageAccuracy],
        ["Среднее время ответа (сек)", exportData.results.summary.averageTime],
        ["Процент завершивших (%)", exportData.results.summary.completionRate],
        ["Максимальный балл", exportData.results.summary.topScore],
        ["Сложность", exportData.results.summary.difficulty],
      ]

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Общая статистика")

      // Лист с детальными ответами
      const detailedAnswers: any[] = [
        ["Игрок", "Вопрос", "Ответ игрока", "Правильный ответ", "Правильно", "Время (сек)", "Очки"],
      ]

      exportData.results.players.forEach((player) => {
        player.answers.forEach((answer, qIndex) => {
          const question = exportData.gameInfo.questions.find((q) => q.id === answer.questionId)
          if (question) {
            let playerAnswer = ""
            if (Array.isArray(answer.selectedOption)) {
              playerAnswer = answer.selectedOption.map((i) => question.options?.[i] || i).join(", ")
            } else if (typeof answer.selectedOption === "number" && question.options) {
              playerAnswer = question.options[answer.selectedOption] || answer.selectedOption.toString()
            } else {
              playerAnswer = answer.answer?.toString() || ""
            }

            const correctAnswer = question.options
              ? (question.correctAnswers as number[]).map((i) => question.options![i]).join(", ")
              : question.correctAnswers.join(", ")

            detailedAnswers.push([
              player.nickname,
              question.question,
              playerAnswer,
              correctAnswer,
              answer.isCorrect ? "Да" : "Нет",
              Math.round(answer.timeSpent / 1000),
              answer.points,
            ])
          }
        })
      })

      const detailedSheet = XLSX.utils.aoa_to_sheet(detailedAnswers)
      XLSX.utils.book_append_sheet(workbook, detailedSheet, "Детальные ответы")

      // Сохранение файла
      const fileName = `${exportData.gameInfo.title}_${new Date().toISOString().split("T")[0]}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      console.error("Ошибка экспорта в Excel:", error)
      throw new Error("Не удалось экспортировать в Excel")
    }
  }

  // Экспорт в PDF
  static async exportToPDF(exportData: GameExport): Promise<void> {
    try {
      const doc = new jsPDF()

      // Заголовок
      doc.setFontSize(20)
      doc.text("Результаты игры MaxQuiz", 20, 20)

      doc.setFontSize(12)
      doc.text(`Игра: ${exportData.gameInfo.title}`, 20, 35)
      doc.text(`Код: ${exportData.gameInfo.code}`, 20, 45)
      doc.text(`Дата: ${new Date(exportData.timestamp).toLocaleString("ru-RU")}`, 20, 55)

      // Общая статистика
      doc.setFontSize(16)
      doc.text("Общая статистика", 20, 75)

      const summaryData = [
        ["Всего игроков", exportData.results.summary.totalPlayers.toString()],
        ["Всего вопросов", exportData.results.summary.totalQuestions.toString()],
        ["Средний балл", exportData.results.summary.averageScore.toString()],
        ["Средняя точность", `${exportData.results.summary.averageAccuracy}%`],
        ["Среднее время ответа", `${exportData.results.summary.averageTime} сек`],
        ["Процент завершивших", `${exportData.results.summary.completionRate}%`],
        ["Максимальный балл", exportData.results.summary.topScore.toString()],
        ["Сложность", exportData.results.summary.difficulty],
      ]
      ;(doc as any).autoTable({
        startY: 85,
        head: [["Параметр", "Значение"]],
        body: summaryData,
        theme: "grid",
        styles: { fontSize: 10 },
      })

      // Результаты игроков
      doc.addPage()
      doc.setFontSize(16)
      doc.text("Результаты игроков", 20, 20)

      const playersTableData = exportData.results.players.map((player) => [
        player.rank.toString(),
        player.nickname,
        player.finalScore.toString(),
        `${player.correctAnswers}/${player.totalAnswers}`,
        `${player.accuracy}%`,
        `${player.averageTime} сек`,
      ])
      ;(doc as any).autoTable({
        startY: 30,
        head: [["Место", "Игрок", "Очки", "Правильных", "Точность", "Среднее время"]],
        body: playersTableData,
        theme: "striped",
        styles: { fontSize: 9 },
      })

      // Анализ вопросов
      doc.addPage()
      doc.setFontSize(16)
      doc.text("Анализ вопросов", 20, 20)

      const questionsTableData = exportData.results.questions.map((question, index) => [
        (index + 1).toString(),
        question.question.length > 50 ? question.question.substring(0, 50) + "..." : question.question,
        question.totalAnswers.toString(),
        `${question.accuracy}%`,
        `${question.averageTime} сек`,
      ])
      ;(doc as any).autoTable({
        startY: 30,
        head: [["№", "Вопрос", "Ответили", "Точность", "Среднее время"]],
        body: questionsTableData,
        theme: "striped",
        styles: { fontSize: 8 },
        columnStyles: {
          1: { cellWidth: 80 },
        },
      })

      // Сохранение файла
      const fileName = `${exportData.gameInfo.title}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error("Ошибка экспорта в PDF:", error)
      throw new Error("Не удалось экспортировать в PDF")
    }
  }

  // Экспорт в CSV
  static async exportToCSV(exportData: GameExport): Promise<void> {
    try {
      const csvData = [
        ["Место", "Игрок", "Очки", "Правильных", "Всего", "Точность (%)", "Среднее время (сек)"],
        ...exportData.results.players.map((player) => [
          player.rank,
          player.nickname,
          player.finalScore,
          player.correctAnswers,
          player.totalAnswers,
          player.accuracy,
          player.averageTime,
        ]),
      ]

      const csvContent = csvData.map((row) => row.join(",")).join("\n")
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })

      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `${exportData.gameInfo.title}_${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Ошибка экспорта в CSV:", error)
      throw new Error("Не удалось экспортировать в CSV")
    }
  }
}
