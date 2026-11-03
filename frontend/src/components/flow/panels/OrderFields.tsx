/**
 * The order-field pickers, each able to take a {{variable}} instead.
 *
 * These five controls were repeated inline across every order node, which is
 * why only `symbol` ever accepted a reference: it was the one field rendered as
 * a plain text input. A dropdown cannot express `{{webhook.exchange}}` and a
 * number input cannot express `{{webhook.quantity}}`, so a webhook-driven order
 * could name its instrument and nothing else.
 *
 * The executor has always interpolated these fields (`ORDER_CRITICAL_FIELDS` in
 * flow_executor_service.py), and refuses to dispatch an order whose reference
 * did not resolve rather than substituting a default. The gap was only in the
 * form.
 */

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EXCHANGES, ORDER_ACTIONS, PRICE_TYPES, PRODUCT_TYPES } from '@/lib/flow/constants'
import { cn } from '@/lib/utils'

import { TemplatableField } from './TemplatableField'

interface FieldProps {
  /**
   * The caller's own expression, passed through untouched. Several sites do not
   * read the node key directly: Product follows the exchange when the author
   * has not picked one, and Exchange defaults to NSE_INDEX or NFO on the nodes
   * where that is the sane starting point. Recomputing any of that here would
   * quietly flatten it.
   */
  value: unknown
  onChange: (value: string | number) => void
  label?: string
  /** Where the picker lands when a reference is switched back off. */
  fallback?: string | number
  /**
   * Smallest accepted quantity. Zero is meaningful on smartOrder, where it is a
   * target position size and therefore an instruction to flatten, so that node
   * passes 0 and an empty box reads as 0 rather than snapping to 1.
   */
  min?: number
}

export function ExchangeField({
  value,
  onChange,
  label = '交易所',
  fallback = 'NSE',
}: FieldProps) {
  return (
    <TemplatableField
      label={label}
      value={value}
      onChange={onChange}
      fallback={fallback}
      placeholder="{{webhook.exchange}}"
    >
      <Select value={value as string} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EXCHANGES.map((e) => (
            <SelectItem key={e.value} value={e.value}>
              {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </TemplatableField>
  )
}

export function ActionField({ value, onChange, label = '买卖方向', fallback = 'BUY' }: FieldProps) {
  return (
    <TemplatableField
      label={label}
      value={value}
      onChange={onChange}
      fallback={fallback}
      placeholder="{{webhook.action}}"
      hint="变量解析结果必须为 BUY 或 SELL。"
    >
      <div className="grid grid-cols-2 gap-2">
        {ORDER_ACTIONS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => onChange(a.value)}
            className={cn(
              'rounded-lg border py-2 text-sm font-semibold',
              value === a.value
                ? a.value === 'BUY'
                  ? 'bg-green-500/20 border-green-500 text-green-600'
                  : 'bg-red-500/20 border-red-500 text-red-600'
                : 'border-border bg-muted'
            )}
          >
            {a.value === 'BUY' ? '买入' : '卖出'}
          </button>
        ))}
      </div>
    </TemplatableField>
  )
}

export function QuantityField({
  value,
  onChange,
  label = '数量',
  fallback = 1,
  min = 1,
}: FieldProps) {
  return (
    <TemplatableField
      label={label}
      value={value}
      onChange={onChange}
      fallback={fallback}
      placeholder="{{webhook.quantity}}"
      hint="整个字段使用一个变量时会保留原有类型，数量应解析为数字。"
    >
      <Input
        type="number"
        min={min}
        className="h-8"
        value={value as number}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          // An emptied box is not a zero unless zero is a legal size here.
          if (Number.isNaN(parsed)) return onChange(min)
          onChange(parsed === 0 && min > 0 ? min : parsed)
        }}
      />
    </TemplatableField>
  )
}

export function ProductField({ value, onChange, label = '交易产品', fallback = 'MIS' }: FieldProps) {
  return (
    <TemplatableField
      label={label}
      value={value}
      onChange={onChange}
      fallback={fallback}
      placeholder="{{webhook.product}}"
    >
      <Select value={value as string} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRODUCT_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </TemplatableField>
  )
}

export function PriceTypeField({
  value,
  onChange,
  label = '价格类型',
  fallback = 'MARKET',
}: FieldProps) {
  return (
    <TemplatableField
      label={label}
      value={value}
      onChange={onChange}
      fallback={fallback}
      placeholder="{{webhook.priceType}}"
      hint="变量解析结果必须为 MARKET、LIMIT、SL 或 SL-M。"
    >
      <Select value={value as string} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRICE_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {({ MARKET: '市价（MARKET）', LIMIT: '限价（LIMIT）', SL: '止损限价（SL）', 'SL-M': '止损市价（SL-M）' } as Record<string, string>)[t.value] ?? t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </TemplatableField>
  )
}

interface ExpiryFieldProps {
  /**
   * Either one of the four relative choices, or an exact DDMMMYY date, or a
   * reference. One field holds all three because the executor accepts all
   * three from the same key: a DDMMMYY value is used as given, anything else
   * is resolved as a relative type.
   */
  value: unknown
  onChange: (value: string | number) => void
  /** Monthly-only underlyings get the weekly choices filtered out. */
  options: readonly { value: string; label: string }[]
}

/**
 * Expiry, as one control.
 *
 * The four relative choices cover almost every order and stay the picker. They
 * cannot name a far contract, so the toggle swaps to a text box that takes
 * either an exact date or a {{reference}} - the same shape every other field
 * here uses, rather than a second box sitting permanently underneath.
 */
export function ExpiryField({ value, onChange, options }: ExpiryFieldProps) {
  return (
    <TemplatableField
      label="到期日"
      value={value}
      onChange={onChange}
      fallback="current_week"
      placeholder="{{webhook.expiry}}"
      hint="可使用相对到期日、精确日期（如 28OCT25）或变量引用。"
    >
      <Select value={value as string} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((e) => (
            <SelectItem key={e.value} value={e.value}>
              {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </TemplatableField>
  )
}
