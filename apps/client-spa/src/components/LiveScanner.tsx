/**
 * LiveScanner — Interactive "mock scan" simulator
 * User types their name → animated terminal console output →
 * Vulnerability Score reveal → CTA to subscribe
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Shield, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';

const SCAN_VECTORS = [
  'google.com/search',
  'bing.com/search',
  'whitepages.com',
  'spokeo.com',
  'radaris.com',
  'beenverified.com',
  'intelius.com',
  'peoplefinder.com',
  'truepeoplesearch.com',
  'fastpeoplesearch.com',
  'mylife.com',
  'instantcheckmate.com',
  'facebook.com/search',
  'linkedin.com',
  'dark-web-index-1.onion',
];

type ScanLine = {
  id: number;
  text: string;
  type: 'info' | 'warn' | 'danger' | 'success' | 'header';
  delay: number;
};

interface Props {
  onScanComplete?: (score: number) => void;
}

export default function LiveScanner({ onScanComplete }: Props) {
  const [query, setQuery]           = useState('');
  const [phase, setPhase]           = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [lines, setLines]           = useState<ScanLine[]>([]);
  const [score, setScore]           = useState(0);
  const [animScore, setAnimScore]   = useState(0);
  const termRef                     = useRef<HTMLDivElement>(null);
  const lineId                      = useRef(0);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines]);

  // Animate score counter
  useEffect(() => {
    if (phase !== 'complete') return;
    let current = 0;
    const step = score / 60;
    const interval = setInterval(() => {
      current = Math.min(current + step, score);
      setAnimScore(Math.round(current));
      if (current >= score) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [phase, score]);

  const buildLines = (name: string): ScanLine[] => {
    const generated: ScanLine[] = [];
    let delay = 0;

    const add = (text: string, type: ScanLine['type'] = 'info', extraDelay = 0) => {
      delay += extraDelay;
      generated.push({ id: lineId.current++, text, type, delay });
      delay += Math.random() * 60 + 40;
    };

    add(`> INITIALIZING D31337M3 SCAN ENGINE v4.2.1`, 'header');
    add(`> TARGET QUERY: "${name.toUpperCase()}"`, 'header', 200);
    add(`> SCANNING ${SCAN_VECTORS.length} PUBLIC DATA VECTORS...`, 'info', 300);

    SCAN_VECTORS.forEach((v, i) => {
      const found = Math.random() > 0.4;
      const records = found ? Math.floor(Math.random() * 8) + 1 : 0;
      add(
        `  [${String(i + 1).padStart(2, '0')}] ${v.padEnd(35)} ${found ? `FOUND ${records} record(s)` : 'CLEAR'}`,
        found ? (records > 4 ? 'danger' : 'warn') : 'success',
        i === 0 ? 400 : 0,
      );
    });

    add(`> CROSS-REFERENCING BREACH DATABASES...`, 'info', 300);
    const breachFound = Math.random() > 0.5;
    add(
      breachFound
        ? `  ⚠ EMAIL FOUND IN ${Math.floor(Math.random() * 4) + 1} KNOWN DATA BREACH(ES)`
        : `  ✓ No known breach records found`,
      breachFound ? 'danger' : 'success',
      200,
    );

    add(`> COMPILING VISIBILITY RISK INDEX...`, 'info', 400);
    add(`> ANALYSIS COMPLETE.`, 'header', 600);

    return generated;
  };

  const runScan = async () => {
    if (!query.trim() || phase === 'scanning') return;
    const name = query.trim();
    setPhase('scanning');
    setLines([]);
    setAnimScore(0);

    const allLines = buildLines(name);
    const finalScore = Math.floor(Math.random() * 55) + 35; // 35–90 for demo

    // Stream lines with delays
    for (const line of allLines) {
      await new Promise(r => setTimeout(r, line.delay));
      setLines(prev => [...prev, line]);
    }

    await new Promise(r => setTimeout(r, 800));
    setScore(finalScore);
    setPhase('complete');
    onScanComplete?.(finalScore);
  };

  const reset = () => {
    setPhase('idle');
    setLines([]);
    setQuery('');
    setScore(0);
    setAnimScore(0);
  };

  const scoreColor =
    score >= 70 ? 'text-red-400' :
    score >= 45 ? 'text-amber-400' :
    'text-green-400';

  const scoreLabel =
    score >= 70 ? 'HIGH RISK' :
    score >= 45 ? 'MODERATE RISK' :
    'LOW RISK';

  const lineColor: Record<ScanLine['type'], string> = {
    header:  'text-cyber-cyan',
    info:    'text-zinc-400',
    warn:    'text-amber-400',
    danger:  'text-red-400',
    success: 'text-green-400',
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search input */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runScan()}
            placeholder="Enter your name or brand..."
            disabled={phase === 'scanning'}
            className="input-cyber pl-10 disabled:opacity-50"
          />
        </div>
        <button
          onClick={phase === 'complete' ? reset : runScan}
          disabled={phase === 'scanning' || !query.trim()}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {phase === 'scanning' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
          ) : phase === 'complete' ? (
            'Scan Again'
          ) : (
            <><Search className="w-4 h-4" /> Scan Now</>
          )}
        </button>
      </div>

      {/* Terminal */}
      <AnimatePresence>
        {(phase === 'scanning' || phase === 'complete') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="cyber-card bg-black/80 border-cyber-cyan/30 mb-6"
          >
            {/* Terminal header */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 font-mono text-xs text-zinc-500">d31337m3 — threat-scanner</span>
              {phase === 'scanning' && (
                <span className="ml-auto font-mono text-xs text-cyber-cyan animate-pulse">● LIVE</span>
              )}
            </div>

            {/* Terminal output */}
            <div
              ref={termRef}
              className="font-mono text-xs space-y-0.5 max-h-64 overflow-y-auto pr-1"
            >
              <AnimatePresence initial={false}>
                {lines.map(line => (
                  <motion.div
                    key={line.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.1 }}
                    className={`terminal-line ${lineColor[line.type]}`}
                  >
                    {line.text}
                  </motion.div>
                ))}
              </AnimatePresence>
              {phase === 'scanning' && (
                <span className="text-cyber-cyan animate-pulse">█</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score reveal */}
      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="cyber-card border-red-500/20 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Vulnerability Score
              </span>
            </div>

            <motion.div
              className={`text-7xl font-black font-mono ${scoreColor} mb-2`}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
            >
              {animScore}
              <span className="text-2xl text-zinc-500">/100</span>
            </motion.div>

            <div className={`text-sm font-bold font-mono tracking-widest mb-4 ${scoreColor}`}>
              {scoreLabel}
            </div>

            {/* Score bar */}
            <div className="w-full h-2 bg-zinc-800 rounded-full mb-6 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  score >= 70 ? 'bg-red-500' :
                  score >= 45 ? 'bg-amber-500' :
                  'bg-green-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${animScore}%` }}
                transition={{ delay: 0.5, duration: 1.5, ease: 'easeOut' }}
              />
            </div>

            <p className="text-sm text-zinc-400 mb-6">
              We found your data on <strong className="text-zinc-200">{Math.floor(score / 10) + 3} platforms</strong>.
              Start removing it today.
            </p>

            <div className="flex gap-3 justify-center">
              <a href="#pricing" className="btn-primary">
                <Shield className="w-4 h-4" />
                Protect My Identity
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
