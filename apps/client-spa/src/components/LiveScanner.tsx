/**
 * LiveScanner — Enhanced "Bait and Catch" simulator
 * Runs the scan, shows threatening partial data, then blurs the results
 * behind a hard paywall CTA to lock in the subscription.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Shield, AlertTriangle, ChevronRight, Loader2, Lock } from 'lucide-react';

const SCAN_VECTORS = [
  'whitepages.com', 'spokeo.com', 'radaris.com', 'intelius.com',
  'truepeoplesearch.com', 'fastpeoplesearch.com', 'dark-web-index'
];

type ScanLine = {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'danger' | 'success' | 'header';
  delay: number;
};

export default function LiveScanner() {
  const [query, setQuery]           = useState('');
  const [phase, setPhase]           = useState<'idle' | 'scanning' | 'paywall'>('idle');
  const [lines, setLines]           = useState<ScanLine[]>([]);
  const [score, setScore]           = useState(0);
  const termRef                     = useRef<HTMLDivElement>(null);
  const lineId                      = useRef(0);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const buildLines = (name: string): ScanLine[] => {
    const generated: ScanLine[] = [];
    let delay = 0;

    const add = (text: string, type: ScanLine['type'] = 'info', extraDelay = 0) => {
      delay += extraDelay;
      generated.push({ id: lineId.current++, text, type, delay });
      delay += Math.random() * 60 + 40;
    };

    add(`> INITIALIZING D31337M3 DEEP SCAN...`, 'header');
    add(`> TARGET: "${name.toUpperCase()}"`, 'header', 200);
    
    SCAN_VECTORS.forEach((v, i) => {
      // Heavily bias towards finding things to create urgency
      const found = Math.random() > 0.1; 
      const records = found ? Math.floor(Math.random() * 12) + 2 : 0;
      add(
        `  [${String(i + 1).padStart(2, '0')}] ${v.padEnd(25)} ${found ? `⚠ ${records} EXPOSED RECORDS` : 'CLEAR'}`,
        found ? 'danger' : 'success',
        i === 0 ? 400 : 200,
      );
    });

    add(`> WARNING: PII LEAK DETECTED ON PUBLIC DATABASES.`, 'danger', 400);
    add(`> COMPILING VULNERABILITY PROFILE...`, 'info', 300);

    return generated;
  };

  const runScan = async () => {
    if (!query.trim() || phase === 'scanning') return;
    setPhase('scanning');
    setLines([]);
    
    const allLines = buildLines(query.trim());
    setScore(Math.floor(Math.random() * 20) + 75); // Always give a high risk score (75-95)

    for (const line of allLines) {
      await new Promise(r => setTimeout(r, line.delay));
      setLines(prev => [...prev, line]);
    }

    await new Promise(r => setTimeout(r, 600));
    setPhase('paywall');
  };

  const lineColor: Record<ScanLine['type'], string> = {
    header:  'text-cyber-cyan',
    info:    'text-zinc-400',
    warn:    'text-amber-400',
    danger:  'text-red-400',
    success: 'text-green-400',
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runScan()}
            placeholder="Enter your full name or brand to uncover exposed data..."
            disabled={phase === 'scanning'}
            className="input-cyber pl-10 disabled:opacity-50 text-lg py-4"
          />
        </div>
        <button
          onClick={phase === 'paywall' ? () => { setPhase('idle'); setLines([]); } : runScan}
          disabled={phase === 'scanning' || !query.trim()}
          className="btn-primary px-8 text-lg disabled:opacity-40"
        >
          {phase === 'scanning' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          {phase === 'paywall' ? 'New Scan' : 'Run Deep Scan'}
        </button>
      </div>

      <AnimatePresence>
        {(phase === 'scanning' || phase === 'paywall') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative cyber-card bg-black/80 border-red-500/30 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="font-mono text-xs text-red-400 font-bold tracking-widest">LIVE THREAT ANALYSIS</span>
            </div>

            <div ref={termRef} className="font-mono text-sm space-y-1 h-64 overflow-y-auto pr-1 pb-20">
              {lines.map(line => (
                <div key={line.id} className={lineColor[line.type]}>{line.text}</div>
              ))}
              {phase === 'scanning' && <span className="text-red-400 animate-pulse">█</span>}
            </div>

            {/* THE CATCH: Paywall Overlay */}
            {phase === 'paywall' && (
              <motion.div 
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-8 bg-gradient-to-t from-background via-background/90 to-transparent"
              >
                <div className="text-center px-6 max-w-lg">
                  <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                    <Lock className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-2 tracking-tight">CRITICAL EXPOSURE DETECTED</h3>
                  <p className="text-red-400 font-mono font-bold mb-4">VULNERABILITY SCORE: {score}/100</p>
                  <p className="text-zinc-300 text-sm mb-6 leading-relaxed">
                    Your personal identifiable information (PII) is currently exposed across multiple data brokers. 
                    This leaves you vulnerable to identity theft, doxxing, and targeted harassment.
                  </p>
                  <a href="#pricing" className="w-full btn-primary bg-red-500 hover:bg-red-600 text-white border-none py-4 text-lg justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-105">
                    Unlock Full Report & Remove Data Now
                    <ChevronRight className="w-5 h-5" />
                  </a>
                  <p className="text-xs text-zinc-500 mt-4">Immediate activation. Automatic legal dispatch.</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
