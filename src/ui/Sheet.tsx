// 화면 위에 뜨는 시트(모달)의 공통 동작.
// 사람에게도, 화면을 접근성 트리로 읽는 AI 에이전트에게도 "지금은 이 창만 조작할 수 있다"가 드러나야 한다.
// - 뒤쪽 화면(#root)은 inert + aria-hidden: 보이지도, 눌리지도, 포커스되지도 않는다
//   (Playwright MCP 같은 도구는 inert만으로는 뒤쪽 버튼을 계속 보여준다)
// - Esc로 닫히고, 닫히면 시트를 연 버튼으로 포커스가 돌아간다

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  label: string
  className: string
  onClose: () => void
  children: ReactNode
}

// 시트가 겹쳐 열려도 마지막 시트가 닫힐 때만 뒤쪽 화면을 되살린다.
let open = 0

export function Sheet({ label, className, onClose, children }: Props) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = document.getElementById('root')
    open++
    root?.setAttribute('inert', '')
    root?.setAttribute('aria-hidden', 'true')
    dialog.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (--open === 0) {
        root?.removeAttribute('inert')
        root?.removeAttribute('aria-hidden')
      }
      opener?.focus()
    }
  }, [])

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={dialog} className={className} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
