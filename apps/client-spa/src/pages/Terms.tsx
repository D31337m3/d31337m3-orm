import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-zinc-100 py-16 px-4">
      <div className="max-w-3xl mx-auto cyber-card">
        <div className="flex items-center gap-4 mb-8 pb-4 border-b border-border">
          <Link to="/" className="text-zinc-500 hover:text-cyber-cyan transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-lg bg-cyber-cyan/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-cyber-cyan" />
          </div>
          <h1 className="text-2xl font-black">Terms &amp; Conditions</h1>
        </div>

        <div className="space-y-6 text-sm text-zinc-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-zinc-200 mb-2">1. Acceptance of Terms</h2>
            <p>By accessing and utilizing the D31337m3 platform, you agree to be bound by these terms. This service automates the transmission of opt-out requests and legal notices on your behalf.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-200 mb-2">2. Best Effort Basis & No Guarantees</h2>
            <p>D31337m3 acts as a technological facilitator. We utilize automated headless browsing and API integrations to submit removal requests to third-party data brokers. <strong className="text-amber-400">We do not and cannot guarantee the absolute removal of your data.</strong> The fulfillment of these requests is entirely at the discretion and technical capability of the third-party platforms. You acknowledge that some brokers may reject automated requests or require further manual identity verification which falls outside the scope of our automated service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-200 mb-2">3. Search Engine Cache Delays</h2>
            <p>You acknowledge that even upon successful removal of a record from a source data broker, search engines (such as Google, Bing, and Yahoo) utilize indexing caches. <strong className="text-cyber-cyan">It typically takes between 3 to 14 days for search engines to recrawl and drop cached links.</strong> D31337m3 has no control over Google's or Bing's caching mechanisms and cannot expedite this process.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-200 mb-2">4. Agency Authorization</h2>
            <p>By using our legal generation and opt-out tools, you explicitly authorize D31337m3 to act as your authorized agent under applicable privacy frameworks (including, but not limited to, the CCPA, GDPR, and FCRA). You affirm that the information provided is truthful and relates directly to your own identity or an identity for which you hold legal power of attorney.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-200 mb-2">5. Limitation of Liability</h2>
            <p>Under no circumstances shall D31337m3, its operators, or affiliates be held liable for any indirect, incidental, consequential, special, or exemplary damages arising from your use of the platform. The platform is provided "AS IS" and "AS AVAILABLE". We are not responsible for the reappearance of data, data broker proliferation, or damages arising from exposed PII.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-200 mb-2">6. Subscriptions and Cancellation</h2>
            <p>All subscription charges are non-refundable unless legally mandated by your jurisdiction. You may cancel your subscription at any time through the billing portal; however, active removal monitoring will cease immediately upon the expiration of your current billing period. Re-subscribing may require a new initial ingestion scan.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
