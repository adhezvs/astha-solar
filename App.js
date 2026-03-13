import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, query, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Plus, TrendingUp, Download, Trash2, QrCode, X, Phone, MessageCircle, Copy, Check } from 'lucide-react';

// --- Referral & App Identity Logic ---
const urlParams = new URLSearchParams(window.location.search);
const rawSiteName = urlParams.get('site') || 'Default-Customer';
const siteDisplayName = rawSiteName.replace(/-/g, ' '); // Makes "Deepak-Solar" look like "Deepak Solar"
const appId = `astha-${rawSiteName.toLowerCase().replace(/\s+/g, '-')}`;

const firebaseConfig = {
  apiKey: "AIzaSyAV3EU_Nx-3N0iYmGw6wegB8YUI6usGDdQ",
  authDomain: "astha-solar.firebaseapp.com",
  projectId: "astha-solar",
  storageBucket: "astha-solar.firebasestorage.app",
  messagingSenderId: "46017295569",
  appId: "1:46017295569:web:77798ee0259461ff8141f0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Sub-component: Native SVG Trend Chart ---
const TrendChart = ({ data }) => {
  const chartData = useMemo(() => {
    return [...data].reverse().slice(-7).map(d => parseFloat(d.unitsGenerated) || 0);
  }, [data]);

  if (chartData.length < 2) return null;

  const maxVal = Math.max(...chartData, 5);
  const width = 400; const height = 150; const padding = 20;
  const points = chartData.map((val, i) => {
    const x = (i / (chartData.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((val / maxVal) * (height - padding * 2) + padding);
    return { x, y };
  });

  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L ${points[points.length-1].x},${height} L ${points[0].x},${height} Z`;

  return (
    <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm mb-6">
      <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Weekly Trend</h2>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
        <defs><linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style={{stopColor:'#0ea5e9',stopOpacity:0.2}}/><stop offset="100%" style={{stopColor:'#0ea5e9',stopOpacity:0}}/></linearGradient></defs>
        <path d={areaPath} fill="url(#grad)" /><path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke="#0ea5e9" strokeWidth="3" />)}
      </svg>
    </div>
  );
};

const Logo = ({ className }) => (
  <svg viewBox="0 0 500 300" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M250 20 L270 80 L230 80 Z" fill="#F9A01B" />
    <path d="M140 200 C140 130 360 130 360 200 L140 200 Z" fill="#00B5E2" stroke="#000" strokeWidth="4" />
    <path d="M50 260 C150 220 350 220 450 260" stroke="#00B5E2" strokeWidth="8" fill="none" strokeLinecap="round" />
  </svg>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], meterReading: '' });
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const readingsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'readings');
    return onSnapshot(readingsRef, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReadings(data.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    }, () => setLoading(false));
  }, [user]);

  const processedData = useMemo(() => {
    const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((entry, i) => {
      const prev = i > 0 ? sorted[i-1] : null;
      const units = prev ? Math.max(0, parseFloat(entry.meterReading) - parseFloat(prev.meterReading)) : 0;
      return { ...entry, unitsGenerated: units.toFixed(2) };
    }).reverse();
  }, [readings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !formData.meterReading) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'readings'), {
      date: formData.date,
      meterReading: parseFloat(formData.meterReading),
      createdAt: serverTimestamp()
    });
    setFormData({ ...formData, meterReading: '' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Logo className="w-20 h-20 animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white border-b p-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <Logo className="w-10 h-10" />
          <div>
            <h1 className="text-sm font-black leading-none uppercase tracking-tighter">Astha Enterprises</h1>
            <p className="text-[8px] font-bold text-sky-500 uppercase tracking-widest mt-0.5">{siteDisplayName}</p>
          </div>
        </div>
        <button onClick={() => setShowQr(true)} className="p-2 bg-slate-100 rounded-lg"><QrCode className="w-5 h-5" /></button>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Support Card */}
        <div className="bg-white p-4 rounded-2xl border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-sky-100 p-2 rounded-full"><Phone className="w-4 h-4 text-sky-600" /></div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase">Support</p><p className="text-sm font-bold">+91 88666 40409</p></div>
          </div>
          <a href="https://wa.me/918866640409" className="p-2 bg-green-50 rounded-lg text-green-600"><MessageCircle className="w-4 h-4" /></a>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[32px] border space-y-4 shadow-sm">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Reading</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="date" className="p-4 rounded-2xl bg-slate-50 border font-bold" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            <input type="number" step="0.01" placeholder="Meter Reading" className="p-4 rounded-2xl bg-slate-50 border font-bold" value={formData.meterReading} onChange={e => setFormData({...formData, meterReading: e.target.value})} />
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest hover:bg-orange-600 transition-colors">
            <TrendingUp className="w-5 h-5" /> Save Data
          </button>
        </form>

        {/* Trend Chart */}
        {processedData.length > 1 && <TrendChart data={processedData} />}

        {/* History */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">History Log</h2>
          {processedData.map(item => (
            <div key={item.id} className="bg-white p-5 rounded-[28px] border flex items-center justify-between group">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">+{item.unitsGenerated}</span>
                  <span className="text-[8px] font-bold text-sky-500 uppercase">Units</span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{item.date} • RD: {item.meterReading}</p>
              </div>
              <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'readings', item.id))} className="p-2 text-slate-200 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </main>

      {/* Share Modal */}
      {showQr && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[48px] w-full max-w-sm text-center relative">
            <button onClick={() => setShowQr(false)} className="absolute right-8 top-8 p-2 bg-slate-50 rounded-full"><X className="w-4 h-4" /></button>
            <h3 className="text-xl font-black mb-6">Customer QR Code</h3>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?site=' + rawSiteName)}`} alt="QR" className="w-48 h-48 mx-auto mb-6 rounded-3xl border-8 border-slate-50" />
            <button onClick={() => {navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(()=>setCopied(false), 2000)}} className="w-full bg-slate-100 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
              {copied ? <Check className="w-4 h-4 text-green-500"/> : <Copy className="w-4 h-4"/>} {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
