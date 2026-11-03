import { Clock, Home, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function RateLimited() {
  const [countdown, setCountdown] = useState(60)
  const [canRetry, setCanRetry] = useState(false)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanRetry(true)
    }
  }, [countdown])

  const handleRetry = () => {
    // Go back to previous page or dashboard
    const referrer = document.referrer
    if (referrer?.includes(window.location.origin)) {
      window.location.href = referrer
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Floating yoga illustration */}
        <div className="mb-8">
          <img
            src="/images/yoga.png"
            alt="冥想插图"
            className="w-64 h-64 mx-auto animate-float"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>

        <h1 className="text-5xl font-bold mb-4">
          <span className="text-orange-500">429</span> - 请求过于频繁
        </h1>

        <p className="text-xl text-muted-foreground mb-6">
          短时间内请求次数过多，请稍后重试。
        </p>

        {/* Rate Limit Info */}
        <Alert variant="warning" className="mb-8 text-left">
          <Clock className="h-5 w-5" />
          <AlertTitle>超过速率限制</AlertTitle>
          <AlertDescription>
            为保障公平使用和系统稳定，系统会限制请求频率。
            <br />
            <br />
            <strong>常见限制：</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>登录：每分钟 5 次</li>
              <li>委托：每秒 10 次</li>
              <li>API 调用：每秒 50 次</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Countdown Timer */}
        <div className="mb-8">
          {!canRetry ? (
            <div className="text-center">
              <div className="text-4xl font-mono font-bold text-orange-500 mb-2">{countdown}s</div>
              <p className="text-muted-foreground">请稍等后重试</p>
            </div>
          ) : (
            <p className="text-green-600 dark:text-green-400 font-medium">现在可以重试！</p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <Button
            variant={canRetry ? 'default' : 'outline'}
            onClick={handleRetry}
            disabled={!canRetry}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${!canRetry ? 'animate-spin' : ''}`} />
            {canRetry ? '立即重试' : '请稍候...'}
          </Button>

          <Button variant="outline" asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              返回首页
            </Link>
          </Button>
        </div>

        {/* Tips */}
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">
            <strong>避免触发速率限制的建议：</strong>
          </p>
          <ul className="list-disc list-inside text-left space-y-1">
            <li>拉开 API 请求间隔</li>
            <li>优先使用可用的批量接口</li>
            <li>适当缓存响应</li>
          </ul>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
