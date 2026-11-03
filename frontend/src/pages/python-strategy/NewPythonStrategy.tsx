import { ArrowLeft, Clock, FileCode, Info, Upload } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { pythonStrategyApi } from '@/api/python-strategy'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStrategyExchanges } from '@/hooks/useStrategyExchanges'
import { CRYPTO_EXCHANGE_VALUE, SCHEDULE_DAYS } from '@/types/python-strategy'
import { showToast } from '@/utils/toast'
import { ALL_DAY_START, ALL_DAYS, RunAllDaySwitch } from './RunAllDaySwitch'

const EXAMPLE_STRATEGY = `"""
Example OpenAlgo Strategy
This is a minimal example showing how to use the OpenAlgo Python SDK.
"""

import os
import time
from openalgo import api

# Get API key from environment variable
API_KEY = os.getenv('OPENALGO_API_KEY')

# Initialize the API client
client = api(
    api_key=API_KEY,
    host_url="http://127.0.0.1:5000"
)

def main():
    """Main strategy logic"""
    print("Strategy started")

    # Example: Get account funds
    funds = client.funds()
    print(f"Available funds: {funds}")

    # Your trading logic here
    while True:
        # Check market conditions
        # Place orders based on your strategy
        # ...

        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    main()
`

export default function NewPythonStrategy() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [showExample, setShowExample] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Exchange drives the holiday/session calendar
  const [exchange, setExchange] = useState<string>('NSE')

  // Schedule fields with defaults (Mon-Fri, 9:00 AM - 4:00 PM IST)
  const [startTime, setStartTime] = useState('09:00')
  const [stopTime, setStopTime] = useState('16:00')
  const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri'])
  // A crypto strategy runs around the clock unless the trader says otherwise.
  const [runAllDay, setRunAllDay] = useState(true)

  const { exchanges, defaultExchange, getWindow, isLoading } = useStrategyExchanges()
  const isCrypto = exchange === CRYPTO_EXCHANGE_VALUE
  const allDay = isCrypto && runAllDay

  // When exchange changes, prefill the schedule with that exchange's session
  // window from the market calendar DB. Never hardcode a window here: a stale
  // constant would silently cut a strategy short (an NFO script stopped at
  // 15:30 misses the last ten minutes of the F&O session, which runs to 15:40).
  const applyExchange = (value: string) => {
    setExchange(value)
    const session = getWindow(value)
    if (session) {
      setStartTime(session.start)
      setStopTime(session.stop)
    }
    setSelectedDays(
      value === CRYPTO_EXCHANGE_VALUE
        ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        : ['mon', 'tue', 'wed', 'thu', 'fri']
    )
  }

  // The dropdown offers only what the broker trades, so start on the broker's
  // own default: CRYPTO on a crypto broker, where NSE would pause the strategy
  // on every NSE holiday. Once the trader picks one, their choice stands.
  //
  // A layout effect, so the move lands in the same commit as the list. With a
  // plain effect there was one commit where the dropdown, having lost NSE as an
  // option, already read CRYPTO while the form was still on NSE with no Run
  // 24/7 switch; a test caught that moment in CI.
  const exchangeChosen = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: applied once, when the list arrives
  useLayoutEffect(() => {
    if (isLoading || exchangeChosen.current) return
    if (defaultExchange !== exchange) applyExchange(defaultExchange)
  }, [isLoading, defaultExchange])

  const handleExchangeChange = (value: string) => {
    exchangeChosen.current = true
    applyExchange(value)
  }

  const handleDayToggle = (day: string) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = '请输入策略名称'
    } else if (name.length < 3 || name.length > 50) {
      newErrors.name = '名称长度须为 3 至 50 个字符'
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      newErrors.name = '名称只能包含英文字母、数字、空格、连字符和下划线'
    }

    if (!file) {
      newErrors.file = '请选择 Python 文件'
    } else if (!file.name.endsWith('.py')) {
      newErrors.file = '文件必须是 Python 文件（.py）'
    }

    // Schedule validation. A 24/7 strategy has no times or days to check.
    if (!allDay) {
      if (!startTime) {
        newErrors.startTime = '请选择开始时间'
      }
      if (!stopTime) {
        newErrors.stopTime = '请选择停止时间'
      } else if (isCrypto && stopTime === startTime) {
        // Crypto only: Indian exchange schedules are validated as before.
        newErrors.stopTime =
          '停止时间不能与开始时间相同。若要持续运行，请开启全天候运行。'
      }
      if (selectedDays.length === 0) {
        newErrors.days = '请至少选择一天'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file extension
      if (!selectedFile.name.endsWith('.py')) {
        showToast.error('请选择 Python 文件（.py）', 'pythonStrategy')
        return
      }
      // Validate file size (max 1MB for Python scripts)
      const maxSizeBytes = 1024 * 1024 // 1MB
      if (selectedFile.size > maxSizeBytes) {
        showToast.error('文件大小须小于 1 MB', 'pythonStrategy')
        return
      }
      setFile(selectedFile)
      // Auto-fill name from file name if empty
      if (!name) {
        const baseName = selectedFile.name.replace('.py', '').replace(/_/g, ' ')
        setName(baseName.charAt(0).toUpperCase() + baseName.slice(1))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      showToast.error('请先修正表单错误', 'pythonStrategy')
      return
    }

    try {
      setLoading(true)
      // Upload strategy with schedule (schedule is mandatory)
      const response = await pythonStrategyApi.uploadStrategy(name, file!, {
        start_time: allDay ? ALL_DAY_START : startTime,
        stop_time: allDay ? null : stopTime,
        days: allDay ? ALL_DAYS : selectedDays,
        exchange,
      })

      if (response.status === 'success') {
        showToast.success('策略和定时设置已上传', 'pythonStrategy')
        navigate('/python')
      } else {
        showToast.error(response.message || '上传策略失败', 'pythonStrategy')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '上传策略失败'
      showToast.error(errorMessage, 'pythonStrategy')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/python">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回 Python 策略
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">添加 Python 策略</h1>
        <p className="text-muted-foreground">
          上传 Python 脚本作为自动交易策略运行
        </p>
      </div>

      {/* Requirements Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Python 脚本应使用 <code className="bg-muted px-1 rounded">openalgo</code>{' '}
          SDK。安装命令： <code className="bg-muted px-1 rounded">pip install openalgo</code>
        </AlertDescription>
      </Alert>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传策略
          </CardTitle>
          <CardDescription>选择 Python 脚本文件并命名</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Strategy Name */}
            <div className="space-y-2">
              <Label htmlFor="name">策略名称</Label>
              <Input
                id="name"
                placeholder="例如：My Trading Strategy（仅限英文字母等）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              <p className="text-xs text-muted-foreground">为策略取一个便于识别的名称</p>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">Python 脚本</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors ${
                  errors.file ? 'border-red-500' : ''
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept=".py"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileCode className="h-8 w-8 text-green-500" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      点击选择 Python 文件（.py）
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">文件大小上限：1 MB</p>
                  </div>
                )}
              </div>
              {errors.file && <p className="text-sm text-red-500">{errors.file}</p>}
            </div>

            {/* Exchange Section */}
            <div className="space-y-2 border-t pt-6">
              <Label htmlFor="exchange">交易所</Label>
              <select
                id="exchange"
                value={exchange}
                onChange={(e) => handleExchangeChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {exchanges.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                交易所决定策略使用的节假日历和有效交易时段。各交易所的节假日与每日交易时间可能不同，系统以日历数据为准；加密货币交易不受节假日限制。
              </p>
            </div>

            {/* Schedule Section */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">定时设置</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {isCrypto
                  ? '加密货币全天候交易，可让策略持续运行或限制运行时段。'
                  : '设置策略运行时间，所有时间均为印度标准时间。'}
              </p>

              {isCrypto && <RunAllDaySwitch checked={runAllDay} onCheckedChange={setRunAllDay} />}

              {/* Times and days: a 24/7 strategy has neither. */}
              {!allDay && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">开始时间（印度标准时间）</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className={errors.startTime ? 'border-red-500' : ''}
                      />
                      {errors.startTime && (
                        <p className="text-sm text-red-500">{errors.startTime}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stopTime">停止时间（印度标准时间）</Label>
                      <Input
                        id="stopTime"
                        type="time"
                        value={stopTime}
                        onChange={(e) => setStopTime(e.target.value)}
                        className={errors.stopTime ? 'border-red-500' : ''}
                      />
                      {errors.stopTime && <p className="text-sm text-red-500">{errors.stopTime}</p>}
                    </div>
                  </div>

                  {/* Day Selection */}
                  <div className="space-y-2">
                    <Label>执行日期</Label>
                    <div className="flex flex-wrap gap-2">
                      {SCHEDULE_DAYS.map((day) => (
                        <button
                          type="button"
                          key={day.value}
                          className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                            selectedDays.includes(day.value)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => handleDayToggle(day.value)}
                        >
                          <div
                            className={`h-4 w-4 rounded border flex items-center justify-center ${
                              selectedDays.includes(day.value)
                                ? 'bg-primary-foreground border-primary-foreground'
                                : 'border-current'
                            }`}
                          >
                            {selectedDays.includes(day.value) && (
                              <svg
                                className="h-3 w-3 text-primary"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm">{{ mon: '周一', tue: '周二', wed: '周三', thu: '周四', fri: '周五', sat: '周六', sun: '周日' }[day.value]}</span>
                        </button>
                      ))}
                    </div>
                    {errors.days && <p className="text-sm text-red-500">{errors.days}</p>}
                    <p className="text-xs text-muted-foreground">
                      选择策略运行的日期。特殊交易时段可启用周末。
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/python')}
              >
                取消
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? '上传中…' : '上传策略'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Example Strategy */}
      <Collapsible open={showExample} onOpenChange={setShowExample}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  Example Strategy Template
                </CardTitle>
                <span className="text-muted-foreground">{showExample ? 'Hide' : 'Show'}</span>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs font-mono">
                {EXAMPLE_STRATEGY}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  navigator.clipboard.writeText(EXAMPLE_STRATEGY)
                  showToast.success('已复制到剪贴板', 'clipboard')
                }}
              >
                Copy Template
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
