"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/firebase/config"
import { applyActionCode, checkActionCode } from "firebase/auth"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const verifyEmail = async () => {
      const actionCode = searchParams.get("oobCode")

      if (!actionCode) {
        setStatus("error")
        setMessage("Неверная ссылка подтверждения")
        return
      }

      try {
        // Проверяем код
        await checkActionCode(auth, actionCode)

        // Применяем код подтверждения
        await applyActionCode(auth, actionCode)

        // Обновляем данные пользователя в контексте
        await refreshUser()

        setStatus("success")
        setMessage("Email успешно подтвержден! Теперь вы можете войти в аккаунт.")
      } catch (error: any) {
        console.error("Ошибка подтверждения email:", error)
        setStatus("error")

        switch (error.code) {
          case "auth/expired-action-code":
            setMessage("Ссылка подтверждения истекла. Запросите новую ссылку.")
            break
          case "auth/invalid-action-code":
            setMessage("Неверная ссылка подтверждения.")
            break
          case "auth/user-disabled":
            setMessage("Аккаунт заблокирован.")
            break
          default:
            setMessage("Ошибка при подтверждении email. Попробуйте еще раз.")
        }
      }
    }

    verifyEmail()
  }, [searchParams, refreshUser])

  const handleGoHome = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            {status === "loading" && <Loader2 className="w-5 h-5 animate-spin" />}
            {status === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
            {status === "error" && <AlertCircle className="w-5 h-5 text-destructive" />}
            Подтверждение Email
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>

          {status !== "loading" && (
            <div className="space-y-2">
              <Button onClick={handleGoHome} className="w-full">
                На главную
              </Button>
              {status === "success" && (
                <p className="text-sm text-green-600">Вы можете закрыть эту вкладку и вернуться к сайту</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
