import type { Game, Question } from "@/types/game"

class ImportExportService {
  static cleanObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => ImportExportService.cleanObject(item))
    }

    if (typeof obj !== "object") {
      return obj
    }

    const cleaned: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key]
        if (value !== undefined && value !== null) {
          cleaned[key] = ImportExportService.cleanObject(value)
        }
      }
    }
    return cleaned
  }

  static exportGameToJSON(game: Game): void {
    const exportData = {
      title: game.title,
      description: game.description,
      categories: game.categories,
      questions: game.questions.map((q) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        options: q.options,
        correctAnswers: q.correctAnswers,
        points: q.points,
        timeLimit: q.timeLimit,
        explanation: q.explanation,
        imageUrl: q.imageUrl,
      })),
      settings: game.settings,
    }

    const content = JSON.stringify(exportData, null, 2)
    const filename = `${game.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, "_")}_${Date.now()}.json`
    this.downloadFile(content, filename, "application/json")
  }

  static exportQuestionsToCSV(questions: Question[], title = "quiz"): void {
    const headers = [
      "Тип",
      "Вопрос",
      "Варианты (через |)",
      "Правильные ответы (через |)",
      "Время (сек)",
      "Баллы",
      "Объяснение",
      "URL изображения",
    ]

    const rows = questions.map((q) => {
      const options = q.options ? q.options.join("|") : ""
      const correctAnswers = Array.isArray(q.correctAnswers) ? q.correctAnswers.join("|") : q.correctAnswers.toString()

      return [
        q.type,
        `"${q.question.replace(/"/g, '""')}"`,
        `"${options}"`,
        `"${correctAnswers}"`,
        q.timeLimit,
        q.points,
        `"${(q.explanation || "").replace(/"/g, '""')}"`,
        q.imageUrl || "",
      ].join(",")
    })

    const content = [headers.join(","), ...rows].join("\n")
    const filename = `${title.replace(/[^a-zA-Zа-яА-Я0-9]/g, "_")}_questions_${Date.now()}.csv`
    this.downloadFile(content, filename, "text/csv;charset=utf-8")
  }

  static exportCSVTemplate(): void {
    const headers = [
      "Тип",
      "Вопрос",
      "Варианты (через |)",
      "Правильные ответы (через |)",
      "Время (сек)",
      "Баллы",
      "Объяснение",
      "URL изображения",
    ]

    const examples = [
      [
        "MULTIPLE_CHOICE",
        '"Какая столица России?"',
        '"Москва|Санкт-Петербург|Казань|Сочи"',
        '"0"',
        "30",
        "100",
        '"Москва является столицей России с 1918 года"',
        "",
      ].join(","),
      [
        "MULTIPLE_SELECT",
        '"Выберите все четные числа"',
        '"2|3|4|5|6"',
        '"0|2|4"',
        "45",
        "150",
        '"Четные числа делятся на 2 без остатка"',
        "",
      ].join(","),
      [
        "TRUE_FALSE",
        '"Земля плоская?"',
        '"Да|Нет"',
        '"1"',
        "20",
        "50",
        '"Земля имеет форму геоида, близкую к сфере"',
        "",
      ].join(","),
      [
        "TEXT_INPUT",
        '"Введите название столицы Франции"',
        '""',
        '"Париж|париж|Paris|paris"',
        "30",
        "100",
        '"Париж - столица и крупнейший город Франции"',
        "",
      ].join(","),
    ]

    const content = [headers.join(","), ...examples].join("\n")
    this.downloadFile(content, `quiz_template_${Date.now()}.csv`, "text/csv;charset=utf-8")
  }

  static exportJSONTemplate(): void {
    const templateData = {
      title: "Название игры",
      description: "Описание игры",
      categories: ["Категория 1", "Категория 2"],
      questions: [
        {
          id: "q_example_1",
          question: "Какая столица России?",
          type: "MULTIPLE_CHOICE",
          options: ["Москва", "Санкт-Петербург", "Казань", "Сочи"],
          correctAnswers: [0],
          points: 100,
          timeLimit: 30,
          explanation: "Москва является столицей России с 1918 года",
          imageUrl: "",
        },
        {
          id: "q_example_2",
          question: "Выберите все четные числа",
          type: "MULTIPLE_SELECT",
          options: ["2", "3", "4", "5", "6"],
          correctAnswers: [0, 2, 4],
          points: 150,
          timeLimit: 45,
          explanation: "Четные числа делятся на 2 без остатка",
          imageUrl: "",
        },
        {
          id: "q_example_3",
          question: "Земля плоская?",
          type: "TRUE_FALSE",
          options: ["Да", "Нет"],
          correctAnswers: [1],
          points: 50,
          timeLimit: 20,
          explanation: "Земля имеет форму геоида, близкую к сфере",
          imageUrl: "",
        },
        {
          id: "q_example_4",
          question: "Введите название столицы Франции",
          type: "TEXT_INPUT",
          options: [],
          correctAnswers: ["Париж", "париж", "Paris", "paris"],
          points: 100,
          timeLimit: 30,
          explanation: "Париж - столица и крупнейший город Франции",
          imageUrl: "",
        },
      ],
      settings: {
        enableChat: true,
        allowPlayerKick: true,
        showLeaderboardAfterQuestion: true,
        randomizeQuestions: false,
      },
    }

    const content = JSON.stringify(templateData, null, 2)
    this.downloadFile(content, `quiz_template_${Date.now()}.json`, "application/json")
  }

  static async importGameFromJSON(file: File): Promise<Partial<Game>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const data = JSON.parse(content)

          // Валидация базовых полей
          if (!data.title || typeof data.title !== "string") {
            throw new Error("Отсутствует или некорректно поле 'title'")
          }

          if (!Array.isArray(data.questions) || data.questions.length === 0) {
            throw new Error("Отсутствует или пустой массив 'questions'")
          }

          // Валидация вопросов
          const questions: Question[] = data.questions.map((q: any, index: number) => {
            if (!q.question || typeof q.question !== "string") {
              throw new Error(`Вопрос ${index + 1}: отсутствует текст вопроса`)
            }

            if (!["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "TEXT_INPUT"].includes(q.type)) {
              throw new Error(`Вопрос ${index + 1}: некорректный тип вопроса '${q.type}'`)
            }

            if (!q.correctAnswers || (Array.isArray(q.correctAnswers) && q.correctAnswers.length === 0)) {
              throw new Error(`Вопрос ${index + 1}: отсутствуют правильные ответы`)
            }

            return {
              id: q.id || `q_${Date.now()}_${index}`,
              question: q.question,
              type: q.type,
              options: q.options || [],
              correctAnswers: q.correctAnswers,
              points: typeof q.points === "number" ? q.points : 100,
              timeLimit: typeof q.timeLimit === "number" ? q.timeLimit : 30,
              explanation: q.explanation || "",
              imageUrl: q.imageUrl || "",
            }
          })

          const gameData: Partial<Game> = {
            title: data.title,
            description: data.description || "",
            categories: Array.isArray(data.categories) ? data.categories : [],
            questions,
            settings: data.settings || {
              enableChat: true,
              allowPlayerKick: true,
              showLeaderboardAfterQuestion: true,
              randomizeQuestions: false,
            },
          }

          resolve(gameData)
        } catch (error: any) {
          reject(new Error(`Ошибка импорта JSON: ${error.message}`))
        }
      }

      reader.onerror = () => {
        reject(new Error("Ошибка чтения файла"))
      }

      reader.readAsText(file)
    })
  }

  static async importQuestionsFromCSV(file: File): Promise<Question[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const lines = content.trim().split("\n")

          if (lines.length < 2) {
            throw new Error("CSV файл пустой или содержит только заголовки")
          }

          // Пропускаем заголовок
          const dataLines = lines.slice(1)

          const questions: Question[] = dataLines
            .map((line, index) => {
              // Пропускаем пустые строки
              if (!line.trim()) return null

              // Парсинг CSV с учетом кавычек
              const values = this.parseCSVLine(line)

              if (values.length < 6) {
                throw new Error(
                  `Строка ${index + 2}: недостаточно данных (ожидается минимум 6 столбцов: тип, вопрос, варианты, правильные ответы, время, баллы)`,
                )
              }

              const [
                type,
                questionText,
                optionsStr,
                correctAnswersStr,
                timeLimitStr,
                pointsStr,
                explanation,
                imageUrl,
              ] = values

              // Валидация типа вопроса
              if (!["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "TEXT_INPUT"].includes(type)) {
                throw new Error(`Строка ${index + 2}: некорректный тип вопроса '${type}'`)
              }

              // Парсинг вариантов ответов
              const options = optionsStr
                ? optionsStr
                    .split("|")
                    .map((o) => o.trim())
                    .filter(Boolean)
                : []

              // Парсинг правильных ответов
              let correctAnswers: string[] | number[]
              if (type === "TEXT_INPUT") {
                correctAnswers = correctAnswersStr
                  .split("|")
                  .map((a) => a.trim())
                  .filter(Boolean)
              } else {
                correctAnswers = correctAnswersStr.split("|").map((a) => {
                  const num = Number.parseInt(a.trim())
                  if (isNaN(num)) {
                    throw new Error(`Строка ${index + 2}: некорректный индекс правильного ответа '${a}'`)
                  }
                  return num
                })
              }

              // Парсинг баллов и времени
              const timeLimit = Number.parseInt(timeLimitStr)
              const points = Number.parseInt(pointsStr)

              if (isNaN(timeLimit) || timeLimit <= 0) {
                throw new Error(`Строка ${index + 2}: некорректное значение времени '${timeLimitStr}'`)
              }

              if (isNaN(points) || points <= 0) {
                throw new Error(`Строка ${index + 2}: некорректное значение баллов '${pointsStr}'`)
              }

              return {
                id: `q_${Date.now()}_${index}`,
                question: questionText,
                type: type as "MULTIPLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE" | "TEXT_INPUT",
                options,
                correctAnswers,
                points,
                timeLimit,
                explanation: explanation || "",
                imageUrl: imageUrl || "",
              }
            })
            .filter((q): q is Question => q !== null)

          if (questions.length === 0) {
            throw new Error("Не удалось импортировать ни одного вопроса")
          }

          resolve(questions)
        } catch (error: any) {
          reject(new Error(`Ошибка импорта CSV: ${error.message}`))
        }
      }

      reader.onerror = () => {
        reject(new Error("Ошибка чтения файла"))
      }

      reader.readAsText(file)
    })
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Экранированная кавычка
          current += '"'
          i++ // Пропускаем следующую кавычку
        } else {
          // Начало или конец quoted значения
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        // Разделитель вне кавычек
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }

    // Добавляем последнее значение
    result.push(current.trim())

    return result
  }

  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export default ImportExportService
