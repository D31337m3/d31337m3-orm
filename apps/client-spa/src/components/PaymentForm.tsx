/**
 * PaymentForm — Multi-provider payment selection
 * Supports: Stripe card, PayPal, Interac, Web3 (Polygon/Base USDC/USDT)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Wallet, Banknote, Coins, Check, Loader2 } from 'lucide-react';
import { useWeb3Payment } from '../hooks/useWeb3Payment';

type Provider = 'stripe' | 'paypal' | 'interac' | 'crypto';
type CryptoChain = 'polygon' | 'base';
type CryptoToken = 'USDC' | 'USDT';

interface Props {
  amountUSD: number;
  tier: string;
  interval: 'monthly' | 'annual';
  onSuccess?: () => void;
}

export default function PaymentForm({ amountUSD, tier, interval, onSuccess }: Props) {
  const [provider, setProvider]         = useState<Provider>('stripe');
  const [interacRef, setInteracRef]     = useState('');
  const [interacName, setInteracName]   = useState('');
  const [interacAmount, setInteracAmount] = useState(String(Math.ceil(amountUSD * 1.36))); // CAD estimate
  const [cryptoChain, setCryptoChain]   = useState<CryptoChain>('polygon');
  const [cryptoToken, setCryptoToken]   = useState<CryptoToken>('USDC');
  const [loading, setLoading]           = useState(false);
  const [done, setDone]                 = useState(false);

  const { connectWallet, depositAddress, provisionAddress, verifyPayment, walletAddress, isConnected } = useWeb3Payment();

  const providers: Array<{ id: Provider; label: string; icon: React.ReactNode; description: string }> = [
    { id: 'stripe',  label: 'Card',    icon: <CreditCard className="w-5 h-5" />, description: 'Visa, Mastercard, Amex' },
    { id: 'paypal',  label: 'PayPal',  icon: <Wallet className="w-5 h-5" />,     description: 'PayPal balance or card' },
    { id: 'interac', label: 'Interac', icon: <Banknote className="w-5 h-5" />,   description: 'Canada e-Transfer' },
    { id: 'crypto',  label: 'Crypto',  icon: <Coins className="w-5 h-5" />,      description: 'USDC / USDT on-chain' },
  ];

  const handleStripeCheckout = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('d31337m3_token');
      const res = await fetch('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier, interval: interval.toUpperCase() }),
      });
      const { url } = await res.json();
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  };

  const handleInteracSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('d31337m3_token');
      await fetch('/api/payments/interac/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          referenceNumber: interacRef,
          senderName: interacName,
          amountCAD: parseFloat(interacAmount),
        }),
      });
      setDone(true);
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  const handleCryptoProvision = async () => {
    setLoading(true);
    try {
      const chainId = cryptoChain === 'polygon' ? 137 : 8453;
      await provisionAddress(amountUSD, chainId);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-xl font-bold text-zinc-100 mb-2">Payment Submitted</h3>
        <p className="text-zinc-400 text-sm">Your account will be activated once payment is confirmed.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {providers.map(p => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${
              provider === p.id
                ? 'border-cyber-cyan bg-cyber-cyan/10 text-cyber-cyan'
                : 'border-border text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            {p.icon}
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* Stripe */}
        {provider === 'stripe' && (
          <motion.div key="stripe" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-sm text-zinc-400 mb-4">
              Securely checkout via Stripe. You'll be redirected to complete payment.
            </p>
            <div className="flex justify-between items-center py-3 border-t border-border mb-4">
              <span className="text-zinc-400 text-sm">Total</span>
              <span className="text-xl font-bold text-zinc-100">${amountUSD.toFixed(2)}<span className="text-sm text-zinc-500 ml-1">/ {interval}</span></span>
            </div>
            <button onClick={handleStripeCheckout} disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Continue with Stripe
            </button>
          </motion.div>
        )}

        {/* PayPal */}
        {provider === 'paypal' && (
          <motion.div key="paypal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-sm text-zinc-400 mb-4">
              Pay via PayPal. You'll be redirected to authorize the subscription.
            </p>
            <div className="py-3 border border-dashed border-amber-500/30 rounded-lg bg-amber-500/5 text-center text-amber-400 text-sm mb-4">
              PayPal subscription flow — integration uses PayPal Subscriptions API
            </div>
            <button className="btn-primary w-full justify-center bg-[#003087] hover:bg-[#003087]/90">
              <Wallet className="w-4 h-4" />
              Pay with PayPal
            </button>
          </motion.div>
        )}

        {/* Interac */}
        {provider === 'interac' && (
          <motion.div key="interac" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="py-2 px-3 rounded-lg bg-cyber-cyan/5 border border-cyber-cyan/20 text-xs font-mono text-cyber-cyan">
              Send e-Transfer to: <strong>payments@d31337m3.com</strong> · Message: Your email address
            </div>
            <input value={interacName} onChange={e => setInteracName(e.target.value)} placeholder="Your full name" className="input-cyber" />
            <input value={interacRef} onChange={e => setInteracRef(e.target.value)} placeholder="Interac reference number" className="input-cyber" />
            <input value={interacAmount} onChange={e => setInteracAmount(e.target.value)} placeholder="Amount in CAD" type="number" className="input-cyber" />
            <button onClick={handleInteracSubmit} disabled={loading || !interacRef || !interacName} className="btn-primary w-full justify-center disabled:opacity-40">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              Submit Transfer Details
            </button>
          </motion.div>
        )}

        {/* Crypto */}
        {provider === 'crypto' && (
          <motion.div key="crypto" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Chain + token selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Network</label>
                <select value={cryptoChain} onChange={e => setCryptoChain(e.target.value as CryptoChain)} className="input-cyber">
                  <option value="polygon">Polygon (MATIC)</option>
                  <option value="base">Base (Coinbase L2)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Token</label>
                <select value={cryptoToken} onChange={e => setCryptoToken(e.target.value as CryptoToken)} className="input-cyber">
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>
            </div>

            {!isConnected && (
              <button onClick={connectWallet} className="btn-secondary w-full justify-center">
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}

            {isConnected && !depositAddress && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-zinc-400">
                  Connected: <span className="text-cyber-cyan">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</span>
                </div>
                <button onClick={handleCryptoProvision} disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                  Generate Deposit Address
                </button>
              </div>
            )}

            {depositAddress && (
              <div className="space-y-3">
                <div className="py-3 px-4 rounded-lg bg-surface border border-border">
                  <p className="text-xs text-zinc-500 mb-1">Send exactly</p>
                  <p className="text-2xl font-black font-mono text-cyber-cyan">{amountUSD} {cryptoToken}</p>
                  <p className="text-xs text-zinc-500 mt-2 mb-1">To address ({cryptoChain === 'polygon' ? 'Polygon' : 'Base'})</p>
                  <p className="font-mono text-xs text-zinc-300 break-all">{depositAddress}</p>
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  Send only {cryptoToken} on {cryptoChain === 'polygon' ? 'Polygon' : 'Base'} network.
                  Address expires in 60 minutes.
                </p>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
