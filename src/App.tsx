/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import React, { useState, useEffect, useRef } from 'react';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/error-handler';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  setDoc,
  doc, 
  deleteDoc,
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  collectionGroup,
  limit
} from 'firebase/firestore';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle,
  Camera, 
  Plane, 
  CreditCard, 
  CheckCircle2, 
  Loader2, 
  Upload, 
  Trash2,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronDown,
  LogOut,
  MapPin,
  MessageCircle,
  Printer,
  Share2,
  ExternalLink,
  ShieldCheck,
  Phone,
  Zap,
  Instagram,
  Facebook,
  Twitter,
  Globe,
  Image as ImageIcon,
  Mic,
  Square,
  Send,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { Booking, BookingStatus, PassportData, AgentStates, TripProposal, Office, Tenant } from './types';
import SaaSLandingView from './SaaSLandingView';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Subdomain Helper for multi-tenancy
const getSubdomain = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const params = new URLSearchParams(window.location.search);
    return params.get('tenant') || null;
  }
  const parts = hostname.split('.');
  if (parts.length > 2) {
    const sub = parts[0];
    if (sub === 'www' || sub === '26i') return null;
    return sub;
  }
  return null;
};

let COMPANY_NAME = 'Insight Travel & Tourism';
let COMPANY_LOGO_URL = '';
let COMPANY_ADDRESS = 'Insight Building, Makkah';
let COMPANY_WEBSITE = 'https://itt.sa';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userTenantId, setUserTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [view, setView] = useState<'landing' | 'onboarding' | 'processing' | 'confirmed' | 'management' | 'staff'>('landing');
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [adminVoucherView, setAdminVoucherView] = useState<Booking | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const subdomain = getSubdomain();

  // Dynamic Branding Configuration
  COMPANY_NAME = tenant ? tenant.name : 'Insight Travel & Tourism';
  COMPANY_LOGO_URL = tenant ? tenant.logoUrl || '' : '';
  COMPANY_ADDRESS = tenant ? tenant.address || 'Insight Building, Makkah' : 'Insight Building, Makkah';
  COMPANY_WEBSITE = tenant ? `https://${tenant.subdomain}.26i.uk` : 'https://itt.sa';

  const isSuperAdmin = userRole === 'superadmin' || user?.email === 'ihtsourcing@gmail.com';
  const isOperatorAdmin = userRole === 'operator_admin' && userTenantId === subdomain;
  const isAdmin = isSuperAdmin || isOperatorAdmin;

  const handleSignIn = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error("Auth Error:", error);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Seed default tenants and load current tenant config
  useEffect(() => {
    const seedAndLoadTenant = async () => {
      // Seed default tenants if they do not exist
      const tenantsToSeed = [
        {
          id: 'nei',
          name: 'NEI Umrah Services',
          subdomain: 'nei',
          logoUrl: 'https://images.unsplash.com/photo-1591604129939-f1efa4d8f7ec?auto=format&fit=crop&q=80&w=200',
          primaryColor: 'hsl(142, 70%, 15%)',
          secondaryColor: 'hsl(45, 100%, 40%)',
          whatsappNumber: '966500000000',
          address: 'NEI Building, Makkah',
          saudiCompany: 'NEI Umrah Operators Ltd',
          isActive: true
        },
        {
          id: 'hhtt',
          name: 'HHTT Hajj & Umrah',
          subdomain: 'hhtt',
          logoUrl: 'https://images.unsplash.com/photo-1564769662533-4f00a87b4056?auto=format&fit=crop&q=80&w=200',
          primaryColor: 'hsl(220, 80%, 20%)',
          secondaryColor: 'hsl(35, 90%, 50%)',
          whatsappNumber: '966511111111',
          address: 'HHTT Tower, Madinah',
          saudiCompany: 'HHTT Pilgrimage Services',
          isActive: true
        }
      ];

      for (const t of tenantsToSeed) {
        try {
          await setDoc(doc(db, 'tenants', t.id), t, { merge: true });
        } catch (e) {
          console.warn("Seeding error:", e);
        }
      }

      if (!subdomain) {
        setTenant(null);
        setTenantLoading(false);
        return;
      }

      // Read active tenant config
      const docRef = doc(db, 'tenants', subdomain);
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setTenant({ id: docSnap.id, ...docSnap.data() } as Tenant);
        } else {
          setTenant(null);
        }
        setTenantLoading(false);
      }, (err) => {
        console.error("Tenant Snapshot error:", err);
        setTenant(null);
        setTenantLoading(false);
      });
    };

    seedAndLoadTenant();
  }, [subdomain]);

  // Load Offices
  useEffect(() => {
    if (!subdomain) return;
    const q = query(
      collection(db, 'offices'), 
      where('isActive', '==', true), 
      where('tenantId', '==', subdomain)
    );
    return onSnapshot(q, (snapshot) => {
      setOffices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Office)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'offices');
    });
  }, [subdomain]);

  // Load user profile & bookings on auth changes
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Sync/Create User Profile in db
        const userRef = doc(db, 'users', u.uid);
        onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUserRole(data.role || 'user');
            setUserTenantId(data.tenantId || null);
          } else {
            const defaultRole = u.email === 'ihtsourcing@gmail.com' ? 'superadmin' : 'user';
            setDoc(userRef, {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName || '',
              role: defaultRole,
              tenantId: subdomain || 'default',
              createdAt: serverTimestamp()
            }, { merge: true }).then(() => {
              setUserRole(defaultRole);
              setUserTenantId(subdomain || 'default');
            });
          }
        });

        // Filter bookings by tenant ID & user ID
        const q = query(
          collection(db, 'bookings'), 
          where('userId', '==', u.uid),
          where('tenantId', '==', subdomain || 'default'),
          orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const latest = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Booking;
            setCurrentBooking(latest);
            if (latest.status === BookingStatus.PROCESSING || latest.status === BookingStatus.PROPOSING) setView('processing');
            if (latest.status === BookingStatus.CONFIRMED) setView('confirmed');
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        });
        return () => unsubscribe();
      } else {
        setUserRole(null);
        setUserTenantId(null);
      }
      setLoading(false);
    });
  }, [subdomain]);

  // Set brand CSS custom properties
  useEffect(() => {
    if (tenant) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor || 'hsl(142, 70%, 15%)');
      document.documentElement.style.setProperty('--color-secondary', tenant.secondaryColor || 'hsl(45, 100%, 40%)');
    } else {
      document.documentElement.style.setProperty('--color-primary', 'hsl(142, 70%, 15%)');
      document.documentElement.style.setProperty('--color-secondary', 'hsl(45, 100%, 40%)');
    }
  }, [tenant]);

  // Render main app loader
  if (loading || tenantLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white font-sans">
      <Loader2 className="w-8 h-8 animate-spin opacity-50" />
    </div>
  );

  // If no subdomain / tenant configured, render SaaS landing view
  if (!subdomain) {
    return <SaaSLandingView />;
  }

  // If subdomain page is accessed but tenant doesn't exist, show 404
  if (!tenant) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white font-sans space-y-4 p-6 text-center">
        <h1 className="text-4xl font-light font-serif text-amber-500">Tenant Not Found</h1>
        <p className="opacity-50 text-sm max-w-sm">The subdomain "{subdomain}" is not registered on the 26i.uk platform.</p>
        <a href={window.location.protocol + '//' + window.location.host.split('.').slice(-2).join('.')} className="px-6 py-2 border border-white/20 hover:border-white/60 rounded-full text-xs uppercase tracking-widest transition-all">
          Go to Platform Home
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      <SocialWidget />
      <AnimatePresence mode="wait">
        {view === 'landing' && !user ? (
          <div key="landing">
            <LandingView onLogin={() => setView('onboarding')} />
          </div>
        ) : (
          <div className="relative">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden">
                    {COMPANY_LOGO_URL ? (
                      <img src={COMPANY_LOGO_URL} alt={COMPANY_NAME} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Plane className="w-4 h-4 text-black transform -rotate-45" />
                    )}
                  </div>
                  <span className="text-sm font-medium tracking-widest uppercase">{COMPANY_NAME}</span>
                </div>
              <div className="flex items-center gap-6">
                {isAdmin && (
                  <div className="flex gap-4 border-r border-white/10 pr-6">
                    <button 
                      onClick={() => setView('management')}
                      className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all px-4 py-1.5 rounded-full border ${view === 'management' ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:border-white/50 hover:text-white'}`}
                    >
                      Admin Dashboard
                    </button>
                  </div>
                )}
                {user && (
                  <button 
                    onClick={() => setView('staff')}
                    className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all px-4 py-1.5 rounded-full border ${view === 'staff' ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:border-white/50 hover:text-white'}`}
                  >
                    Staff Portal
                  </button>
                )}
                {user ? (
                  <button 
                    onClick={() => auth.signOut()}
                    className="text-[11px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2"
                  >
                    {user.displayName} <LogOut className="w-3 h-3" />
                  </button>
                ) : (
                  <button 
                    onClick={handleSignIn}
                    disabled={isAuthenticating}
                    className="text-[11px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity disabled:opacity-20"
                  >
                    {isAuthenticating ? 'Signing In...' : 'Sign In'}
                  </button>
                )}
              </div>
            </header>

            <main className="pt-24 min-h-screen">
              {view === 'landing' && <LandingView onLogin={() => setView('onboarding')} />}
              {view === 'onboarding' && <OnboardingView user={user} setView={setView} onSignIn={handleSignIn} isAuthenticating={isAuthenticating} tenantId={subdomain} />}
              {view === 'processing' && (
                user ? <ProcessingView booking={currentBooking} /> : <div className="flex items-center justify-center h-full">Please sign in to view status</div>
              )}
              {view === 'confirmed' && (
                user ? <ConfirmedView booking={currentBooking} setView={setView} onBack={() => setView('landing')} /> : <div className="flex items-center justify-center h-full text-[10px] uppercase tracking-widest opacity-40">Please sign in to view voucher</div>
              )}
              {view === 'management' && (
                adminVoucherView ? (
                  <div className="pt-20">
                    <button 
                      onClick={() => setAdminVoucherView(null)}
                      className="no-print fixed top-8 left-8 z-[60] text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity flex items-center gap-2"
                    >
                      <ChevronRight className="w-3 h-3 rotate-180" /> Back to Dashboard
                    </button>
                    <ConfirmedView booking={adminVoucherView} setView={() => {}} onBack={() => setAdminVoucherView(null)} />
                  </div>
                ) : (
                  <ManagementDashboard onViewVoucher={(b) => setAdminVoucherView(b)} user={user} tenantId={subdomain} />
                )
              )}
              {view === 'staff' && (
                user ? <StaffPortal user={user} tenantId={subdomain} /> : <div className="flex items-center justify-center h-full">Please sign in for Staff Portal</div>
              )}
            </main>

            {/* Live Support FAB */}
            <button 
              onClick={() => setShowSupportModal(true)}
              className="fixed bottom-8 right-8 z-[100] bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-2 group"
            >
              <MessageCircle className="w-6 h-6 fill-white" />
              <span className="max-w-0 overflow-hidden group-hover:max-w-[200px] transition-all duration-500 ease-in-out whitespace-nowrap text-[10px] font-bold uppercase tracking-widest pl-0 group-hover:pl-2">
                Live Support
              </span>
            </button>

            {/* Support Selection Modal */}
            <AnimatePresence>
              {showSupportModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowSupportModal(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 overflow-hidden"
                  >
                    <div className="mb-8">
                      <h3 className="text-xl font-medium tracking-tight mb-1">Live Support</h3>
                      <p className="text-[10px] opacity-40 uppercase tracking-widest">Connect with our support team</p>
                    </div>

                    <div className="space-y-3">
                      {offices.length === 0 && (
                        <p className="text-xs opacity-50 py-4 text-center border border-dashed border-white/10 rounded-2xl">Establishing global office link...</p>
                      )}
                      {offices.map((office) => (
                        <a 
                          key={office.id}
                          href={`https://wa.me/${office.whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all group"
                        >
                          <div>
                            <p className="text-sm font-medium">{office.name} Office</p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ))}
                    </div>

                    <button 
                      onClick={() => setShowSupportModal(false)}
                      className="mt-8 w-full py-4 text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                    >
                      Close
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SocialWidget() {
  return (
    <div className="fixed left-6 bottom-8 z-[100] flex flex-col gap-4">
      <a href="https://itt.sa" target="_blank" rel="noopener noreferrer" className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-white/30 transition-all group relative">
        <Globe className="w-5 h-5 opacity-40 group-hover:opacity-100" />
        <span className="absolute left-full ml-4 px-2 py-1 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">itt.sa</span>
      </a>
      <a href="#" className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-white/30 transition-all group relative">
        <Instagram className="w-5 h-5 opacity-40 group-hover:opacity-100" />
        <span className="absolute left-full ml-4 px-2 py-1 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Instagram</span>
      </a>
      <a href="#" className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-white/30 transition-all group relative">
        <Facebook className="w-5 h-5 opacity-40 group-hover:opacity-100" />
        <span className="absolute left-full ml-4 px-2 py-1 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Facebook</span>
      </a>
    </div>
  );
}

function BIInquiry({ bookings, leads, financials }: { bookings: any[], leads: any[], financials: any[] }) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioChunks = useRef<Blob[]>([]);

  const startStreamingBI = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) return;

    setIsLoading(true);
    setResponse('');
    
    try {
      const dataSummary = {
        bookingsCount: bookings.length,
        leadsCount: leads.length,
        confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
        totalRevenue: bookings.filter(b => b.status === 'confirmed').reduce((acc, curr) => acc + (curr.proposals?.[curr.selectedProposal]?.sellingPrice || 0), 0),
        totalMargin: bookings.filter(b => b.status === 'confirmed').reduce((acc, curr) => {
          const prop = curr.proposals?.[curr.selectedProposal];
          return acc + ((prop?.sellingPrice || 0) - (prop?.buyingPrice || 0));
        }, 0),
        financialEntries: financials.length
      };

      const systemInstruction = `You are a CEO Business Intelligence Assistant for ${COMPANY_NAME}. 
      Use the following real-time data to answer inquiries accurately. 
      Data: ${JSON.stringify(dataSummary)}
      Be concise, professional, and focus on growth and operational efficiency.
      If the user asks about specific offices, groups the data by region if possible.`;

      const result = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: finalPrompt,
        config: { systemInstruction }
      });

      for await (const chunk of result) {
        setResponse(prev => prev + (chunk.text || ''));
      }
    } catch (err) {
      console.error(err);
      setResponse("Error analyzing business data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          handleVoiceInquiry(base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or error occurred.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceInquiry = async (base64Audio: string) => {
    setIsLoading(true);
    setResponse('Transcribing and analyzing voice note...');
    
    try {
      const dataSummary = {
        bookingsCount: bookings.length,
        leadsCount: leads.length,
        confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
        totalRevenue: bookings.filter(b => b.status === 'confirmed').reduce((acc, curr) => acc + (curr.proposals?.[curr.selectedProposal]?.sellingPrice || 0), 0),
        totalMargin: bookings.filter(b => b.status === 'confirmed').reduce((acc, curr) => {
          const prop = curr.proposals?.[curr.selectedProposal];
          return acc + ((prop?.sellingPrice || 0) - (prop?.buyingPrice || 0));
        }, 0)
      };

      const systemInstruction = `You are a CEO Business Intelligence Assistant for ${COMPANY_NAME}. 
      Analyze the attached voice note and answer the inquiry using the provided business data.
      Data: ${JSON.stringify(dataSummary)}
      Be concise and professional.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "audio/webm", data: base64Audio } },
            { text: "Identify the CEO's question in this voice note and answer it using the business data provided. Tell the CEO what you heard first then provide the data-backed answer." }
          ]
        },
        config: { systemInstruction }
      });

      setResponse(result.text || "I couldn't process the voice note.");
    } catch (err) {
      setResponse("Error processing voice inquiry.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-white text-black rounded-2xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-medium tracking-tight">CEO BI Inquiry</h3>
            <p className="text-[10px] opacity-40 uppercase tracking-widest leading-none">Inquire via text or voice note</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="How's our conversion rate? What's the total revenue across all offices?"
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 pr-24 h-32 focus:border-white/30 transition-all outline-none resize-none text-sm placeholder:opacity-20"
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 animate-pulse outline outline-4 outline-red-500/20' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
              title={isRecording ? "Stop Recording" : "Voice Inquiry"}
            >
              {isRecording ? <Square className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 opacity-50" />}
            </button>
            <button
              onClick={() => startStreamingBI()}
              disabled={isLoading || !prompt.trim()}
              className="p-3 bg-white text-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              title="Send Prompt"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-transparent opacity-50" />
            <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-widest opacity-40">
              <BarChart3 className="w-3 h-3" /> Business Insight
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-xs leading-relaxed opacity-80 whitespace-pre-wrap">{response}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StaffPortal({ user, tenantId }: { user: User, tenantId: string }) {
  const [checkins, setCheckins] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [staffType, setStaffType] = useState<'field' | 'international'>('field');
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'employee_checkins'),
      where('uid', '==', user.uid),
      where('tenantId', '==', tenantId),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setCheckins(data);
      if (data.length > 0) {
        setLastAction(data[0].action);
      }
    });
  }, [user.uid, tenantId]);

  const handleAction = async (action: 'check-in' | 'check-out') => {
    setIsChecking(true);
    try {
      let location = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch (e) {
        console.warn("Geolocation failed", e);
      }

      const checkinData = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || 'Staff Member',
        type: staffType,
        action,
        location,
        erpStatus: 'pending',
        tenantId,
        timestamp: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'employee_checkins'), checkinData);

      // Sync to ERP in background
      fetch('/api/sync-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          checkinData: {
            ...checkinData,
            timestamp: new Date().toISOString() // Real timestamp for ERP
          } 
        })
      }).then(res => res.json()).then(res => {
        if (res.status === 'success') {
          updateDoc(docRef, { erpStatus: 'synced' });
        } else {
          updateDoc(docRef, { erpStatus: 'failed' });
        }
      });

    } catch (error) {
      console.error("Check-in Error:", error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto p-6 space-y-12"
    >
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto bg-white/5 border border-white/10 rounded-full flex items-center justify-center">
          <ShieldCheck className="w-10 h-10 opacity-40 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-light tracking-tight italic">Operations Portal</h2>
          <p className="text-[10px] opacity-40 uppercase tracking-[0.3em]">Staff Attendance & Logistics</p>
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-8 space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] opacity-40 uppercase tracking-widest pl-1">Deployment Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setStaffType('field')}
              className={`py-3 text-[10px] uppercase font-bold tracking-widest rounded-xl border transition-all ${staffType === 'field' ? 'bg-white text-black border-white' : 'border-white/10 text-white/40'}`}
            >
              Field Staff
            </button>
            <button 
              onClick={() => setStaffType('international')}
              className={`py-3 text-[10px] uppercase font-bold tracking-widest rounded-xl border transition-all ${staffType === 'international' ? 'bg-white text-black border-white' : 'border-white/10 text-white/40'}`}
            >
              International
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button 
            disabled={isChecking || lastAction === 'check-in'}
            onClick={() => handleAction('check-in')}
            className="group py-8 bg-zinc-900 border border-white/10 rounded-3xl hover:border-white/40 disabled:opacity-20 transition-all flex flex-col items-center justify-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Clock In</p>
              <p className="text-[9px] opacity-40 uppercase tracking-widest">Start Shift</p>
            </div>
          </button>

          <button 
            disabled={isChecking || lastAction === 'check-out' || !lastAction}
            onClick={() => handleAction('check-out')}
            className="group py-8 bg-zinc-900 border border-white/10 rounded-3xl hover:border-white/40 disabled:opacity-20 transition-all flex flex-col items-center justify-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform text-red-500">
              <LogOut className="w-6 h-6 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Clock Out</p>
              <p className="text-[9px] opacity-40 uppercase tracking-widest">End Shift</p>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[10px] opacity-40 uppercase tracking-widest pl-1">Recent Activity</p>
        <div className="space-y-2">
          {checkins.map(c => (
            <div key={c.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${c.action === 'check-in' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-xs font-medium uppercase tracking-tight">{c.action}</p>
                  <p className="text-[9px] opacity-40 uppercase tracking-widest">{format(c.timestamp?.toDate ? c.timestamp.toDate() : new Date(), 'MMM dd, HH:mm')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.erpStatus === 'synced' && <ShieldCheck className="w-3 h-3 text-blue-400 opacity-40" title="Synced to ERP Payroll" />}
                <span className="text-[8px] opacity-20 uppercase tracking-widest">{c.type}</span>
              </div>
            </div>
          ))}
          {checkins.length === 0 && (
            <p className="text-center py-8 text-[10px] opacity-20 uppercase tracking-widest border border-dashed border-white/10 rounded-2xl">No recent logs found</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LandingView({ onLogin }: { onLogin: () => any }) {
  const wonders = [
    { name: "Makkah", desc: "Masjid al-Haram", img: "https://images.unsplash.com/photo-1591604129939-f1efa4d8f7ec" },
    { name: "Madinah", desc: "Masjid an-Nabawi", img: "https://images.unsplash.com/photo-1564769662533-4f00a87b4056" },
    { name: "Taj Mahal", desc: "Agra, India", img: "https://images.unsplash.com/photo-1564507592333-c60657eea223" },
    { name: "Petra", desc: "Jordan", img: "https://images.unsplash.com/photo-1580992332614-f55201b1bad4" },
    { name: "Colosseum", desc: "Rome, Italy", img: "https://images.unsplash.com/photo-1552832230-c0197dd311b5" },
    { name: "Great Wall", desc: "China", img: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d" },
    { name: "Machu Picchu", desc: "Peru", img: "https://images.unsplash.com/photo-1587593810167-a84920ea0781" },
    { name: "Chichen Itza", desc: "Mexico", img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23" },
    { name: "Christ the Redeemer", desc: "Brazil", img: "https://images.unsplash.com/photo-1587132137056-bfbf0166836e" }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-black"
    >
      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1591604129939-f1efa4d8f7ec" 
            className="w-full h-full object-cover opacity-40 scale-110 blur-sm animate-pulse" 
            alt="Makkah" 
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black" />
        </div>
        
        <div className="relative z-10 space-y-8">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            {COMPANY_LOGO_URL ? (
              <img src={COMPANY_LOGO_URL} alt={COMPANY_NAME} className="w-24 h-24 mx-auto object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-[10px] uppercase tracking-[0.6em] font-light space-y-1">
                <div>Insight</div>
                <div>Travel &</div>
                <div>Tourism</div>
              </div>
            )}
          </motion.div>
          
          <motion.h1 
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-6xl md:text-[10vw] font-light tracking-tighter leading-none"
          >
            THE<br/><span className="italic font-serif">JOURNEY</span>
          </motion.h1>
          
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="max-w-xl mx-auto text-sm md:text-base opacity-40 uppercase tracking-[0.4em] leading-relaxed font-light"
          >
            Spiritual excellence in every step. Automated by {COMPANY_NAME}.
          </motion.p>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="pt-8"
          >
            <button 
              onClick={onLogin}
              className="px-16 py-5 bg-white text-black text-xs font-bold uppercase tracking-[0.4em] rounded-full hover:scale-105 active:scale-95 transition-all shadow-2xl"
            >
              Begin Pilgrimage
            </button>
          </motion.div>
        </div>

        <div className="absolute bottom-12 left-0 right-0 flex justify-center animate-bounce opacity-20">
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* Wonders Grid */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="mb-20 space-y-4">
          <h2 className="text-sm uppercase tracking-[0.5em] opacity-30">Global Experience</h2>
          <h3 className="text-4xl md:text-6xl font-light italic font-serif">The World's Wonders</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wonders.map((wonder, idx) => (
            <motion.div 
              key={wonder.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="group relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-zinc-900 border border-white/5"
            >
              <img 
                src={wonder.img} 
                alt={wonder.name} 
                className="w-full h-full object-cover opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700 blur-[2px] group-hover:blur-0" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-10 left-10 space-y-1">
                <p className="text-[10px] uppercase tracking-widest opacity-50">{wonder.desc}</p>
                <h4 className="text-2xl font-light tracking-tight">{wonder.name}</h4>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="py-32 bg-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
          <h2 className="text-4xl md:text-6xl font-light tracking-tight leading-tight">
            We bridge the gap between <span className="italic opacity-50 underline underline-offset-8">ancient traditions</span> and modern logistics.
          </h2>
          <p className="text-sm opacity-40 uppercase tracking-[0.3em] leading-relaxed max-w-2xl mx-auto">
            Insight Travel & Tourism is a pioneer in AI-driven Umrah planning, ensuring every pilgrim focuses on their spiritual connection while we handle the world.
          </p>
          <div className="pt-8">
            <button 
              onClick={onLogin}
              className="px-12 py-4 border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all"
            >
              Plan Your Trip
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5 text-center">
        <div className="opacity-10 mb-8 flex justify-center gap-12 grayscale">
            <Plane className="w-8 h-8" />
            <ShieldCheck className="w-8 h-8" />
            <Globe className="w-8 h-8" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.5em] opacity-20">
          © {new Date().getFullYear()} {COMPANY_NAME}
        </p>
      </footer>
    </motion.div>
  );
}

function MainActionView({ setView }: { setView: (v: any) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          onClick={() => setView('onboarding')}
          className="group relative h-[400px] border border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:border-white/30 transition-all bg-zinc-900/40 p-8 flex flex-col justify-between"
        >
          <div>
            <Zap className="w-10 h-10 mb-6 text-white" />
            <h2 className="text-4xl font-light tracking-tight mb-2">Instant Booking</h2>
            <p className="text-sm opacity-50 leading-relaxed">Passport photo + Date. Our agents handle the visa, flights, and logistics in real-time.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            Start Journey <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div className="border border-white/10 rounded-3xl p-8 bg-zinc-900/20 flex flex-col justify-center gap-6 opacity-50 grayscale pointer-events-none">
          <ShieldCheck className="w-10 h-10" />
          <h2 className="text-4xl font-light tracking-tight">VIP Concierge</h2>
          <p className="text-sm">Personal AI assistant for ground logistics and rituals guidance. Coming Soon.</p>
        </div>
      </div>
    </motion.div>
  );
}

function OnboardingView({ user, setView, onSignIn, isAuthenticating, tenantId }: { user: User | null, setView: (v: any) => void, onSignIn: () => Promise<void>, isAuthenticating: boolean, tenantId: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [region, setRegion] = useState<string>('Middle East');
  const [duration, setDuration] = useState<'1 Week' | '2 Weeks' | '4 Weeks'>('2 Weeks');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<PassportData | null>(null);
  const [passportBase64, setPassportBase64] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // IP-based location capture (No permission prompt)
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.latitude && data.longitude) {
          setLocation({ latitude: data.latitude, longitude: data.longitude });
          console.log("IP-based location captured:", data.city, data.country_name);
        }
      })
      .catch(err => console.warn("IP-based location failed", err));
  }, []);

  const syncToERP = async (leadData: any) => {
    try {
      const response = await fetch('/api/sync-erp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadData })
      });
      return await response.json();
    } catch (e) {
      console.error("ERP Sync Client Error", e);
      return { status: 'error' };
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setExtractedData(null);
    setPassportBase64(null);
    setErrorMsg(null);

    if (selectedFile) {
      setIsAnalyzing(true);
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });
        reader.readAsDataURL(selectedFile);
        const base64Data = await base64Promise;
        setPassportBase64(base64Data);

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              parts: [
                { text: "Extract passport information from this image. Return JSON with fields: fullName, passportNumber, expiryDate (YYYY-MM-DD), nationality, dob (YYYY-MM-DD). Ensure all dates are in YYYY-MM-DD format." },
                { inlineData: { data: base64Data, mimeType: selectedFile.type } }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                fullName: { type: Type.STRING },
                passportNumber: { type: Type.STRING },
                expiryDate: { type: Type.STRING },
                nationality: { type: Type.STRING },
                dob: { type: Type.STRING }
              }
            }
          }
        });

        const data = JSON.parse(response.text) as PassportData;
        
        // Basic date validation
        const expiry = new Date(data.expiryDate);
        if (isNaN(expiry.getTime())) {
          throw new Error("Invalid date format in extracted passport data.");
        }

        setExtractedData(data);
      } catch (err: any) {
        console.error("OCR Error:", err);
        setErrorMsg("Could not extract data from passport. Please ensure the photo is clear and try again.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleStart = async () => {
    if (!file || !date || !whatsapp || !email || !extractedData) {
      setErrorMsg("Please provide all required information and ensure passport is correctly processed.");
      return;
    }
    setIsUploading(true);
    setErrorMsg(null);
    
    try {
      const leadPayload = {
        email,
        whatsapp,
        region,
        duration,
        departureDate: date,
        location,
        status: user ? 'converted' : 'new',
        passportData: extractedData,
        passportImage: passportBase64, // Storing base64 for 'leads DocType'
        tenantId: tenantId || 'default',
        timestamp: serverTimestamp(),
        chatHistory: [
          { role: 'user', content: `Inquiry for ${duration} Umrah trip starting ${date}. Passport attached for ${extractedData.fullName}.`, timestamp: new Date().toISOString() },
          { role: 'assistant', content: `Passport verified for ${extractedData.fullName}. Scouting live availability and preparing proposals...`, timestamp: new Date().toISOString() }
        ]
      };

      const leadRef = await addDoc(collection(db, 'leads'), leadPayload);
      
      syncToERP(leadPayload).then(res => {
        if (res.status === 'success') {
          updateDoc(leadRef, { erpStatus: 'synced' });
        } else {
          updateDoc(leadRef, { erpStatus: 'failed' });
        }
      });

      if (!user) {
        await onSignIn();
        setIsUploading(false);
        return; 
      }

      // Check passport validity (100 days)
      const expiry = new Date(extractedData.expiryDate);
      const today = new Date();
      const isAdminEmail = user?.email === 'ihtsourcing@gmail.com';
      if (!isAdminEmail && differenceInDays(expiry, today) < 100) {
        throw new Error(`Passport validity error: Your passport expires on ${extractedData.expiryDate}. Saudi regulations require at least 100 days validity from today.`);
      }

      const booking: Booking = {
        userId: user.uid,
        userEmail: user.email || email,
        userWhatsapp: whatsapp,
        region: region,
        duration: duration,
        status: BookingStatus.PROCESSING,
        departureDate: date,
        passportData: extractedData,
        tenantId: tenantId || 'default',
        agentStates: {
          ocrAgent: 'done',
          visaAgent: 'working',
          flightAgent: 'working',
          hotelAgent: 'working'
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'bookings'), booking).catch(e => handleFirestoreError(e, OperationType.CREATE, 'bookings'));
      if (!docRef) return;
      
      await addDoc(collection(db, 'bookings', docRef.id, 'logs'), {
        userId: user.uid,
        agentName: 'OCR Agent',
        message: `Passport of ${extractedData.fullName} verified successfully.`,
        status: 'success',
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'bookings', docRef.id, 'logs'), {
        userId: user.uid,
        agentName: 'Visa Agent',
        message: 'Application data captured. Awaiting manual MOFA submission.',
        status: 'working',
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        bookingId: docRef.id,
        type: 'new_booking',
        message: `New trip inquiry from ${user.displayName || extractedData.fullName} (+${whatsapp})`,
        customerEmail: user.email,
        tenantId: tenantId || 'default',
        timestamp: serverTimestamp()
      });

      setView('processing');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || "Verification failed. Please try a clearer image of your passport.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-xl mx-auto p-6"
    >
      <div className="space-y-12">
        <section>
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[10px] w-6 h-6 rounded-full border border-white/20 flex items-center justify-center">01</span>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-50">Logistics Info</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] opacity-40 uppercase tracking-widest pl-1">Departure Date</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 pb-4 text-2xl font-light focus:outline-none focus:border-white transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] opacity-40 uppercase tracking-widest pl-1">WhatsApp Number</label>
              <input 
                type="tel" 
                placeholder="Country Code + Number"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 pb-4 text-2xl font-light focus:outline-none focus:border-white transition-colors"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <div className="space-y-2">
              <label className="text-[10px] opacity-40 uppercase tracking-widest pl-1">Email Address</label>
              <input 
                type="email" 
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 pb-4 text-2xl font-light focus:outline-none focus:border-white transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] opacity-40 uppercase tracking-widest pl-1">Trip Duration</label>
              <select 
                value={duration}
                onChange={(e) => setDuration(e.target.value as any)}
                className="w-full bg-transparent border-b border-white/20 pb-4 text-2xl font-light focus:outline-none focus:border-white transition-colors appearance-none"
              >
                <option value="1 Week" className="bg-black">1 Week</option>
                <option value="2 Weeks" className="bg-black">2 Weeks</option>
                <option value="4 Weeks" className="bg-black">4 Weeks</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[10px] w-6 h-6 rounded-full border border-white/20 flex items-center justify-center">02</span>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-50">Passport Document</h3>
          </div>
          
          <div 
            className={`border-2 border-dashed rounded-[2rem] p-4 transition-all ${file ? 'border-white bg-white/5' : 'border-white/10'}`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
              accept="image/*"
            />
            {file ? (
              <div className="flex flex-col items-center gap-4 py-8">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-12 h-12 text-white animate-spin opacity-20" />
                    <p className="text-[10px] uppercase tracking-widest opacity-40">AI Analyzing Passport...</p>
                  </div>
                ) : extractedData ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full space-y-4"
                  >
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">Passport Detailed</p>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest">Document OCR Complete</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                        <p className="text-[8px] opacity-30 uppercase tracking-widest">Full Name</p>
                        <p className="text-[11px] font-medium truncate">{extractedData.fullName}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] opacity-30 uppercase tracking-widest">Passport No.</p>
                        <p className="text-[11px] font-mono">{extractedData.passportNumber}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] opacity-30 uppercase tracking-widest">Nationality</p>
                        <p className="text-[11px] font-medium">{extractedData.nationality}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] opacity-30 uppercase tracking-widest">Expiry Date</p>
                        <p className={`text-[11px] font-medium ${differenceInDays(new Date(extractedData.expiryDate), new Date()) < 100 ? 'text-red-500' : ''}`}>
                          {extractedData.expiryDate}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => { setFile(null); setExtractedData(null); }}
                      className="w-full py-2 text-[8px] uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity"
                    >
                      Use Different Document
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-12 h-12 text-white mb-2" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-[10px] opacity-50 uppercase tracking-widest cursor-pointer hover:underline" onClick={() => { setFile(null); setExtractedData(null); }}>Remove and try again</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute('capture', 'environment');
                      fileInputRef.current.click();
                    }
                  }}
                  className="flex flex-col items-center gap-4 p-8 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6 opacity-50" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Use Camera</p>
                    <p className="text-[9px] opacity-40 uppercase tracking-widest">Capture Passport Now</p>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                    }
                  }}
                  className="flex flex-col items-center gap-4 p-8 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-6 h-6 opacity-50" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Open Gallery</p>
                    <p className="text-[9px] opacity-40 uppercase tracking-widest">Select from Device</p>
                  </div>
                </button>
              </div>
            )}
          </div>
          {location && (
            <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-full w-fit mx-auto">
              <MapPin className="w-3 h-3 text-green-500" />
              <span className="text-[9px] uppercase tracking-widest opacity-50">Location captured via IP</span>
            </div>
          )}
        </section>

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-200/80 leading-relaxed font-medium">
              {errorMsg}
            </p>
          </motion.div>
        )}

        <button 
          disabled={!file || !date || isUploading || isAuthenticating || !extractedData || isAnalyzing}
          onClick={handleStart}
          className="w-full py-6 bg-white text-black text-xs font-bold uppercase tracking-[0.4em] rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Initializing Agents
            </>
          ) : isAuthenticating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            'Process Booking'
          )}
        </button>
      </div>
    </motion.div>
  );
}

