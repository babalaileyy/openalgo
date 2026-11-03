// pages/flow/FlowKeyboardShortcuts.tsx
// Keyboard shortcuts reference page for Flow Editor

import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutSection {
  title: string
  shortcuts: ShortcutItem[]
}

const shortcutSections: ShortcutSection[] = [
  {
    title: '常用',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: '保存工作流' },
      { keys: ['Escape'], description: '取消选择节点或连线' },
      { keys: ['?'], description: '打开快捷键说明' },
    ],
  },
  {
    title: '画布导航',
    shortcuts: [
      { keys: ['滚轮'], description: '放大或缩小' },
      { keys: ['拖动'], description: '平移画布' },
      { keys: ['Ctrl', '滚轮'], description: '精细缩放' },
    ],
  },
  {
    title: '节点操作',
    shortcuts: [
      { keys: ['点击'], description: '选择节点' },
      { keys: ['Delete'], description: '删除所选节点' },
      { keys: ['Backspace'], description: '删除所选节点' },
      { keys: ['从节点面板拖动'], description: '添加节点' },
    ],
  },
  {
    title: '连线操作',
    shortcuts: [
      { keys: ['点击连线'], description: '选择连线' },
      { keys: ['Delete'], description: '删除所选连线' },
      { keys: ['Backspace'], description: '删除所选连线' },
      { keys: ['从连接点拖动'], description: '创建连接' },
    ],
  },
  {
    title: '选择',
    shortcuts: [
      { keys: ['点击节点'], description: '选择单个节点' },
      { keys: ['点击连线'], description: '选择单条连线' },
      { keys: ['点击画布'], description: '清除选择' },
    ],
  },
  {
    title: '工作流控制',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: '保存更改' },
      { keys: ['立即运行'], description: '立即执行工作流' },
    ],
  },
]

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

export default function FlowKeyboardShortcuts() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="返回工作流列表">
          <Link to="/flow">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">快捷键</h1>
          <p className="text-muted-foreground">
            查看所有可用快捷键
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {shortcutSections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-4 text-lg font-semibold">{section.title}</h2>
            <div className="rounded-lg border border-border">
              {section.shortcuts.map((shortcut, index) => (
                <div
                  key={shortcut.description}
                  className={`flex items-center justify-between px-4 py-3 ${
                    index !== section.shortcuts.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <span className="text-sm">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={key} className="flex items-center gap-1">
                        <KeyBadge>{key}</KeyBadge>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="text-muted-foreground">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-muted/50 p-4">
        <h3 className="mb-2 font-medium">提示</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>在 Mac 上使用 Cmd 代替 Ctrl</li>
          <li>点击连线上的 + 按钮，可在现有节点之间插入新节点</li>
          <li>拖动节点可调整其在画布中的位置</li>
          <li>使用右下角缩略图快速导航</li>
          <li>右键点击节点可打开菜单</li>
        </ul>
      </div>
    </div>
  )
}
