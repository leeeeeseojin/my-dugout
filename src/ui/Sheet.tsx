// 화면 위에 뜨는 시트(모달)의 공통 동작.
// 사람에게도, 화면을 접근성 트리로 읽는 AI 에이전트에게도 "지금은 이 창만 조작할 수 있다"가 드러나야 한다.
// - 시트가 열린 동안 뒤쪽 화면은 아예 그리지 않는다. 시트를 쓰는 화면이 시트만 남기고 나머지를 지운다.
//   (예전처럼 inert + aria-hidden으로 가리면 Playwright MCP의 AI용 스냅샷에는 뒤쪽 버튼이 이름 없이 남아,
//    에이전트가 그 버튼을 누르다 막혔다. DOM에 없으면 어떤 트리에도 안 나온다)
// - Tab은 시트 안에서만 돈다. Esc로 닫힌다.
// - 닫히면 시트를 연 버튼으로 포커스를 돌려준다. 뒤쪽 화면이 새로 그려져 버튼도 새 요소이므로,
//   여는 버튼에 data-opener 이름표를 달아 두고 닫을 때 그 이름표로 다시 찾는다.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  label: string
  className: string
  onClose: () => void
  children: ReactNode
}

interface Opener {
  el: HTMLElement
  key?: string
}

// 렌더 중에 읽어야 뒤쪽 화면이 지워지기 전의 포커스(=시트를 연 버튼)를 잡을 수 있다
function readOpener(): Opener | null {
  const el = document.activeElement
  return el instanceof HTMLElement && el !== document.body ? { el, key: el.dataset.opener } : null
}

function focusOpener(opener: Opener | null) {
  if (!opener) return
  if (opener.el.isConnected) return opener.el.focus()
  if (!opener.key) return
  document.querySelector<HTMLElement>(`[data-opener="${CSS.escape(opener.key)}"]`)?.focus()
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function Sheet({ label, className, onClose, children }: Props) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const [opener] = useState(readOpener)

  useEffect(() => {
    dialog.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
        return
      }
      if (e.key !== 'Tab' || !dialog.current) return
      // 마지막 칸에서 Tab, 첫 칸에서 Shift+Tab을 누르면 반대쪽 끝으로
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const inside = dialog.current.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === dialog.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // 이 시점에는 뒤쪽 화면이 이미 다시 그려져 있다
      focusOpener(opener)
    }
  }, [opener])

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={dialog} className={className} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
