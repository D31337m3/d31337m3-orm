/**
 * LandingPage — D31337m3.com
 * Hero → Live Scanner → Features → Pricing → Footer
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Eye, FileText, Zap, Globe, Lock,
  ChevronRight, Check, X, Star, ArrowRight,
  AlertCircle, Trash2, RefreshCw,
} from 'lucide-react';
import NetworkGraph from '../components/NetworkGraph';
import LiveScanner from '../components/LiveScanner';
import PaymentForm from '../components/PaymentForm';

// ─── Rotating hero text ────────────────────────────────────────────────────────
const HERO_WORDS = ['Delete It', 'Secure It', 'Neutralize It', 'Bury It'];

function HeroTypewriter() {
  const [idx, setIdx] = useState(0);

  return (
    <motion.span
      key={idx}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
      onAnimationComplete={() => {
        setTimeout(() => setIdx(i => (i + 1) % HERO_WORDS.length), 2500);
      }}
      className="text-cyber-cyan"
    >
      {HERO_WORDS[idx]}
    </motion.span>
  );
}

// ─── Pricing tiers ────────────────────────────────────────────────────────────
const TIERS = [
  {
    id: 'personal-basic',
    tier: 'PERSONAL_BASIC',
    name: 'Personal Basic',
    price: { monthly: 19, annual: 15 },
    annualTotal: 180,
    badge: null,
    color: 'cyber-cyan',
    features: [
      '15 data broker removals / month',
      'Monthly SERP scanning',
      '1 tracked keyword',
      'Vulnerability score dashboard',
      'Email support',
    ],
    notIncluded: ['Legal letter automation', 'Priority processing', 'API access'],
  },
  {
    id: 'personal-premium',
    tier: 'PERSONAL_PREMIUM',
    name: 'Personal Premium',
    price: { monthly: 49, annual: 38 },
    annualTotal: 460,
    badge: 'Most Popular',
    color: 'cyber-purple',
    features: [
      'Unlimited broker removals',
      'Weekly SERP monitoring',
      '3 tracked keywords',
      'Automated legal letters (CCPA/GDPR)',
      'Dark web exposure alerts',
      'Priority support',
    ],
    notIncluded: ['Multi-seat dashboard', 'API access'],
  },
  {
    id: 'business-growth',
    tier: 'BUSINESS_GROWTH',
    name: 'Business Growth',
    price: { monthly: 149, annual: 117 },
    annualTotal: 1400,
    badge: null,
    color: 'cyber-green',
    features: [
      '3 brand keywords monitored',
      'Review platform alerts',
      'Auto-response draft generation',
      'Legal fax submissions',
      'Reputation risk dashboard',
      'Dedicated account manager',
    ],
    notIncluded: ['Multi-seat dashboard', 'Full API access'],
  },
  {
    id: 'business-enterprise',
    tier: 'BUSINESS_ENTERPRISE',
    name: 'Enterprise',
    price: { monthly: 499, annual: null },
    annualTotal: null,
    badge: 'Custom',
    color: 'cyber-amber',
    features: [
      'Multi-seat dashboards',
      'Unlimited keywords',
      'Full REST API access',
      'Twilio automated legal fax',
      'Custom removal workflows',
      'SLA guarantees',
      'White-label option',
    ],
    notIncluded: [],
  },
];

const ADDONS = [
  {
    id: 'addon-expedited-removal',
    name: 'Expedited Removal',
    price: 25,
    description: '24-hour priority legal submission escalation',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: 'addon-deep-scan',
    name: 'Deep Scan',
    price: 35,
    description: 'Dark web audit + hidden asset profile leak tracking',
    icon: <Eye className="w-5 h-5" />,
  },
];

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="cyber-card w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300">
          <X className="w-5 h-5" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const [interval, setInterval]       = useState<'monthly' | 'annual'>('monthly');
  const [selectedTier, setSelectedTier] = useState<(typeof TIERS)[0] | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [authMode, setAuthMode]       = useState<'login' | 'register' | null>(null);
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [name, setName]               = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState('');

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const totalAddons = ADDONS.filter(a => selectedAddons.has(a.id)).reduce((s, a) => s + a.price, 0);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body: any = { email, password };
      if (authMode === 'register') body.fullName = name;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      localStorage.setItem('d31337m3_token', data.token);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const tierPrice = (t: typeof TIERS[0]) =>
    interval === 'annual' && t.price.annual ? t.price.annual : t.price.monthly;

  const colorMap: Record<string, string> = {
    'cyber-cyan':   'border-cyber-cyan/30 hover:border-cyber-cyan/60 [&_.accent]:text-cyber-cyan [&_.badge]:bg-cyber-cyan/10 [&_.badge]:text-cyber-cyan',
    'cyber-purple': 'border-cyber-purple/30 hover:border-cyber-purple/60 [&_.accent]:text-purple-400 [&_.badge]:bg-purple-500/10 [&_.badge]:text-purple-400',
    'cyber-green':  'border-cyber-green/30 hover:border-cyber-green/60 [&_.accent]:text-green-400 [&_.badge]:bg-green-500/10 [&_.badge]:text-green-400',
    'cyber-amber':  'border-amber-500/30 hover:border-amber-500/60 [&_.accent]:text-amber-400 [&_.badge]:bg-amber-500/10 [&_.badge]:text-amber-400',
  };

  return (
    <div className="min-h-screen bg-background text-zinc-100">

      {/* ─── NAVBAR ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyber-cyan/20 border border-cyber-cyan/40 flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyber-cyan" />
            </div>
            <span className="font-black text-lg tracking-tight">
              D3<span className="text-cyber-cyan">1337</span>m3
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#scanner" className="hover:text-zinc-100 transition-colors">Scanner</a>
            <a href="#features" className="hover:text-zinc-100 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-zinc-100 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setAuthMode('login')} className="btn-ghost text-sm">Log In</button>
            <button onClick={() => setAuthMode('register')} className="btn-primary text-sm">Get Started</button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16">
        <NetworkGraph className="opacity-60" />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background pointer-events-none" />
        <div className="absolute inset-0 bg-radial-[ellipse_80%_50%_at_50%_40%] from-cyber-cyan/5 to-transparent pointer-events-none" />

        <div className="relative z-10 text-center max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyber-cyan/30 bg-cyber-cyan/5 text-cyber-cyan text-xs font-mono mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-pulse" />
            Automated ORM &amp; PII Removal Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6"
          >
            Your digital footprint<br />
            is exposed. We{' '}
            <AnimatePresence mode="wait">
              <HeroTypewriter key="typewriter" />
            </AnimatePresence>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Automated removal from 200+ data brokers. Real-time SERP monitoring. Legal-grade
            deletion requests. All running 24/7, without you lifting a finger.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <button onClick={() => setAuthMode('register')} className="btn-primary text-base px-8 py-3">
              <Shield className="w-5 h-5" /> Start Protecting Now
              <ChevronRight className="w-5 h-5" />
            </button>
            <a href="#scanner" className="btn-secondary text-base px-8 py-3">
              <Eye className="w-5 h-5" /> Run Free Scan
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap justify-center gap-6 text-xs text-zinc-500 font-mono"
          >
            {['12,847 profiles removed', '200+ brokers covered', '99.2% success rate', 'CCPA/GDPR compliant'].map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-cyber-green" /> {s}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-zinc-600 font-mono">SCROLL TO SCAN</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-1 h-6 rounded-full bg-cyber-cyan/30" />
        </motion.div>
      </section>

      {/* ─── LIVE SCANNER ────────────────────────────────────────────────── */}
      <section id="scanner" className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="inline-flex items-center gap-2 text-cyber-cyan text-xs font-mono uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-pulse" />
            Free Exposure Scan
          </span>
          <h2 className="text-4xl font-black mb-4">See exactly what's out there</h2>
          <p className="text-zinc-400">
            Enter your name or brand. Our scanner checks 15+ public data vectors in real time.
          </p>
        </div>
        <LiveScanner onScanComplete={score => {
          if (score > 0) setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 2000);
        }} />
      </section>

      {/* ─── FEATURES ────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">Everything working while you sleep</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              End-to-end reputation protection from data discovery to legal enforcement.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Globe />, color: 'cyan', title: 'SERP Monitoring', desc: 'Continuous search engine result tracking across Google, Bing, and Yahoo with sentiment scoring and risk indexing.' },
              { icon: <Trash2 />, color: 'purple', title: 'Automated Opt-Outs', desc: 'Headless browser automation fills opt-out forms at 200+ data brokers, handles CAPTCHAs, and verifies email confirmations.' },
              { icon: <FileText />, color: 'green', title: 'Legal Documents', desc: 'Auto-generated CCPA, GDPR, and FCRA letters sent directly to brokers\' legal departments via email and fax.' },
              { icon: <Eye />, color: 'cyan', title: 'Dark Web Monitoring', desc: 'Deep scan add-on monitors dark web indices and paste sites for leaked PII, credentials, and financial data.' },
              { icon: <RefreshCw />, color: 'purple', title: 'Continuous Coverage', desc: 'Removal isn\'t one-and-done. New broker entries are detected and queued for removal within 24–72 hours.' },
              { icon: <Lock />, color: 'green', title: 'Privacy-First', desc: 'We collect only what\'s necessary to do the job. Your data is encrypted at rest and never sold.' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="cyber-card group hover:border-cyber-cyan/30 transition-all duration-300"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                  f.color === 'cyan'   ? 'bg-cyber-cyan/10 text-cyber-cyan' :
                  f.color === 'purple' ? 'bg-purple-500/10 text-purple-400' :
                  'bg-green-500/10 text-green-400'
                }`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-zinc-100 mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Choose your protection level</h2>
            <p className="text-zinc-400 mb-8">Cancel anytime. No setup fees. Immediate activation.</p>

            {/* Interval toggle */}
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-surface border border-border">
              {(['monthly', 'annual'] as const).map(i => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    interval === i
                      ? 'bg-cyber-cyan text-background'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {i === 'monthly' ? 'Monthly' : 'Annual'}
                  {i === 'annual' && <span className="ml-1.5 text-xs opacity-80">Save 20%</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Tier grid */}
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
            {TIERS.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`cyber-card border-2 relative transition-all duration-300 ${colorMap[t.color]} ${
                  t.badge === 'Most Popular' ? 'scale-[1.02] shadow-lg shadow-purple-500/10' : ''
                }`}
              >
                {t.badge && (
                  <div className="badge absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold">
                    {t.badge === 'Most Popular' && <Star className="inline w-3 h-3 mr-1" />}
                    {t.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-bold text-zinc-100 mb-1">{t.name}</h3>
                  <div className="flex items-end gap-1 mt-3">
                    {t.price.monthly ? (
                      <>
                        <span className="accent text-4xl font-black">${tierPrice(t)}</span>
                        <span className="text-zinc-500 text-sm mb-1">/mo</span>
                      </>
                    ) : (
                      <span className="accent text-2xl font-black">Custom</span>
                    )}
                  </div>
                  {interval === 'annual' && t.annualTotal && (
                    <p className="text-xs text-zinc-500 mt-1">${t.annualTotal}/year billed annually</p>
                  )}
                </div>

                <ul className="space-y-2 mb-6 text-sm">
                  {t.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      <span className="text-zinc-300">{f}</span>
                    </li>
                  ))}
                  {t.notIncluded.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <X className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                      <span className="text-zinc-600">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    const token = localStorage.getItem('d31337m3_token');
                    if (!token) { setAuthMode('register'); return; }
                    setSelectedTier(t);
                  }}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold border border-current transition-all hover:opacity-90 accent"
                >
                  {t.badge === 'Custom' ? 'Contact Sales' : 'Get Started'}
                  <ArrowRight className="inline w-4 h-4 ml-1" />
                </button>
              </motion.div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-center mb-6">
              <Zap className="inline w-5 h-5 text-amber-400 mr-2" />
              Premium Add-Ons
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {ADDONS.map(a => (
                <button
                  key={a.id}
                  onClick={() => toggleAddon(a.id)}
                  className={`cyber-card text-left transition-all ${
                    selectedAddons.has(a.id)
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedAddons.has(a.id) ? 'bg-amber-500/20 text-amber-400' : 'bg-surface text-zinc-500'
                    }`}>
                      {a.icon}
                    </div>
                    <span className={`text-lg font-black ${selectedAddons.has(a.id) ? 'text-amber-400' : 'text-zinc-400'}`}>
                      ${a.price}
                    </span>
                  </div>
                  <p className="font-semibold text-sm text-zinc-200 mb-1">{a.name}</p>
                  <p className="text-xs text-zinc-500">{a.description}</p>
                </button>
              ))}
            </div>
            {selectedAddons.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 py-3 px-4 rounded-lg bg-surface border border-border flex justify-between items-center"
              >
                <span className="text-sm text-zinc-400">Add-on total</span>
                <span className="text-lg font-bold text-amber-400">${totalAddons} / use</span>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyber-cyan" />
            <span className="font-black text-lg">D3<span className="text-cyber-cyan">1337</span>m3</span>
          </div>
          <p className="text-xs text-zinc-600 text-center">
            © {new Date().getFullYear()} D31337m3. All rights reserved. Not legal advice.
            CCPA/GDPR compliant. Privacy-first.
          </p>
          <div className="flex gap-4 text-xs text-zinc-600">
            <a href="#" className="hover:text-zinc-400">Privacy</a>
            <a href="#" className="hover:text-zinc-400">Terms</a>
            <a href="#" className="hover:text-zinc-400">Contact</a>
          </div>
        </div>
      </footer>

      {/* ─── PAYMENT MODAL ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTier && (
          <Modal onClose={() => setSelectedTier(null)}>
            <h2 className="text-xl font-black mb-1">{selectedTier.name}</h2>
            <p className="text-sm text-zinc-400 mb-6">
              ${tierPrice(selectedTier)}/mo · {interval === 'annual' ? 'Annual' : 'Monthly'} billing
            </p>
            <PaymentForm
              amountUSD={tierPrice(selectedTier)}
              tier={selectedTier.tier}
              interval={interval}
              onSuccess={() => { setSelectedTier(null); window.location.href = '/dashboard'; }}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── AUTH MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {authMode && (
          <Modal onClose={() => { setAuthMode(null); setAuthError(''); }}>
            <h2 className="text-xl font-black mb-6">
              {authMode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="input-cyber" />
              )}
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email address" className="input-cyber" required />
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" className="input-cyber" required />
              {authError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" /> {authError}
                </div>
              )}
              <button type="submit" disabled={authLoading} className="btn-primary w-full justify-center">
                {authLoading ? 'Please wait...' : authMode === 'login' ? 'Log In' : 'Create Account'}
              </button>
            </form>
            <p className="text-center text-sm text-zinc-500 mt-4">
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                className="text-cyber-cyan hover:underline"
              >
                {authMode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </Modal>
        )}
      </AnimatePresence>

    </div>
  );
}
