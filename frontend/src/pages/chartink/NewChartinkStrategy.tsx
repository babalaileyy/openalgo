import { ArrowLeft, Info, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { chartinkApi } from '@/api/chartink'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { showToast } from '@/utils/toast'

export default function NewChartinkStrategy() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    strategy_type: 'intraday',
    start_time: '09:15',
    end_time: '15:00',
    squareoff_time: '15:15',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Strategy name is required'
    } else if (formData.name.length < 3 || formData.name.length > 50) {
      newErrors.name = 'Name must be between 3 and 50 characters'
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(formData.name)) {
      newErrors.name = 'Name can only contain letters, numbers, spaces, hyphens, and underscores'
    }

    // Time validation for intraday
    if (formData.strategy_type === 'intraday') {
      const start = formData.start_time
      const end = formData.end_time
      const squareoff = formData.squareoff_time

      if (!start || !end || !squareoff) {
        newErrors.time = 'All time fields are required for intraday strategies'
      } else if (start >= end) {
        newErrors.time = 'Start time must be before end time'
      } else if (end >= squareoff) {
        newErrors.time = 'End time must be before square off time'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      showToast.error('Please fix the form errors', 'chartink')
      return
    }

    try {
      setLoading(true)
      const response = await chartinkApi.createStrategy({
        name: formData.name,
        strategy_type: formData.strategy_type as 'intraday' | 'positional',
        ...(formData.strategy_type === 'intraday' && {
          start_time: formData.start_time,
          end_time: formData.end_time,
          squareoff_time: formData.squareoff_time,
        }),
      })

      if (response.status === 'success') {
        showToast.success('Chartink strategy created successfully', 'chartink')
        navigate(`/chartink/${response.data?.strategy_id}`)
      } else {
        showToast.error(response.message || '创建策略失败', 'chartink')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '创建策略失败'
      showToast.error(errorMessage, 'chartink')
    } finally {
      setLoading(false)
    }
  }

  const finalName = formData.name
    ? `chartink_${formData.name.toLowerCase().replace(/\s+/g, '_')}`
    : ''

  return (
    <div className="container mx-auto py-6 max-w-2xl space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/chartink">
          <ArrowLeft className="h-4 w-4 mr-2" />返回 Chartink 策略</Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">创建 Chartink 策略</h1>
        <p className="text-muted-foreground">创建 Chartink Webhook 策略以接收选股器提醒</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />策略详情</CardTitle>
          <CardDescription>
            Configure your Chartink strategy settings (NSE/BSE only)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Strategy Name */}
            <div className="space-y-2">
              <Label htmlFor="name">策略名称</Label>
              <Input
                id="name"
                placeholder="My Chartink Strategy"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              <p className="text-xs text-muted-foreground">
                3-50 characters. Letters, numbers, spaces, hyphens, and underscores only.
              </p>
            </div>

            {/* Final Name Preview */}
            {finalName && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Final strategy name:{' '}
                  <code className="bg-muted px-1 rounded font-mono">{finalName}</code>
                </AlertDescription>
              </Alert>
            )}

            {/* Strategy Type */}
            <div className="space-y-2">
              <Label htmlFor="strategy_type">策略类型</Label>
              <Select
                value={formData.strategy_type}
                onValueChange={(value) => setFormData({ ...formData, strategy_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intraday">日内</SelectItem>
                  <SelectItem value="positional">持仓</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">日内策略设有交易时段和自动平仓时间。</p>
            </div>

            {/* Intraday Time Settings */}
            {formData.strategy_type === 'intraday' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">交易时间</h4>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">开始时间</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">结束时间</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="squareoff_time">平仓</Label>
                    <Input
                      id="squareoff_time"
                      type="time"
                      value={formData.squareoff_time}
                      onChange={(e) => setFormData({ ...formData, squareoff_time: e.target.value })}
                    />
                  </div>
                </div>

                {errors.time && <p className="text-sm text-red-500">{errors.time}</p>}
                <p className="text-xs text-muted-foreground">仅在交易时段内下单，并在指定时间平仓。</p>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/chartink')}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Create Strategy'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
