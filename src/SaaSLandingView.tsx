import React, { useState } from 'react';
import { db, doc, setDoc, serverTimestamp } from './lib/firebase';
import { 
  Building2, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Globe, 
  Users, 
  ShieldCheck, 
  Zap, 
  Server, 
  Cpu 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SaaSLandingView() {
  const [formData, setFormData] = useState({
    companyName: '',
    subdomain: '',
    customDomain: '',
    adminEmail: '',
    adminWhatsapp: '',
    saudiCompany: '',
    primaryColor: 'hsl(142, 70%, 15%)', // Default emerald
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic Validation
    const cleanSubdomain = formData.subdomain.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanSubdomain || cleanSubdomain.length < 3) {
      setError('Subdomain must be at least 3 alphanumeric characters.');
      setLoading(false);
      return;
    }

    try {
      const tenantRef = doc(db, 'tenants', cleanSubdomain);
      
      const tenantData = {
        id: cleanSubdomain,
        name: formData.companyName.trim(),
        subdomain: cleanSubdomain,
        customDomain: formData.customDomain.trim().toLowerCase() || null,
        logoUrl: 'https://images.unsplash.com/photo-1591604129939-f1efa4d8f7ec?auto=format&fit=crop&q=80&w=200',
        primaryColor: formData.primaryColor,
        secondaryColor: 'hsl(45, 100%, 40%)', // Default gold
        whatsappNumber: formData.adminWhatsapp.trim(),
        email: formData.adminEmail.trim(),
        address: 'Makkah, Saudi Arabia',
        saudiCompany: formData.saudiCompany.trim() || formData.companyName.trim(),
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(tenantRef, tenantData);
      
      // Also register the operator admin profile in users
      // Note: Admin will link their account when they sign in with this email
      setSuccess(cleanSubdomain);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to onboard tenant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTenantUrl = (sub: string) => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `http://${window.location.host}?tenant=${sub}`;
    }
    return `https://${sub}.26i.uk`;
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] bg-emerald-900/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-amber-900/10 rounded-full blur-[120px]" />
      </div>

      <header className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <Building2 className="w-5 h-5 text-black" />
          </div>
          <span className="text-lg font-semibold tracking-wider">26i.uk</span>
        </div>
        <div className="flex gap-4">
          <a href={getTenantUrl('nei')} target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
            NEI Demo
          </a>
          <span className="opacity-20">|</span>
          <a href={getTenantUrl('hhtt')} target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">
            HHTT Demo
          </a>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Pitch / Marketing */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium tracking-wide text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" /> Autonomous B2B2C Multi-Tenant SaaS
          </div>
          
          <h1 className="text-5xl md:text-7xl font-light tracking-tight leading-none">
            Next-Gen <br/>
            <span className="italic font-serif font-normal text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-amber-200 to-amber-500">Umrah Operations</span> <br/>
            Scaled Instantly.
          </h1>

          <p className="text-base md:text-lg opacity-60 max-w-lg leading-relaxed font-light">
            Empower unlimited Umrah operators, agents, sub-agents, and pilgrims on a single unified multi-tenant platform. Complete with AI passport processing, visa workflow agents, and direct ERP sync.
          </p>

          <div className="grid grid-cols-2 gap-6 pt-6 max-w-md">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-medium">AI Agent Driven</h3>
              <p className="text-xs opacity-40">Automated passport OCR, flight selection, hotel proposals, and visa handling.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-medium">B2B2C Hierarchy</h3>
              <p className="text-xs opacity-40">Organize Operators, master agents, sub-agents, and direct end-users.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Server className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-medium">ERP Integration</h3>
              <p className="text-xs opacity-40">Automatic synchronization of leads, employee check-ins, and financial audits to Frappe.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-medium">Data Isolation</h3>
              <p className="text-xs opacity-40">Strict tenant isolation ensuring your records are strictly private and secure.</p>
            </div>
          </div>
        </div>

        {/* Onboarding Form */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-amber-500" />
          
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-medium tracking-tight">Operator Onboarding</h2>
                  <p className="text-xs opacity-40 uppercase tracking-widest mt-1">Initialize your SaaS tenant page in seconds</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-2xl flex items-center gap-2">
                      <Zap className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] opacity-40 uppercase tracking-widest">Company Name</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Al Safwa Travel" 
                        value={formData.companyName}
                        onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-white/30 outline-none transition-all placeholder:opacity-20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] opacity-40 uppercase tracking-widest">Subdomain ID</label>
                      <div className="flex items-center">
                        <input 
                          required
                          type="text" 
                          placeholder="e.g. alsafwa" 
                          value={formData.subdomain}
                          onChange={e => setFormData({ ...formData, subdomain: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-l-xl px-4 py-3 text-sm focus:border-white/30 outline-none transition-all placeholder:opacity-20"
                        />
                        <span className="bg-white/5 border border-l-0 border-white/10 rounded-r-xl px-3 py-3 text-xs opacity-50 font-mono">.26i.uk</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] opacity-40 uppercase tracking-widest">Saudi Registered Company Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Al Safwa Umrah & Hajj Services Co." 
                      value={formData.saudiCompany}
                      onChange={e => setFormData({ ...formData, saudiCompany: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-white/30 outline-none transition-all placeholder:opacity-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] opacity-40 uppercase tracking-widest">Custom Domain (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. www.alsafwatravel.com" 
                      value={formData.customDomain}
                      onChange={e => setFormData({ ...formData, customDomain: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-white/30 outline-none transition-all placeholder:opacity-20"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] opacity-40 uppercase tracking-widest">Admin Email</label>
                      <input 
                        required
                        type="email" 
                        placeholder="admin@yourcompany.com" 
                        value={formData.adminEmail}
                        onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-white/30 outline-none transition-all placeholder:opacity-20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] opacity-40 uppercase tracking-widest">Admin WhatsApp Number</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. 966500000000" 
                        value={formData.adminWhatsapp}
                        onChange={e => setFormData({ ...formData, adminWhatsapp: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-white/30 outline-none transition-all placeholder:opacity-20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] opacity-40 uppercase tracking-widest">Primary Brand Theme</label>
                    <select 
                      value={formData.primaryColor}
                      onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-white/30 outline-none transition-all"
                    >
                      <option value="hsl(142, 70%, 15%)">Spiritual Emerald (Green)</option>
                      <option value="hsl(220, 80%, 20%)">Royal Ocean (Blue)</option>
                      <option value="hsl(260, 60%, 20%)">Luxury Amethyst (Purple)</option>
                      <option value="hsl(35, 90%, 20%)">Imperial Gold (Amber)</option>
                    </select>
                  </div>

                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full py-4 bg-white text-black hover:bg-zinc-200 transition-all font-bold text-xs uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Creating Tenant System...' : (
                      <>
                        Launch Operator Platform <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-6"
              >
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-medium tracking-tight">Onboarding Complete!</h2>
                  <p className="text-sm opacity-60">Your multi-tenant portal is successfully provisioned and ready.</p>
                </div>

                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-2 max-w-sm mx-auto">
                  <p className="text-[10px] opacity-40 uppercase tracking-widest">Your Private Platform Link</p>
                  <a 
                    href={getTenantUrl(success)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-400 font-mono text-sm underline flex items-center justify-center gap-1 hover:text-emerald-300 transition-colors"
                  >
                    {success}.26i.uk <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setSuccess(null)}
                    className="text-xs uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                  >
                    Register Another Operator
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-12 border-t border-white/5 text-center text-xs opacity-40">
        © {new Date().getFullYear()} 26i.uk. Built for Global Umrah Management.
      </footer>
    </div>
  );
}
