import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface LogoutConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function LogoutConfirmDialog({ open, onOpenChange, onConfirm }: LogoutConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认退出登录</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>确定要退出登录吗？退出后：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>所有自动下单和运行中的策略将停止工作。</li>
                <li>来自 TradingView、ChartInk 或其他来源的外部信号将不再处理。</li>
                <li>未平仓头寸将保持原样，但不再受到自动管理。</li>
                <li className="font-medium text-destructive">
                  连接此账户的所有设备将立即退出登录。
                </li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            确认退出
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