function ProcessingView({ booking }: { booking: Booking | null }) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!booking?.id || !auth.currentUser) return;
    const q = query(
      collection(db, 'bookings', booking.id, 'logs'), 
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `bookings/${booking.id}/logs`);
    });
    return () => unsubscribe();
  }, [booking?.id]);

  // Simulate agent logic over time
  useEffect(() => {
    if (!booking?.id || booking.status !== BookingStatus.PROCESSING) return;

    const timer = setTimeout(async () => {
      // Visa Status is now Manual Support for now
      if (booking.agentStates.visaAgent === 'working') {
        const docRef = doc(db, 'bookings', booking.id!);
        await updateDoc(docRef, {
          'agentStates.visaAgent': 'done', // Marked done for data flow, but status is 'Pending'
          'visa.status': 'Pending',
          updatedAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `bookings/${booking.id}`));
        
        await addDoc(collection(db, 'bookings', booking.id!, 'logs'), {
          userId: booking.userId,
          agentName: 'OCR Expert',
          message: 'Passport and eligibility verified. Initiating live inventory scouting on Booking.com and Almosafer...',
          status: 'success',
          timestamp: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, `bookings/${booking.id}/logs`));
      }
    }, 4000);

    const timer2 = setTimeout(async () => {
      // Logic for Agents proposing overall trip options
      if (booking.agentStates.flightAgent === 'working') {
        const depDate = new Date(booking.departureDate);
        const durationWeeks = parseInt(booking.duration || '1') || 1;
        
        // Simple logic for Makkah/Madinah split
        const makkahNights = durationWeeks === 1 ? 3 : durationWeeks === 2 ? 7 : 14;
        const madinahNights = durationWeeks === 1 ? 3 : durationWeeks === 2 ? 7 : 14;

        const makkahCheckIn = addDays(depDate, 0); // Arrive and go to Makkah
        const makkahCheckOut = addDays(makkahCheckIn, makkahNights);
        
        const madinahCheckIn = makkahCheckOut;
        const madinahCheckOut = addDays(madinahCheckIn, madinahNights);

        const proposals: TripProposal[] = [
          { 
            id: 'prop_01',
            label: 'The Spiritual Fast-Track',
            flight: { 
              outbound: { flightNumber: 'SV-733', airline: 'Saudi Arabian Airlines', sector: 'LHE-JED', departure: booking.departureDate + ' 18:05', arrival: booking.departureDate + ' 21:50' },
              inbound: { flightNumber: 'SV-738', airline: 'Saudi Arabian Airlines', sector: 'JED-LHE', departure: format(madinahCheckOut, 'yyyy-MM-dd') + ' 17:20', arrival: format(madinahCheckOut, 'yyyy-MM-dd') + ' 23:55' }
            },
            makkahHotel: { 
              name: 'Makkah Clock Tower Raffles', 
              stars: 5, 
              distanceToHaram: '0m',
              checkIn: format(makkahCheckIn, 'yyyy-MM-dd'),
              checkOut: format(makkahCheckOut, 'yyyy-MM-dd'),
              confirmNo: '1194622'
            },
            madinahHotel: { 
              name: 'Oberoi Madinah', 
              stars: 5, 
              distanceToHaram: '50m',
              checkIn: format(madinahCheckIn, 'yyyy-MM-dd'),
              checkOut: format(madinahCheckOut, 'yyyy-MM-dd'),
              confirmNo: '1194625'
            },
            transport: { name: 'VIP GMC Yukon XL', type: 'Private GMC', brn: 'BRN-' + Math.random().toString(36).substring(7).toUpperCase() },
            buyingPrice: 1850 + 133,
            sellingPrice: 2450 + 133 
          },
          { 
            id: 'prop_02',
            label: 'The Balanced Path',
            flight: { 
              outbound: { flightNumber: 'SV-733', airline: 'Saudi Airlines', sector: 'LHE-JED', departure: booking.departureDate + ' 18:00', arrival: booking.departureDate + ' 21:30' },
              inbound: { flightNumber: 'SV-738', airline: 'Saudi Airlines', sector: 'JED-LHE', departure: format(madinahCheckOut, 'yyyy-MM-dd') + ' 17:00', arrival: format(madinahCheckOut, 'yyyy-MM-dd') + ' 23:30' }
            },
            makkahHotel: { 
              name: 'Hilton Convention Makkah', 
              stars: 5, 
              distanceToHaram: '150m',
              checkIn: format(makkahCheckIn, 'yyyy-MM-dd'),
              checkOut: format(makkahCheckOut, 'yyyy-MM-dd'),
              confirmNo: '1194722'
            },
            madinahHotel: { 
              name: 'Anwar Al Madinah Movenpick', 
              stars: 5, 
              distanceToHaram: '100m',
              checkIn: format(madinahCheckIn, 'yyyy-MM-dd'),
              checkOut: format(madinahCheckOut, 'yyyy-MM-dd'),
              confirmNo: '1194825'
            },
            transport: { name: 'Private Lexus LS', type: 'Private Lexus', brn: 'BRN-' + Math.random().toString(36).substring(7).toUpperCase() },
            buyingPrice: 1550 + 133,
            sellingPrice: 1980 + 133 
          },
          { 
            id: 'prop_03',
            label: 'The Serene Walk',
            flight: { 
              outbound: { flightNumber: 'SV-733', airline: 'Saudi Arabian Airlines', sector: 'LHE-JED', departure: booking.departureDate + ' 18:05', arrival: booking.departureDate + ' 21:50' },
              inbound: { flightNumber: 'SV-738', airline: 'Saudi Arabian Airlines', sector: 'JED-LHE', departure: format(madinahCheckOut, 'yyyy-MM-dd') + ' 17:20', arrival: format(madinahCheckOut, 'yyyy-MM-dd') + ' 23:55' }
            },
            makkahHotel: { 
              name: 'Swissotel Al Maqam Makkah', 
              stars: 5, 
              distanceToHaram: '50m',
              checkIn: format(makkahCheckIn, 'yyyy-MM-dd'),
              checkOut: format(makkahCheckOut, 'yyyy-MM-dd'),
              confirmNo: '1194222'
            },
            madinahHotel: { 
              name: 'Madinah Hilton', 
              stars: 5, 
              distanceToHaram: '150m',
              checkIn: format(madinahCheckIn, 'yyyy-MM-dd'),
              checkOut: format(madinahCheckOut, 'yyyy-MM-dd'),
              confirmNo: '1194325'
            },
            transport: { name: 'Business Class Van', type: 'Shared Van', brn: 'BRN-' + Math.random().toString(36).substring(7).toUpperCase() },
            buyingPrice: 1250 + 133,
            sellingPrice: 1650 + 133 
          }
        ];

        const docRef = doc(db, 'bookings', booking.id!);
        await updateDoc(docRef, {
          'agentStates.flightAgent': 'done',
          'agentStates.hotelAgent': 'done',
          status: BookingStatus.PROPOSING,
          proposals: proposals,
          updatedAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `bookings/${booking.id}`));
        
        await addDoc(collection(db, 'bookings', booking.id!, 'logs'), {
          userId: booking.userId,
          agentName: 'Logistics AI',
          message: 'Aggregated real-time inventory from Almosafer and Booking.com for the entire group.',
          status: 'success',
          timestamp: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, `bookings/${booking.id}/logs`));
      }
    }, 7000);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [booking?.id, booking?.status, booking?.agentStates?.visaAgent, booking?.agentStates?.flightAgent, booking?.departureDate]);

  const selectProposal = async (index: number) => {
    if (!booking?.id || !booking.proposals) return;
    const selected = booking.proposals[index];
    const docRef = doc(db, 'bookings', booking.id);
    
    await updateDoc(docRef, {
      selectedProposal: index,
      flight: selected.flight,
      makkahHotel: selected.makkahHotel,
      madinahHotel: selected.madinahHotel,
      transport: selected.transport,
      'agentStates.flightAgent': 'done',
      'agentStates.hotelAgent': 'done',
      status: BookingStatus.CONFIRMED,
      updatedAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `bookings/${booking.id}`));

    // Save financials for management
    await setDoc(doc(db, 'bookings', booking.id, 'financials', 'audit'), {
      bookingId: booking.id,
      region: booking.region || 'Unknown',
      buyingPrice: selected.buyingPrice,
      sellingPrice: selected.sellingPrice,
      margin: selected.sellingPrice - selected.buyingPrice,
      timestamp: serverTimestamp()
    }).catch(e => handleFirestoreError(e, OperationType.WRITE, `bookings/${booking.id}/financials/audit`));

    await addDoc(collection(db, 'bookings', booking.id, 'logs'), {
      userId: booking.userId,
      agentName: 'Logistics Engine',
      message: `User confirmed "${selected.label}" package. Finalizing all service vouchers.`,
      status: 'success',
      timestamp: serverTimestamp()
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, `bookings/${booking.id}/logs`));
  };

  if (!booking) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto p-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-12">
          {booking.status === BookingStatus.PROPOSING ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <h2 className="text-4xl font-light tracking-tighter mb-2 italic">Select Priority</h2>
                <p className="text-[10px] opacity-40 uppercase tracking-[0.2em]">Our GDS engine found 3 optimized routes</p>
              </div>
              <div className="grid gap-4">
                {booking.proposals?.map((p, i) => (
                  <div 
                    key={i}
                    onClick={() => selectProposal(i)}
                    className="p-6 rounded-3xl border border-white/5 bg-zinc-900/40 hover:border-white/20 transition-all cursor-pointer group flex items-center justify-between gap-6"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{p.label}</p>
                        <span className="h-1 w-1 rounded-full bg-white/20" />
                        <span className="text-[10px] text-white/60">★ {p.makkahHotel.stars} Stars</span>
                      </div>
                      <h3 className="text-xl font-medium tracking-tight mb-1">{p.label}</h3>
                      <div className="space-y-1 mb-4">
                        <p className="text-[10px] opacity-60">Makkah Stay: {p.makkahHotel.name} (★{p.makkahHotel.stars})</p>
                        <p className="text-[10px] opacity-60">Madinah Stay: {p.madinahHotel.name} (★{p.madinahHotel.stars})</p>
                        <p className="text-[10px] opacity-50">{p.transport.name}</p>
                      </div>
                      
                      <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest opacity-30">
                        <div className="flex items-center gap-1"><Plane className="w-3 h-3" /> {p.flight.outbound.airline}</div>
                        <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.flight.outbound.sector}</div>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-2xl font-light tracking-tighter mb-1">${p.sellingPrice}</p>
                      <span className="px-4 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div>
              <h2 className="text-6xl font-light tracking-tighter mb-4 italic">Orchestrating...</h2>
              <div className="flex items-center gap-3 text-xs uppercase tracking-widest opacity-50">
                <Loader2 className="w-3 h-3 animate-spin" />
                Multi-Agent Synchronization in Progress
              </div>
            </div>
          )}

          <div className="space-y-4">
            {logs.map((log) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={log.id} 
                className="p-4 rounded-2xl border border-white/5 bg-zinc-900/20 flex gap-4 items-start"
              >
                <div className={`mt-1 h-2 w-2 rounded-full ${log.status === 'success' ? 'bg-white' : 'bg-white/20 animate-pulse'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{log.agentName}</span>
                    <span className="text-[10px] opacity-20">{log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm:ss') : 'Just now'}</span>
                  </div>
                  <p className="text-sm opacity-80">{log.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="p-6 rounded-3xl border border-white/10 bg-zinc-900/20">
            <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-6">Agent Mesh Status</h4>
            <div className="space-y-6">
              <StatusItem label="Passport Verification (OCR)" status={booking.agentStates.ocrAgent} />
              <StatusItem label="Scouting Almosafer Flights" status={booking.agentStates.flightAgent} />
              <StatusItem label="Hotel Scouting (Booking.com)" status={booking.agentStates.hotelAgent} />
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-white/10 bg-zinc-900/10">
            <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-4">Passport Identified</h4>
            <div className="space-y-4 opacity-100">
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">Name</p>
                <p className="text-sm">{booking.passportData?.fullName}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">Number</p>
                <p className="text-sm tracking-tighter">{booking.passportData?.passportNumber}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatusItem({ label, status }: { label: string, status: string }) {
  const isWorking = status === 'working';
  const isDone = status === 'done';

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-light tracking-wide opacity-80">{label}</span>
      <div className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold ${isDone ? 'bg-white text-black' : isWorking ? 'border border-white/40 text-white animate-pulse' : 'border border-white/20 opacity-30'}`}>
        {isWorking ? 'Processing' : isDone ? 'Verified' : 'Wait'}
      </div>
    </div>
  );
}

function ManagementDashboard({ onViewVoucher, user, tenantId }: { onViewVoucher: (b: any) => void, user: User | null, tenantId: string | null }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [staffLogs, setStaffLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'bookings' | 'leads' | 'offices' | 'inquiry' | 'staff'>('bookings');
  const [newOffice, setNewOffice] = useState({ name: '', region: '', whatsappNumber: '' });
  const [isAddingOffice, setIsAddingOffice] = useState(false);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [erpHealth, setErpHealth] = useState<'checking' | 'online' | 'offline'>('checking');

  const isSuperAdmin = user?.email === 'ihtsourcing@gmail.com';
  const isAdmin = isSuperAdmin || (user !== null); // Active staff/admin can view if logged in

  useEffect(() => {
    if (!isAdmin) return;

    // Check ERP Connectivity
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setErpHealth(data.erpStatus === 'online' ? 'online' : 'offline'))
      .catch(() => setErpHealth('offline'));

    // Helpers to create queries depending on Super Admin status
    const getTenantQuery = (colName: string) => {
      const colRef = collection(db, colName);
      if (isSuperAdmin) return query(colRef);
      return query(colRef, where('tenantId', '==', tenantId || 'default'));
    };

    const qB = getTenantQuery('bookings');
    const unsubscribeB = onSnapshot(qB, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setBookings(docs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));

    const qL = getTenantQuery('leads');
    const unsubscribeL = onSnapshot(qL, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setLeads(docs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'leads'));

    const qN = getTenantQuery('notifications');
    const unsubscribeN = onSnapshot(qN, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setNotifications(docs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    const qS = getTenantQuery('employee_checkins');
    const unsubscribeS = onSnapshot(qS, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setStaffLogs(docs.slice(0, 50));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'employee_checkins'));

    const qO = getTenantQuery('offices');
    const unsubscribeO = onSnapshot(qO, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Office));
      docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOffices(docs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'offices'));

    // Fetch financials across all bookings
    const qF = query(collectionGroup(db, 'financials'));
    const unsubscribeF = onSnapshot(qF, (snapshot) => {
      // Filter out files that don't belong to the active tenant in case of non-superadmin
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = isSuperAdmin ? docs : docs.filter((f: any) => f.tenantId === (tenantId || 'default'));
      filtered.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setFinancials(filtered);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'financials_group'));

    return () => {
      unsubscribeB();
      unsubscribeL();
      unsubscribeN();
      unsubscribeS();
      unsubscribeO();
      unsubscribeF();
    };
  }, [isAdmin, isSuperAdmin, tenantId]);

  const marginsByRegion = financials.reduce((acc: any, f) => {
    const region = f.region || 'Other';
    if (!acc[region]) acc[region] = { revenue: 0, cost: 0, margin: 0, count: 0 };
    acc[region].revenue += f.sellingPrice || 0;
    acc[region].cost += f.buyingPrice || 0;
    acc[region].margin += f.margin || 0;
    acc[region].count += 1;
    return acc;
  }, {});

  const handleAddOffice = async () => {
    if (!newOffice.name || !newOffice.whatsappNumber) return;
    setIsAddingOffice(true);
    await addDoc(collection(db, 'offices'), {
      ...newOffice,
      tenantId: tenantId || 'default',
      isActive: true,
      createdAt: serverTimestamp()
    });
    setNewOffice({ name: '', region: '', whatsappNumber: '' });
    setIsAddingOffice(false);
  };

  const toggleOffice = async (id: string, current: boolean) => {
    await updateDoc(doc(db, 'offices', id), { isActive: !current });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-12">
          {/* Header Section */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-light tracking-tighter mb-1 uppercase">Operations Center</h1>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-[10px] opacity-40 uppercase tracking-[0.3em]">Global Logistics & Support Mesh</p>
                <div className="flex items-center gap-2 px-2 py-0.5 bg-white/5 rounded-full border border-white/10">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${erpHealth === 'online' ? 'bg-green-500' : erpHealth === 'offline' ? 'bg-red-500' : 'bg-zinc-500'}`} />
                  <span className="text-[8px] uppercase tracking-widest opacity-60">Bench: {erpHealth}</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 flex gap-8">
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest mb-1">Leads</p>
                <p className="text-xl font-light">{leads.length}</p>
              </div>
              <div className="border-l border-white/10" />
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest mb-1">Total Users</p>
                <p className="text-xl font-light">{bookings.length}</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-8 border-b border-white/10">
            {['bookings', 'leads', 'staff', 'offices', 'inquiry'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`pb-4 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                {tab === 'staff' ? 'Staff Records' : tab}
                {activeTab === tab && (
                  <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                )}
              </button>
            ))}
          </div>

          {activeTab === 'staff' && (
            <div className="bg-zinc-900/20 border border-white/10 rounded-[2.5rem] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/40">
                  <tr>
                    <th className="p-6">Employee</th>
                    <th className="p-6">Type / Action</th>
                    <th className="p-6">Location</th>
                    <th className="p-6 text-right">ERP Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {staffLogs.map(log => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-6">
                        <p className="text-sm font-medium">{log.name}</p>
                        <p className="text-[10px] opacity-40">{log.email}</p>
                        <p className="text-[9px] opacity-20 uppercase tracking-widest mt-1">
                          {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'PPP, HH:mm:ss') : 'Just now'}
                        </p>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase tracking-widest font-bold">{log.type}</span>
                          <span className={`text-[8px] px-2 py-0.5 rounded-full uppercase tracking-widest w-fit border ${log.action === 'check-in' ? 'border-green-500/30 text-green-500' : 'border-red-500/30 text-red-500'}`}>
                            {log.action}
                          </span>
                        </div>
                      </td>
                      <td className="p-6">
                        {log.location ? (
                          <div className="flex items-center gap-2 text-[10px] opacity-60">
                            <MapPin className="w-3 h-3" />
                            <span>{log.location.latitude.toFixed(4)}, {log.location.longitude.toFixed(4)}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] opacity-20 italic">No GPS</span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                        <span className={`text-[8px] uppercase tracking-widest font-bold ${log.erpStatus === 'synced' ? 'text-blue-400' : log.erpStatus === 'failed' ? 'text-red-500' : 'opacity-40'}`}>
                          {log.erpStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {staffLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center opacity-30 uppercase tracking-[0.2em] text-[10px]">No staff logs recorded yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'bookings' && (
            <>
              {/* Global Analytics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-8 rounded-[2.5rem] border border-white/5 bg-zinc-900/40 space-y-2">
                  <p className="text-[10px] opacity-40 uppercase tracking-widest leading-none">Gross Revenue</p>
                  <p className="text-3xl font-light font-mono text-green-500">
                    ${bookings.filter(b => b.status === 'confirmed').reduce((acc, curr) => acc + (curr.proposals?.[curr.selectedProposal]?.sellingPrice || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-8 rounded-[2.5rem] border border-white/5 bg-zinc-900/40 space-y-2">
                  <p className="text-[10px] opacity-40 uppercase tracking-widest leading-none">Net Margin</p>
                  <p className="text-3xl font-light font-mono text-blue-400">
                    ${bookings.filter(b => b.status === 'confirmed').reduce((acc, curr) => {
                      const prop = curr.proposals?.[curr.selectedProposal];
                      return acc + ((prop?.sellingPrice || 0) - (prop?.buyingPrice || 0));
                    }, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-8 rounded-[2.5rem] border border-white/5 bg-zinc-900/40 space-y-2">
                  <p className="text-[10px] opacity-40 uppercase tracking-widest leading-none">Conversion</p>
                  <p className="text-3xl font-light">
                    {leads.length > 0 ? ((bookings.filter(b => b.status === 'confirmed').length / leads.length) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="p-8 rounded-[2.5rem] border border-white/5 bg-zinc-900/40 space-y-2 text-right">
                  <p className="text-[10px] opacity-40 uppercase tracking-widest leading-none">Active Users</p>
                  <p className="text-3xl font-light">{bookings.length}</p>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-zinc-900/20 border border-white/10 rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/40">
                    <tr>
                      <th className="p-6">Customer</th>
                      <th className="p-6">Status</th>
                      <th className="p-6 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bookings.map(book => (
                      <tr key={book.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => deleteDoc(doc(db, 'bookings', book.id!))}
                              className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                            <div>
                              <p className="text-sm font-medium">{book.passportData?.fullName || 'Prospect'}</p>
                              <p className="text-[10px] opacity-40 uppercase tracking-tighter">{book.userEmail} • +{book.userWhatsapp}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => onViewVoucher(book)}
                              className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="View Voucher"
                            >
                              <ExternalLink className="w-4 h-4 text-white" />
                            </button>
                            <select 
                              value={book.status}
                              onChange={(e) => updateDoc(doc(db, 'bookings', book.id!), { status: e.target.value })}
                              className="bg-transparent text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/20 focus:outline-none"
                            >
                              <option value="pending" className="bg-black">Pending</option>
                              <option value="confirmed" className="bg-black">Confirmed</option>
                              <option value="cancelled" className="bg-black">Cancelled</option>
                            </select>
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          {book.status === 'confirmed' ? (
                            <p className="text-sm font-mono">${book.proposals?.[book.selectedProposal || 0]?.sellingPrice || '0'}</p>
                          ) : (
                            <p className="text-sm font-mono opacity-20">---</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'inquiry' && (
            <BIInquiry bookings={bookings} leads={leads} financials={financials} />
          )}

          {activeTab === 'leads' && (
            <div className="bg-zinc-900/20 border border-white/10 rounded-[2.5rem] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/40">
                  <tr>
                    <th className="p-6">Lead / Email</th>
                    <th className="p-6">Region / Duration / Date</th>
                    <th className="p-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leads.map(lead => (
                    <React.Fragment key={lead.id}>
                      <tr 
                        className={`hover:bg-white/5 transition-colors cursor-pointer group ${expandedLead === lead.id ? 'bg-white/5' : ''}`}
                        onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                      >
                        <td className="p-6">
                          <p className="text-sm font-medium">{lead.email}</p>
                          <p className="text-[10px] opacity-40 uppercase tracking-tighter">+{lead.whatsapp}</p>
                          {lead.passportData && (
                            <p className="text-[9px] text-blue-400 font-medium mt-1">
                              PP: {lead.passportData.passportNumber} • {lead.passportData.fullName}
                            </p>
                          )}
                          {lead.location && (
                            <p className="text-[8px] text-green-500/60 font-mono mt-1 flex items-center gap-1">
                              <MapPin className="w-2 h-2" /> {lead.location.latitude.toFixed(4)}, {lead.location.longitude.toFixed(4)}
                            </p>
                          )}
                        </td>
                        <td className="p-6">
                          <p className="text-xs">{lead.region} • {lead.duration}</p>
                          <p className="text-[10px] opacity-40 uppercase tracking-tighter">{lead.departureDate}</p>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <button 
                                onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'leads', lead.id!)); }}
                                className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                              <div className="flex flex-col gap-1">
                                <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest border ${lead.status === 'converted' ? 'border-blue-500/50 text-blue-500' : 'border-yellow-500/50 text-yellow-500'}`}>
                                  {lead.status}
                                </span>
                                {lead.erpStatus && (
                                  <span className={`text-[7px] text-center uppercase tracking-widest opacity-60 ${lead.erpStatus === 'synced' ? 'text-green-500' : lead.erpStatus === 'failed' ? 'text-red-500' : ''}`}>
                                    ERP: {lead.erpStatus}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 opacity-20 transition-transform ${expandedLead === lead.id ? 'rotate-180' : ''}`} />
                          </div>
                        </td>
                      </tr>
                      {expandedLead === lead.id && lead.chatHistory && (
                        <tr>
                          <td colSpan={3} className="p-0 bg-black/40">
                            <div className="p-8 space-y-4 border-l-2 border-white/20 ml-6 my-4">
                              <p className="text-[10px] opacity-40 uppercase tracking-widest mb-4">Conversation Transcript</p>
                              {lead.passportData && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-white/5">
                                  <div className="space-y-4">
                                    <p className="text-[10px] opacity-40 uppercase tracking-widest">Extracted Passport Data</p>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-[8px] opacity-30 uppercase tracking-widest">Full Name</p>
                                        <p className="text-sm">{lead.passportData.fullName}</p>
                                      </div>
                                      <div>
                                        <p className="text-[8px] opacity-30 uppercase tracking-widest">Passport No.</p>
                                        <p className="text-sm font-mono">{lead.passportData.passportNumber}</p>
                                      </div>
                                      <div>
                                        <p className="text-[8px] opacity-30 uppercase tracking-widest">Expiry</p>
                                        <p className="text-sm">{lead.passportData.expiryDate}</p>
                                      </div>
                                      <div>
                                        <p className="text-[8px] opacity-30 uppercase tracking-widest">Nationality</p>
                                        <p className="text-sm">{lead.passportData.nationality}</p>
                                      </div>
                                    </div>
                                  </div>
                                  {lead.passportImage && (
                                    <div>
                                      <p className="text-[10px] opacity-40 uppercase tracking-widest mb-2">Passport Document</p>
                                      <div className="aspect-[4/3] bg-black/40 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center group relative">
                                        <img 
                                          src={`data:image/jpeg;base64,${lead.passportImage}`} 
                                          className="w-full h-full object-cover opacity-50 hover:opacity-100 transition-opacity" 
                                          alt="Passport" 
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 pointer-events-none">
                                          <ImageIcon className="w-8 h-8 text-white/20" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {lead.chatHistory.map((chat: any, idx: number) => (
                                <div key={idx} className="space-y-1">
                                  <p className={`text-[9px] uppercase tracking-widest font-bold ${chat.role === 'assistant' ? 'text-blue-400' : 'text-zinc-500'}`}>
                                    {chat.role === 'assistant' ? 'AI Agent' : 'Customer'} • {new Date(chat.timestamp).toLocaleTimeString()}
                                  </p>
                                  <p className="text-xs opacity-70 leading-relaxed max-w-2xl">{chat.content}</p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-12 text-center opacity-30 uppercase tracking-[0.2em] text-[10px]">No leads recorded yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'offices' && (
            <div className="space-y-12">
              {/* Regional Offices Management */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-bold uppercase tracking-widest opacity-40">Regional Offices Registry</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Add Office Card */}
                  <div className="p-6 rounded-3xl border border-dashed border-white/10 bg-white/2 space-y-4">
                    <input 
                      placeholder="Office Name (e.g. Madinah)" 
                      value={newOffice.name}
                      onChange={e => setNewOffice({...newOffice, name: e.target.value})}
                      className="w-full bg-transparent border-b border-white/10 text-xs py-2 focus:outline-none focus:border-white transition-colors"
                    />
                    <input 
                      placeholder="Region (e.g. Saudi Arabia)" 
                      value={newOffice.region}
                      onChange={e => setNewOffice({...newOffice, region: e.target.value})}
                      className="w-full bg-transparent border-b border-white/10 text-xs py-2 focus:outline-none focus:border-white transition-colors"
                    />
                    <input 
                      placeholder="WhatsApp (e.g. 9665...)" 
                      value={newOffice.whatsappNumber}
                      onChange={e => setNewOffice({...newOffice, whatsappNumber: e.target.value})}
                      className="w-full bg-transparent border-b border-white/10 text-xs py-2 focus:outline-none focus:border-white transition-colors"
                    />
                    <button 
                      onClick={handleAddOffice}
                      disabled={isAddingOffice}
                      className="w-full py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-colors"
                    >
                      {isAddingOffice ? '...' : 'Register Office'}
                    </button>
                  </div>

                  {offices.map(o => (
                    <div key={o.id} className={`p-6 rounded-3xl border ${o.isActive ? 'border-white/10' : 'border-white/5 opacity-50'} bg-zinc-900/20 flex flex-col justify-between group`}>
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-sm font-medium">{o.name}</h3>
                          <div className="flex gap-2">
                             <button 
                              onClick={() => deleteDoc(doc(db, 'offices', o.id!))}
                              className="p-1 bg-red-500/10 border border-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                            <button onClick={() => toggleOffice(o.id!, o.isActive)} className={`text-[8px] px-2 py-0.5 rounded-full uppercase tracking-tighter ${o.isActive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                              {o.isActive ? 'Online' : 'Offline'}
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest">{o.region}</p>
                        <p className="text-xs font-mono mt-2 opacity-80">+{o.whatsappNumber}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <h2 className="text-xs font-bold uppercase tracking-widest opacity-40">System Alerts</h2>
          <div className="space-y-4">
            {notifications.map(notif => (
              <div key={notif.id} className="p-4 rounded-2xl border border-white/10 bg-zinc-900/40 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-white opacity-20" />
                 <p className="text-[10px] font-bold uppercase tracking-wider mb-1">{notif.type.replace('_', ' ')}</p>
                 <p className="text-xs opacity-70 mb-2 leading-relaxed">{notif.message}</p>
                 <p className="text-[10px] opacity-30">{notif.timestamp?.toDate ? format(notif.timestamp.toDate(), 'HH:mm') : 'now'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ConfirmedView({ booking, setView, onBack }: { booking: Booking | null, setView: (v: any) => void, onBack?: () => void }) {
  if (!booking) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Umrah Trip Voucher',
          text: `Trip summary for ${booking.passportData?.fullName}. Status: ${booking.status}`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      alert('Sharing is not supported on this device/browser.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-6 pb-24"
    >
      <div className="no-print flex justify-between items-center mb-8">
        <button 
          onClick={onBack || (() => setView('landing'))}
          className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity flex items-center gap-2"
        >
          <ChevronRight className="w-3 h-3 rotate-180" /> Dashboard
        </button>
        <div className="flex gap-4">
          <button onClick={handleShare} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={handlePrint} className="px-6 py-2 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Voucher
          </button>
        </div>
      </div>

      <div className="voucher-container bg-white text-black p-8 shadow-2xl relative border border-zinc-200">
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-zinc-100 p-2">
               <img src={COMPANY_LOGO_URL || "https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&q=80&w=200"} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tighter">{COMPANY_NAME}</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-black">Official Umrah Services</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-black text-white inline-block px-8 py-2 mb-2 font-bold uppercase text-lg tracking-widest">Hotel Voucher</div>
            <p className="text-[10px] font-mono opacity-50 uppercase">Voucher No: UB-{booking.id?.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>

        {/* Header Info */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-[11px]">
          <div className="space-y-2">
            <div className="flex border-b border-zinc-200 pb-1 text-black"><span className="w-32 opacity-50">IATA:</span> <span className="font-semibold">Insight Travel & Tourism</span></div>
            <div className="flex border-b border-zinc-200 pb-1 text-black"><span className="w-32 opacity-50">Saudi Company:</span> <span className="font-semibold">Insight Umrah Services</span></div>
            <div className="flex border-b border-zinc-200 pb-1 text-black"><span className="w-32 opacity-50">Package:</span> <span className="font-semibold">{booking.duration} Package</span></div>
            <div className="flex border-b border-zinc-200 pb-1 text-black"><span className="w-32 opacity-50">Family Head:</span> <span className="font-semibold">{booking.passportData?.fullName}</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex border-b border-zinc-200 pb-1 text-black"><span className="w-32 opacity-50">Branch:</span> <span className="font-semibold">{booking.region || 'LHE'}</span></div>
            <div className="flex border-b border-zinc-200 pb-1 text-black"><span className="w-32 opacity-50">Date:</span> <span className="font-semibold">{format(new Date(), 'dd/MM/yy')}</span></div>
            <div className="flex border-b border-zinc-200 pb-1 text-black"><span className="w-32 opacity-50">Total PAX:</span> <span className="font-semibold">1</span></div>
            <div className="flex border-b border-zinc-200 pb-1 text-black"><span className="w-32 opacity-50">Whatsapp:</span> <span className="font-semibold">{booking.userWhatsapp}</span></div>
          </div>
        </div>

        {/* Pilgrims Details */}
        <div className="mb-8">
          <h3 className="bg-zinc-100 text-[10px] font-bold uppercase tracking-widest py-2 px-4 text-center border-x border-t border-zinc-300">Pilgrims Details</h3>
          <table className="w-full text-left border-collapse border border-zinc-300 text-[10px]">
            <thead className="bg-zinc-50 border-b border-zinc-300">
              <tr>
                <th className="p-2 border-r border-zinc-300">Mutamer Name</th>
                <th className="p-2 border-r border-zinc-300">Gender</th>
                <th className="p-2 border-r border-zinc-300">PPNO</th>
                <th className="p-2 border-r border-zinc-300">PAX</th>
                <th className="p-2 border-r border-zinc-300">Beds</th>
                <th className="p-2 border-r border-zinc-300">Visa Number</th>
                <th className="p-2">PNR</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border-r border-zinc-300 font-semibold">{booking.passportData?.fullName}</td>
                <td className="p-2 border-r border-zinc-300">{booking.passportData?.gender || 'Male'}</td>
                <td className="p-2 border-r border-zinc-300 font-mono">{booking.passportData?.passportNumber}</td>
                <td className="p-2 border-r border-zinc-300">Adult</td>
                <td className="p-2 border-r border-zinc-300">Yes</td>
                <td className="p-2 border-r border-zinc-300">---</td>
                <td className="p-2 font-mono uppercase">{booking.flight?.outbound.flightNumber}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Accommodation Details */}
        <div className="mb-8">
          <h3 className="bg-zinc-100 text-[10px] font-bold uppercase tracking-widest py-2 px-4 text-center border-x border-t border-zinc-300">Accommodation Details</h3>
          <table className="w-full text-left border-collapse border border-zinc-300 text-[10px]">
            <thead className="bg-zinc-50 border-b border-zinc-300">
              <tr>
                <th className="p-2 border-r border-zinc-300">Hotel Name</th>
                <th className="p-2 border-r border-zinc-300">Confirm No</th>
                <th className="p-2 border-r border-zinc-300">City</th>
                <th className="p-2 border-r border-zinc-300">Room Type</th>
                <th className="p-2 border-r border-zinc-300">Check In</th>
                <th className="p-2 border-r border-zinc-300">Checkout</th>
                <th className="p-2">Nights</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border-r border-zinc-300 font-semibold">{booking.makkahHotel?.name}</td>
                <td className="p-2 border-r border-zinc-300 font-mono italic">{booking.makkahHotel?.confirmNo}</td>
                <td className="p-2 border-r border-zinc-300">Makkah</td>
                <td className="p-2 border-r border-zinc-300">1 Double Bed</td>
                <td className="p-2 border-r border-zinc-300 font-mono">{booking.makkahHotel?.checkIn}</td>
                <td className="p-2 border-r border-zinc-300 font-mono">{booking.makkahHotel?.checkOut}</td>
                <td className="p-2">{booking.makkahHotel?.checkIn && booking.makkahHotel?.checkOut ? differenceInDays(new Date(booking.makkahHotel.checkOut), new Date(booking.makkahHotel.checkIn)) : 0}</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-zinc-300 font-semibold">{booking.madinahHotel?.name}</td>
                <td className="p-2 border-r border-zinc-300 font-mono italic">{booking.madinahHotel?.confirmNo}</td>
                <td className="p-2 border-r border-zinc-300">Medinah</td>
                <td className="p-2 border-r border-zinc-300">1 Double Bed</td>
                <td className="p-2 border-r border-zinc-300 font-mono">{booking.madinahHotel?.checkIn}</td>
                <td className="p-2 border-r border-zinc-300 font-mono">{booking.madinahHotel?.checkOut}</td>
                <td className="p-2">{booking.madinahHotel?.checkIn && booking.madinahHotel?.checkOut ? differenceInDays(new Date(booking.madinahHotel.checkOut), new Date(booking.madinahHotel.checkIn)) : 0}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Transport */}
        <div className="mb-8 font-black">
          <h3 className="bg-zinc-100 text-[10px] font-bold uppercase tracking-widest py-2 px-4 text-center border-x border-t border-zinc-300">Transport / Services</h3>
          <table className="w-full text-left border-collapse border border-zinc-300 text-[10px]">
            <thead className="bg-zinc-50 border-b border-zinc-300">
              <tr>
                <th className="p-2 border-r border-zinc-300">Name</th>
                <th className="p-2 border-r border-zinc-300">Type</th>
                <th className="p-2">BRN</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border-r border-zinc-300 font-semibold">{booking.transport?.name}</td>
                <td className="p-2 border-r border-zinc-300">{booking.transport?.type}</td>
                <td className="p-2 font-mono uppercase opacity-50">{booking.transport?.brn}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Flights */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="bg-zinc-100 text-[10px] font-bold uppercase tracking-widest py-2 px-4 text-center border-x border-t border-zinc-300">Departure to KSA</h3>
            <table className="w-full text-left border-collapse border border-zinc-300 text-[10px]">
              <thead className="bg-zinc-50 border-b border-zinc-300">
                <tr>
                  <th className="p-2 border-r border-zinc-300">Flight</th>
                  <th className="p-2 border-r border-zinc-300">Sector</th>
                  <th className="p-2">Departure</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border-r border-zinc-300 font-black">{booking.flight?.outbound.flightNumber}</td>
                  <td className="p-2 border-r border-zinc-300">{booking.flight?.outbound.sector}</td>
                  <td className="p-2 font-mono">{booking.flight?.outbound.departure}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="bg-zinc-100 text-[10px] font-bold uppercase tracking-widest py-2 px-4 text-center border-x border-t border-zinc-300">Return flight to Pakistan</h3>
            <table className="w-full text-left border-collapse border border-zinc-300 text-[10px]">
              <thead className="bg-zinc-50 border-b border-zinc-300">
                <tr>
                  <th className="p-2 border-r border-zinc-300">Flight</th>
                  <th className="p-2 border-r border-zinc-300">Sector</th>
                  <th className="p-2">Departure</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border-r border-zinc-300 font-black">{booking.flight?.inbound.flightNumber}</td>
                  <td className="p-2 border-r border-zinc-300">{booking.flight?.inbound.sector}</td>
                  <td className="p-2 font-mono">{booking.flight?.inbound.departure}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 text-[10px] space-y-4 opacity-50 border-t border-zinc-100 pt-8 no-print">
          <p className="font-bold uppercase tracking-widest">Important Notes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Hotels are Non-changeable and Non-refundable.</li>
            <li>For male and female sharing, the accommodation will be gender wise.</li>
            <li>Self-accommodation passengers must contact for transport before 48 hours of their flight departure (KSA-PAK).</li>
          </ul>
        </div>
        
        <div className="mt-12 pt-8 border-t-2 border-black flex justify-between items-end">
           <div className="space-y-2">
             <div className="flex items-center gap-2"><Phone className="w-3 h-3"/> <span className="text-[10px] font-bold">+966 54 064 1456</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-600 rounded-sm"/> <span className="text-[10px] font-bold text-green-700">CHECKIN-TIME: 04:00 PM</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600 rounded-sm"/> <span className="text-[10px] font-bold text-red-700">CHECKOUT-TIME: 12:00 PM</span></div>
           </div>
           <div className="text-right">
             <div className="w-24 h-24 bg-white border border-zinc-200 p-2 ml-auto">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://itt.sa/verify/${booking.id}`} alt="QR" className="w-full h-full" />
             </div>
             <p className="text-[8px] font-bold uppercase mt-2">Scan to Verify</p>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

