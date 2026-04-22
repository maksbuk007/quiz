"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { sendEmailVerification, applyActionCode, checkActionCode, reload } from "firebase/auth"
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

interface EmailVerificationProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
}

export default function EmailVerification({ isOpen, onClose, onVerified }: EmailVerificationProps) {
  const { user } = useAuth()
  const [verificationCode, setVerificationCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleResendEmail = async () => {
    if (!user || resendCooldown > 0) return

    setLoading(true)
    setError("")

    try {
      await sendEmailVerification(user)
      setSuccess("Письмо с подтверждением отправлено повторно")
      setResendCooldown(60) // 60 секунд кулдаун
    } catch (error: any) {
      console.error("Ошибка отправки письма:", error)
      setError("Ошибка при отправке письма. Попробуйте позже.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || !user) {
      setError("Введите код подтверждения")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Проверяем код подтверждения
      await checkActionCode(user.auth, verificationCode)
      await applyActionCode(user.auth, verificationCode)

      // Перезагружаем пользователя, чтобы обновить статус верификации
      await reload(user)

      setSuccess("Email успешно подтвержден!")
      setTimeout(() => {
        onVerified()
        onClose()
      }, 2000)
    } catch (error: any) {
      console.error("Ошибка подтверждения:", error)
      setError("Неверный код подтверждения или код истек")
    } finally {
      setLoading(false)
    }
  }

  const handleManualCheck = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Перезагружаем пользователя, чтобы обновить статус верификации
      await reload(user)

      if (user.emailVerified) {
        setSuccess("Email подтвержден!")
        setTimeout(() => {
          onVerified()
          onClose()
        }, 1000)
      } else {
        setError("Email еще не подтвержден. Проверьте почту.")
      }
    } catch (error) {
      setError("Ошибка при проверке статуса")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mobile-modal">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Mail className="w-5 h-5" />
            Подтверждение Email
          </CardTitle>
          <CardDescription className="text-center">
            Мы отправили письмо с подтверждением на {user.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Проверьте почту и перейдите по ссылке в письме, или введите код подтверждения ниже
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verification-code">Код подтверждения (опционально)</Label>
            <Input
              id="verification-code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Введите код из письма"
              disabled={loading}
              autoComplete="one-time-code"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}

          <div className="space-y-2">
            {verificationCode && (
              <Button onClick={handleVerifyCode} className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  "Подтвердить код"
                )}
              </Button>
            )}

            <Button onClick={handleManualCheck} variant="outline" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                "Я перешел по ссылке"
              )}
            </Button>

            <Button
              onClick={handleResendEmail}
              variant="ghost"
              className="w-full"
              disabled={loading || resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Отправить повторно (${resendCooldown}с)` : "Отправить письмо повторно"}
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Позже
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
