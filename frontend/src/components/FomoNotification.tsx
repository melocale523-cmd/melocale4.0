import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Notif {
  text: string
  initial: string
  color: string
}

const RAW: Notif[] = [
  { text: '🔔 Eletricista de Jacobina recebeu 3 leads hoje',         initial: 'E', color: 'bg-blue-700'    },
  { text: '🔔 Cliente de Feira de Santana contratou pintor agora',   initial: 'C', color: 'bg-emerald-700' },
  { text: '💰 José acabou de faturar R$450 com um lead',             initial: 'J', color: 'bg-orange-600'  },
  { text: '⭐ Marcos recebeu avaliação 5 estrelas',                  initial: 'M', color: 'bg-yellow-600'  },
  { text: '🔔 Encanador de Irecê se cadastrou agora',                initial: 'E', color: 'bg-cyan-700'    },
  { text: '💼 Ana solicitou orçamento de reforma agora',             initial: 'A', color: 'bg-pink-700'    },
  { text: '🔔 Pintor de Senhor do Bonfim recebeu cliente',           initial: 'P', color: 'bg-purple-700'  },
  { text: '💰 Carlos faturou R$800 esta semana',                     initial: 'C', color: 'bg-blue-600'    },
  { text: '🔔 3 clientes novos em Jacobina hoje',                    initial: '3', color: 'bg-emerald-600' },
  { text: '⭐ Profissional recebeu 5 estrelas em Feira de Santana',  initial: '⭐', color: 'bg-yellow-700'  },
  { text: '🔔 Eletricista recebeu lead há 2 minutos',                initial: 'E', color: 'bg-blue-800'    },
  { text: '💼 Reforma solicitada em Irecê agora',                    initial: 'R', color: 'bg-slate-600'   },
  { text: '💰 Pedro ganhou R$1.200 este mês',                        initial: 'P', color: 'bg-green-700'   },
  { text: '🔔 Pintor de Jacobina fechou 2 contratos hoje',           initial: 'P', color: 'bg-purple-600'  },
  { text: '⭐ Cliente satisfeito em Senhor do Bonfim',               initial: 'C', color: 'bg-teal-700'    },
  { text: '🔔 Novo pedido de instalação elétrica agora',             initial: 'N', color: 'bg-indigo-700'  },
  { text: '💰 Profissional faturou R$600 com leads',                 initial: 'P', color: 'bg-orange-700'  },
  { text: '🔔 8 profissionais se cadastraram hoje',                  initial: '8', color: 'bg-emerald-800' },
  { text: '💼 Orçamento de pintura solicitado agora',                initial: 'O', color: 'bg-rose-700'    },
  { text: '🔔 Encanador fechou contrato há 5 minutos',               initial: 'E', color: 'bg-cyan-800'    },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function FomoNotification() {
  const [current, setCurrent] = useState<{ notif: Notif; key: number } | null>(null)
  const [leaving, setLeaving] = useState(false)

  const queueRef   = useRef<Notif[]>([])
  const idxRef     = useRef(0)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pauseUntil = useRef(0)
  const scheduleRef = useRef<((delay: number) => void) | undefined>(undefined)

  useEffect(() => {
    queueRef.current = shuffle(RAW)

    scheduleRef.current = (delay: number) => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        // Respect manual-close cooldown
        const remaining = pauseUntil.current - Date.now()
        if (remaining > 0) { scheduleRef.current?.(remaining); return }

        const notif = queueRef.current[idxRef.current % queueRef.current.length]
        idxRef.current++
        setCurrent({ notif, key: Date.now() })
        setLeaving(false)

        // Auto-dismiss after 5 seconds
        timerRef.current = setTimeout(() => {
          setLeaving(true)
          timerRef.current = setTimeout(() => {
            setCurrent(null)
            scheduleRef.current?.(25_000 + Math.floor(Math.random() * 15_000))
          }, 380)
        }, 5_000)
      }, delay)
    }

    scheduleRef.current(8_000)
    return () => clearTimeout(timerRef.current)
  }, [])

  const handleClose = () => {
    clearTimeout(timerRef.current)
    setLeaving(true)
    pauseUntil.current = Date.now() + 120_000
    timerRef.current = setTimeout(() => {
      setCurrent(null)
      scheduleRef.current?.(120_000)
    }, 380)
  }

  if (!current) return null

  return (
    <div
      key={current.key}
      className={`fixed bottom-20 left-3 z-[54] max-w-xs ${leaving ? 'fomo-out' : 'fomo-in'}`}
    >
      <div className="bg-[#1a2e4a] border border-slate-700/60 rounded-lg p-2.5 shadow-md flex items-start gap-2">
        {/* Avatar */}
        <div className={`w-7 h-7 shrink-0 rounded-full ${current.notif.color} flex items-center justify-center text-white font-black text-xs`}>
          {current.notif.initial}
        </div>

        {/* Text */}
        <p className="text-white text-xs leading-snug flex-1 pt-0.5">
          {current.notif.text}
        </p>

        {/* Close */}
        <button
          onClick={handleClose}
          className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
          aria-label="Fechar"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
