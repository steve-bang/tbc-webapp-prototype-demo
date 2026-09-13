import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { DEMO_ACCOUNTS, findDemoAccount } from '../model'
import { useSessionStore } from '../store'

export function LoginScreen() {
  const navigate = useNavigate()
  const login = useSessionStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handlePickAccount(u: string, p: string) {
    setUsername(u)
    setPassword(p)
    setError(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const account = findDemoAccount(username, password)
    if (!account) {
      setError(vi.auth.loginError)
      return
    }
    login({
      userId: account.userId,
      username: account.username,
      fullName: account.fullName,
      role: account.role,
    })
    toast.success(`Xin chào ${account.fullName}`)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <Card className="justify-center">
          <CardHeader>
            <CardTitle className="text-xl">{vi.auth.loginTitle}</CardTitle>
            <CardDescription>{vi.auth.loginSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">{vi.auth.username}</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder={vi.auth.usernamePlaceholder}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{vi.auth.password}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" className="mt-2">
                {vi.auth.loginButton}
              </Button>
              <p className="text-muted-foreground text-xs">{vi.auth.noOtpNote}</p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{vi.auth.demoAccountsTitle}</CardTitle>
            <CardDescription>Mỗi vai trò một tài khoản — dùng để demo phân quyền khác nhau.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.userId}
                type="button"
                onClick={() => handlePickAccount(account.username, account.password)}
                className="hover:bg-accent hover:text-accent-foreground flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{account.fullName}</span>
                  <span className="text-muted-foreground text-xs">
                    {account.username} / {account.password}
                  </span>
                </span>
                <span className="bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-xs">
                  {ROLE_LABELS[account.role]}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
