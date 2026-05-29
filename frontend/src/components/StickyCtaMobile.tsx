import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

interface Props {
  vagasPro: number
  userCity: string
}

export default function StickyCtaMobile({ vagasPro, userCity }: Props) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)

  const messages = [
    'Cadastrar Grátis Agora →',
    `⚠️ Apenas ${vagasPro} vagas em ${userCity} →`,
  ]

  useEffect(() => {
    const onScroll = () => {
      if (dismissed) { setVisible(false); return }
      const nearBottom = window.scrollY + window.innerHeight > document.body.scrollHeight - 160
      setVisible(window.scrollY > 300 && !nearBottom)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [dismissed])

  // Alternate messages every 3 seconds
  useEffect(() => {
    const id = setInterval(() => setMsgIndex(i => 1 - i), 3000)
    return () => clearInterval(id)
  }, [])

  if (!visible) return null

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[55] px-3 pb-safe pb-4">
      <div className="relative">
        <Link
          to="/login?mode=signup"
          className="sticky-cta-pulse flex items-center justify-center w-full bg-yellow-400 text-black font-black text-sm py-4 px-6 rounded-2xl shadow-2xl"
        >
          <span className="transition-opacity duration-300">
            {messages[msgIndex]}
          </span>
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-2 right-1 w-6 h-6 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  )
}
