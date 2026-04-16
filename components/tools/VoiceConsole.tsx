'use client'

import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'

interface VoiceConsoleProps {
  onTradeParsed?: (trade: any) => void;
}

export function VoiceConsole({ onTradeParsed }: VoiceConsoleProps) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && ('WebkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).WebkitSpeechRecognition || (window as any).speechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'es-ES'

      recognitionRef.current.onresult = (event: any) => {
        const result = event.results[event.results.length - 1][0].transcript
        setTranscript(result)
        handleVoiceCommand(result)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
  }, [])

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true)
      setTranscript('')
      recognitionRef.current.start()
    } else {
        alert("Tu navegador no soporta reconocimiento de voz nativo (WebSpeech API).")
    }
  }

  const handleVoiceCommand = async (command: string) => {
    setIsProcessing(true)
    console.log('Comando de voz recibido:', command)
    
    try {
        const res = await fetch('/api/oracle/parse-trade-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: command })
        })
        const data = await res.json()
        
        if (data && data.symbol) {
             console.log("Trade parsed:", data);

             const createRes = await fetch('/api/journal/trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  symbol: data.symbol,
                  side: data.type === 'SELL' ? 'SELL' : 'BUY',
                  result: 'OPEN',
                  profit: 0,
                  entryPrice: data.entry ?? null,
                  stopLoss: data.sl ?? null,
                  takeProfit: data.tp ?? null,
                  notes: `Origen voz: ${command}`,
                }),
             })
             const created = await createRes.json()

             playElevenLabsResponse(data.response || "Entendido, trade registrado.")
             if (onTradeParsed) {
                 onTradeParsed({
                    id: created?.data?.id ?? Date.now(),
                    symbol: data.symbol,
                    type: data.type || 'UNKNOWN',
                    result: 'OPEN',
                    profit: 0,
                    date: created?.data?.createdAt
                      ? new Date(created.data.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                      : new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                 })
             }
        } else {
            playElevenLabsResponse("He escuchado el comando, pero no he detectado los parámetros del trade. ¿Puedes repetir?")
        }
    } catch (e) {
        console.error("Voice parse error:", e)
        playElevenLabsResponse("Lo siento, hubo un error procesando tu audio.")
    } finally {
        setIsProcessing(false)
    }
  }

  // Placeholder for ElevenLabs integration
  const playElevenLabsResponse = (text: string) => {
    console.log('ElevenLabs (Mock):', text)
    // In production: call API to get audio buffer from ElevenLabs and play it
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="rounded-xl border border-bg-border bg-bg-deep p-6 glass space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4">
        <div className={clsx(
          "w-2 h-2 rounded-full",
          isListening ? "bg-bear animate-pulse" : "bg-ink-dim"
        )} />
      </div>

      <div className="flex flex-col items-center justify-center space-y-6 py-4">
        <button
          onClick={startListening}
          disabled={isListening || isProcessing}
          className={clsx(
            "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
            isListening 
              ? "bg-bear/20 border-bear/50 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.3)]" 
              : "bg-oracle/10 border border-oracle/30 hover:bg-oracle/20"
          )}
        >
          <svg className={clsx("w-8 h-8", isListening ? "text-bear" : "text-oracle")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        <div className="text-center space-y-2">
          <h4 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-widest">
            {isListening ? 'Escuchando Mando...' : isProcessing ? 'Procesando Voz...' : 'Comando de Voz'}
          </h4>
          <p className="text-[10px] font-mono text-ink-muted leading-tight max-w-[200px] h-8 overflow-hidden italic">
            {transcript || 'Haz clic para dictar un trade o pedir el resumen'}
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-bg-border/50 flex justify-center gap-4">
         <span className="text-[9px] font-mono text-ink-dim flex items-center gap-1">
           <span className="w-1 h-1 bg-ink-dim rounded-full" /> STT: WebSpeech
         </span>
         <span className="text-[9px] font-mono text-ink-dim flex items-center gap-1">
           <span className="w-1 h-1 bg-ink-dim rounded-full" /> TTS: ElevenLabs Ready
         </span>
      </div>
    </div>
  )
}
