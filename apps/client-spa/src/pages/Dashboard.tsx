import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, Activity, Globe, Trash2, Search, 
  LogOut, Settings, Bell, ExternalLink, AlertTriangle
} from 'lucide-react';

interface SummaryData {
  totalLinks: number;
  negativeLinks: number;
  dataBrokerLinks: number;
  completedOptOuts: number;
  pendingOptOuts: number;
  legalDocsSent: number;
  visibilityRiskIndex: number;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const token = localStorage.getItem('d31337m3_token');
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'removals'>('overview');

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Auth failed');
      return res.json();
    }
  });

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await fetch('/api/orm/dashboard-summary', { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    }
  });

  const { data: keywords } = useQuery({
    queryKey: ['keywords'],
    queryFn: async () => {
      const res = await fetch('/api/orm/keywords', { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    }
  });

  const { data: tasks } = useQuery({
    queryKey: ['opt-out-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/orm/opt-out-tasks', { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    }
  });

  const addKeyword = useMutation({
    mutationFn: async (keyword: string) => {
      const res = await fetch('/api/orm/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keyword })
      });
      if (!res.ok) throw new Error('Failed to add keyword');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['keywords'] })
  });

  const handleLogout = () => {
    localStorage.removeItem('d31337m3_token');
    window.location.href = '/';
  };

  const riskColor = summary && summary.visibilityRiskIndex >= 70 ? 'text-red-400' 
                  : summary && summary.visibilityRiskIndex >= 40 ? 'text-amber-400' 
                  : 'text-green-400';

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-surface flex flex-col">
        <div className="p-6 border-b border-border flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyber-cyan" />
          <span className="font-black text-lg">D3<span className="text-cyber-cyan">1337</span>m3</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'overview', icon: <Activity className="w-4 h-4"/>, label: 'Overview' },
            { id: 'keywords', icon: <Search className="w-4 h-4"/>, label: 'Monitored Keywords' },
            { id: 'removals', icon: <Trash2 className="w-4 h-4"/>, label: 'Removal Tasks' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === item.id 
                  ? 'bg-cyber-cyan/10 text-cyber-cyan font-medium' 
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.fullName || user?.email}</p>
              <p className="text-xs text-zinc-500 truncate">{user?.subscription?.tier || 'Free'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-red-400 transition-colors w-full">
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-10">
          <h1 className="font-bold text-lg capitalize">{activeTab}</h1>
          <div className="flex items-center gap-4">
            <button className="text-zinc-400 hover:text-zinc-100"><Bell className="w-5 h-5"/></button>
            <button className="text-zinc-400 hover:text-zinc-100"><Settings className="w-5 h-5"/></button>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-8">
          
          {activeTab === 'overview' && (
            <>
              {/* Risk Index Banner */}
              <div className="cyber-card flex items-center justify-between border-cyber-cyan/30">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-1">Visibility Risk Index</h2>
                  <div className={`text-5xl font-black font-mono ${riskColor}`}>
                    {summary?.visibilityRiskIndex || 0}
                    <span className="text-2xl text-zinc-600">/100</span>
                  </div>
                </div>
                <div className="w-24 h-24 rounded-full border-4 border-surface relative flex items-center justify-center">
                  <div className={`absolute inset-0 rounded-full border-4 ${riskColor} opacity-20`} />
                  <AlertTriangle className={`w-8 h-8 ${riskColor}`} />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: 'Exposed Links', val: summary?.totalLinks || 0, icon: <Globe/> },
                  { label: 'Data Brokers Found', val: summary?.dataBrokerLinks || 0, icon: <AlertTriangle className="text-amber-400"/> },
                  { label: 'Negative Sentiment', val: summary?.negativeLinks || 0, icon: <Activity className="text-red-400"/> },
                  { label: 'Pending Opt-outs', val: summary?.pendingOptOuts || 0, icon: <Search/> },
                  { label: 'Successful Removals', val: summary?.completedOptOuts || 0, icon: <Trash2 className="text-green-400"/> },
                  { label: 'Legal Docs Sent', val: summary?.legalDocsSent || 0, icon: <Shield className="text-cyber-purple"/> },
                ].map((s, i) => (
                  <div key={i} className="bg-surface border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">{s.icon}</div>
                      <span className="text-2xl font-bold font-mono">{s.val}</span>
                    </div>
                    <p className="text-sm text-zinc-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'keywords' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  id="newKw"
                  placeholder="Enter new keyword to track..." 
                  className="input-cyber max-w-md"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      addKeyword.mutate(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button className="btn-primary" onClick={() => {
                  const el = document.getElementById('newKw') as HTMLInputElement;
                  if (el.value) { addKeyword.mutate(el.value); el.value = ''; }
                }}>Add Keyword</button>
              </div>

              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-800/50 text-zinc-400">
                    <tr>
                      <th className="p-4 font-medium">Keyword</th>
                      <th className="p-4 font-medium">Engine</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium">Last Scan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {keywords?.map((kw: any) => (
                      <tr key={kw.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-medium text-zinc-200">{kw.keyword}</td>
                        <td className="p-4 capitalize">{kw.searchEngine}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono bg-green-500/10 text-green-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Active
                          </span>
                        </td>
                        <td className="p-4 text-zinc-500">{new Date(kw.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {!keywords?.length && (
                      <tr><td colSpan={4} className="p-8 text-center text-zinc-500">No keywords tracked yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'removals' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/50 text-zinc-400">
                  <tr>
                    <th className="p-4 font-medium">Broker</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Priority</th>
                    <th className="p-4 font-medium">Last Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks?.map((task: any) => (
                    <tr key={task.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-medium text-zinc-200">
                        {task.brokerName}
                        <a href={task.brokerUrl} target="_blank" rel="noreferrer" className="ml-2 text-zinc-600 hover:text-cyber-cyan">
                          <ExternalLink className="inline w-3 h-3" />
                        </a>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-mono ${
                          task.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                          task.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {task.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4">
                        {task.priority === 1 ? <span className="text-red-400 flex items-center gap-1"><Zap className="w-3 h-3"/> High</span> : 'Normal'}
                      </td>
                      <td className="p-4 text-zinc-500">{new Date(task.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!tasks?.length && (
                    <tr><td colSpan={4} className="p-8 text-center text-zinc-500">No removal tasks pending.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
