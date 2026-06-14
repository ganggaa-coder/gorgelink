"use client";

import { useState, useEffect } from "react";
import { Download, Link as LinkIcon, AlertCircle, CheckCircle2, X, Sparkles, Server, ShieldCheck, Globe, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function isUrl(str: string) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function gatherLinks(obj: any, prefix = ''): { label: string, url: string }[] {
  const links: { label: string, url: string }[] = [];
  
  if (!obj) return links;

  if (typeof obj === 'string' && isUrl(obj)) {
    links.push({ label: prefix || 'Media Link', url: obj });
    return links;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      links.push(...gatherLinks(item, prefix));
    });
  } else if (typeof obj === 'object') {
    if (typeof obj.url === 'string' && isUrl(obj.url)) {
      let customLabel = prefix;
      if (obj.type) customLabel += ` [${obj.type}]`;
      if (obj.quality) customLabel += ` - ${obj.quality}`;
      if (obj.extension) customLabel += ` (.${obj.extension})`;
      
      links.push({ label: customLabel.trim() || 'Media', url: obj.url });
    }
    
    Object.entries(obj).forEach(([key, value]) => {
      if (key === 'url' && typeof value === 'string' && isUrl(value)) return;
      
      if (typeof value === 'string' && isUrl(value)) {
        const cleanKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        links.push({ label: `${prefix} ${cleanKey}`.trim(), url: value });
      } else if (typeof value === 'object') {
        const nextPrefix = prefix ? prefix : key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        links.push(...gatherLinks(value, nextPrefix));
      }
    });
  }
  return links;
}

function formatAndSortLinks(rawLinks: { label: string, url: string }[]) {
  let sourceUrl: any = null;
  let photo: any = null;
  let audio: any = null;
  let videos: any[] = [];
  let others: any[] = [];

  rawLinks.forEach((link) => {
    const url = link.url.toLowerCase();
    const label = link.label.toLowerCase();

    if ((url.includes('tiktok.com') || url.includes('instagram.com/reel')) && !url.includes('ies-music') && !url.includes('fbcdn')) {
      sourceUrl = { label: 'Source Media URL', url: link.url };
    } 
    else if (
      label.includes('[audio]') ||  
      label.includes('(.m4a)') ||   
      label.includes('(.mp3)') || 
      url.includes('.mp3') || 
      url.includes('.m4a') || 
      url.includes('audiotrack') || 
      url.includes('mime_type=audio') || 
      url.includes('ies-music.tiktokcdn')
    ) {
      if (!audio) audio = { label: 'Audio', url: link.url };
      else others.push(link);
    } 
    else if (
      label.includes('[video]') || 
      label.includes('(.mp4)') || 
      url.includes('.mp4') || 
      label.includes('video')
    ) {
      videos.push(link);
    }
    else if (
      url.includes('.jpg') || 
      url.includes('.png') || 
      url.includes('.jpeg') || 
      label.includes('thumbnail') || 
      label.includes('cover') || 
      label.includes('pic')
    ) {
      if (!photo) photo = { label: 'Thumbnail', url: link.url };
      else others.push(link);
    } 
    else {
      others.push(link);
    }
  });

  const sortedLinks: { label: string, url: string }[] = [];

  if (sourceUrl) sortedLinks.push(sourceUrl);
  if (photo) sortedLinks.push(photo);
  
  videos.forEach((vid, index) => {
    let videoLabel = 'Video';
    if (index === 0) videoLabel = 'Video Pertama';
    else if (index === 1) videoLabel = 'Video Kedua';
    else videoLabel = `Video Ke-${index + 1}`;
    sortedLinks.push({ label: videoLabel, url: vid.url });
  });

  others.forEach((other, index) => {
    sortedLinks.push({ label: `Media Lainnya ${index + 1}`, url: other.url });
  });

  if (audio) sortedLinks.push(audio);

  return sortedLinks;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setShowPopup(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!showPopup && deferredPrompt) {
      const showTimer = setTimeout(() => setShowInstallPopup(true), 500); 
      const hideTimer = setTimeout(() => setShowInstallPopup(false), 8500); 
      return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }
  }, [showPopup, deferredPrompt]);

  const handleInstallClick = async () => {
    setShowInstallPopup(false);
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(url)}`, { method: "GET" });
      const data = await res.json();
      if (!data.Status) {
        setError(data.Error || "Failed to process the URL.");
      } else {
        setResult(data.Result);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPayload = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const rawLinks = result ? gatherLinks(result) : [];
  const links = formatAndSortLinks(rawLinks);

  return (
    <div className="flex flex-col min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 selection:bg-blue-200 dark:selection:bg-blue-900 font-sans transition-colors duration-300">
      
      <style>{`
        .custom-loader {
          width: 15px;
          aspect-ratio: 1;
          position: relative;
        }
        .custom-loader::before,
        .custom-loader::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: currentColor;
        }
        .custom-loader::before {
          box-shadow: -25px 0;
          animation: l8-1 1s infinite linear;
        }
        .custom-loader::after {
          transform: rotate(0deg) translateX(25px);
          animation: l8-2 1s infinite linear;
        }
        @keyframes l8-1 { 100% { transform: translateX(25px); } }
        @keyframes l8-2 { 100% { transform: rotate(-180deg) translateX(25px); } }
      `}</style>

      <header className="h-[70px] sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-blue-100 dark:border-slate-800 shadow-sm flex items-center px-6 transition-colors duration-300">
        <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex items-center gap-[12px] cursor-pointer">
            <div className="w-[36px] h-[36px] shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" className="w-full h-full shadow-md shadow-blue-600/20 rounded-xl">
                <rect width="192" height="192" rx="32" className="fill-blue-100 dark:fill-blue-900" />
                <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="38" fontFamily="sans-serif">
                  <tspan className="font-light fill-slate-800 dark:fill-slate-100">Gorge</tspan>
                  <tspan className="font-extrabold fill-blue-600 dark:fill-blue-400">Link</tspan>
                </text>
              </svg>
            </div>
          </motion.div>
          <nav className="hidden sm:flex items-center gap-[32px]">
            <a href="#" className="text-slate-600 dark:text-slate-300 text-[14px] font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</a>
            <a href="https://whatsapp.com/channel/0029Vb6DPnBIXnliEawZjb41" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 text-[14px] font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Community</a>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-[24px] md:px-[40px] py-[40px] md:py-[80px] flex flex-col gap-[32px]">
        
        <section className="flex flex-col items-center mb-[16px] text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-[8px] bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 px-[16px] py-[8px] rounded-full mb-[24px] font-medium text-[12px] md:text-[14px]"
          >
            <Sparkles className="w-[16px] h-[16px]" />
            <span>Fast, Secure, Universal</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[36px] md:text-[56px] font-bold leading-[1.1] text-slate-900 dark:text-white mb-[16px] max-w-4xl tracking-tight"
          >
            Ultimate <span className="text-blue-600 dark:text-blue-500">Media Downloader</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[16px] md:text-[18px] font-normal leading-[1.6] text-slate-600 dark:text-slate-400 mb-[48px] max-w-2xl px-4"
          >
            Retrieve videos and media from your favorite social platforms instantly. Simple, fast, and reliable.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full max-w-3xl bg-white dark:bg-slate-900 p-[12px] rounded-2xl border border-blue-100 dark:border-slate-800 shadow-xl shadow-blue-900/5 dark:shadow-none"
          >
            <form onSubmit={handleDownload} className="flex flex-col md:flex-row gap-[12px]">
              <div className="flex-1 relative">
                <input 
                  type="url" 
                  placeholder="Paste URL here (e.g. https://vt.tiktok.com/...)" 
                  className="w-full h-[54px] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-[16px] font-normal px-[20px] rounded-xl border border-blue-200 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 focus:outline-none transition-all"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <motion.button 
                whileHover={!loading && url ? { scale: 1.02 } : {}}
                whileTap={!loading && url ? { scale: 0.98 } : {}}
                type="submit" 
                disabled={loading || !url}
                className="h-[54px] shrink-0 bg-blue-600 text-white text-[15px] font-semibold px-[32px] rounded-xl hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-[10px]"
              >
                <Download className="w-[18px] h-[18px]" /> Extract Media
              </motion.button>
            </form>
            
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
                  <div className="flex items-center gap-[8px] bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[13px] font-medium px-[16px] py-[10px] rounded-xl">
                    <AlertCircle className="w-[16px] h-[16px] shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center justify-center py-[60px] gap-[30px]"
            >
              <div className="custom-loader text-blue-600 dark:text-blue-400"></div>
              <motion.p 
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-blue-600 dark:text-blue-400 font-medium tracking-wide mt-2"
              >
                Extracting your media...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {result && !loading && (
            <motion.section 
              key="results"
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ type: "spring", damping: 25 }}
              className="flex flex-col items-center w-full"
            >
              <div className="w-full max-w-3xl bg-white dark:bg-slate-900 p-[24px] md:p-[32px] rounded-2xl border border-blue-100 dark:border-slate-800 shadow-xl shadow-blue-900/5 dark:shadow-none">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-[32px] border-b border-blue-100 dark:border-slate-800 pb-[20px] gap-[16px]">
                  <div>
                    <h3 className="text-[24px] font-semibold text-slate-900 dark:text-white tracking-tight">Extraction Complete</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-[14px] mt-[4px]">Preview and download your media below.</p>
                  </div>
                  <motion.div 
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                    className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 text-[13px] font-medium px-[16px] py-[8px] rounded-full flex items-center gap-[8px]"
                  >
                     <CheckCircle2 className="w-[16px] h-[16px]" /> Success
                  </motion.div>
                </div>

                {links.length > 0 ? (
                  <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[32px]">
                    {links.map((link, idx) => (
                      <motion.div variants={itemVariants} key={idx} className="flex flex-col justify-between p-[20px] border border-blue-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-slate-600 transition-all group">
                        <div className="flex items-start gap-[14px] mb-[20px]">
                          <div className="w-[44px] h-[44px] bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20 flex items-center justify-center shrink-0">
                            <LinkIcon className="w-[20px] h-[20px] text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h4 className="text-[15px] font-semibold text-slate-800 dark:text-slate-200 truncate" title={link.label}>
                              {link.label}
                            </h4>
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-[4px]">Ready to access</p>
                          </div>
                        </div>
                        <motion.a 
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          href={link.url} target="_blank" rel="noopener noreferrer"
                          className="w-full h-[44px] flex items-center justify-center gap-[8px] bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-slate-700 rounded-xl text-[14px] font-semibold hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-colors"
                        >
                          <Download className="w-[16px] h-[16px]" /> Download
                        </motion.a>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="py-[40px] text-center border border-blue-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-[32px]">
                    <p className="text-[16px] font-medium text-slate-500 dark:text-slate-400">No extractable URLs found.</p>
                  </div>
                )}

                <details className="group border border-blue-100 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800/50 relative">
                  <summary className="text-slate-700 dark:text-slate-300 text-[14px] font-semibold p-[20px] hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer outline-none flex items-center justify-between transition-colors">
                    <span className="flex items-center gap-[10px]">
                      <Server className="w-[16px] h-[16px] text-blue-500 dark:text-blue-400" /> View Payload
                    </span>
                    <span className="text-[12px] text-blue-600 dark:text-blue-400 font-medium">Toggle</span>
                  </summary>
                  <div className="relative">
                    <button 
                      onClick={handleCopyPayload}
                      className="absolute top-[16px] right-[16px] p-[8px] bg-slate-700/80 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center shadow-md z-10 backdrop-blur-sm"
                      title="Copy Payload"
                    >
                      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                    <div className="p-[20px] bg-slate-800 dark:bg-slate-950 text-[13px] font-mono text-blue-200 dark:text-blue-300 whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto border-t border-blue-100 dark:border-slate-700">
                      {JSON.stringify(result, null, 2)}
                    </div>
                  </div>
                </details>

              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <section className="w-full max-w-4xl mx-auto mt-[16px] grid grid-cols-1 md:grid-cols-3 gap-[24px]">
          <motion.div 
            whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}
            className="md:col-span-1 bg-white dark:bg-slate-900 p-[32px] rounded-2xl border border-blue-100 dark:border-slate-800 shadow-sm flex flex-col items-start"
          >
            <div className="w-[48px] h-[48px] bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center mb-[20px]">
              <Globe className="w-[24px] h-[24px] text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-[18px] font-semibold text-slate-900 dark:text-white mb-[8px]">Global Reach</h3>
            <p className="text-[14px] leading-[1.6] text-slate-600 dark:text-slate-400">
              Optimized servers to fetch your content globally with zero hassle.
            </p>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}
            className="md:col-span-2 bg-white dark:bg-slate-900 p-[32px] rounded-2xl border border-blue-100 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center gap-[12px] mb-[16px] pb-[16px] border-b border-blue-50 dark:border-slate-800">
              <Server className="w-[24px] h-[24px] text-blue-600 dark:text-blue-400" />
              <h3 className="text-[18px] font-semibold text-slate-900 dark:text-white">Supported Networks</h3>
            </div>
            <p className="text-[14px] leading-[1.8] text-slate-600 dark:text-slate-400">
               Routing requests to support content networks including:<br/>
               <span className="font-semibold mt-[8px] block text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 p-[12px] rounded-lg border border-blue-100 dark:border-blue-500/20">
                 Tiktok, Douyin, Threads, Instagram, Facebook, Reddit, Youtube, Twitter, Spotify, Soundcloud, and more.
               </span>
            </p>
          </motion.div>
        </section>

      </main>

      <footer className="w-full border-t border-blue-100 dark:border-slate-800 py-[32px] bg-white dark:bg-slate-900 px-6 mt-auto shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-[24px]">
          <div className="flex flex-col items-center md:items-start gap-[8px]">
            <p className="text-[16px] font-bold text-slate-800 dark:text-white">Gorge<span className="text-blue-600 dark:text-blue-500">Link</span></p>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">Fast and universally accessible media extraction.</p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-[4px]">
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              By <a href="https://www.instagram.com/g4nggaa?igsh=eW4zeWY1NjY3a2k2" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">G4NGGAAA</a>
            </p>
            <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500 tracking-wider">© {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showPopup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} transition={{ type: "spring", damping: 25 }}
              className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 text-slate-900 dark:text-slate-50 w-full max-w-[400px] p-[32px] rounded-2xl relative shadow-2xl"
            >
              <button onClick={() => setShowPopup(false)} className="absolute top-[16px] right-[16px] text-slate-400 hover:text-slate-800 dark:hover:text-white p-[8px] bg-slate-50 dark:bg-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X className="w-[20px] h-[20px]" />
              </button>
              <div className="w-[48px] h-[48px] bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center mb-[20px]">
                <ShieldCheck className="w-[24px] h-[24px] text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-[24px] font-bold mb-[12px] text-slate-900 dark:text-white">Stay Connected</h3>
              <p className="text-[14px] text-slate-600 dark:text-slate-400 mb-[24px]">Join the WhatsApp channel for updates and tools.</p>
              <div className="flex flex-col gap-[12px]">
                <a href="https://whatsapp.com/channel/0029Vb6DPnBIXnliEawZjb41" target="_blank" rel="noopener noreferrer" onClick={() => setShowPopup(false)} className="h-[44px] bg-blue-600 text-white text-[14px] font-semibold rounded-xl flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors">Join Channel</a>
                <button onClick={() => setShowPopup(false)} className="h-[44px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[14px] font-semibold rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Continue</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInstallPopup && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} transition={{ type: "spring", bounce: 0.4 }} className="fixed top-6 left-0 right-0 z-[100] flex justify-center px-4">
            <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 p-[16px] rounded-2xl flex items-start gap-[16px] max-w-sm w-full shadow-xl shadow-blue-900/10 dark:shadow-black/50">
              <div className="w-[40px] h-[40px] bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                <Download className="w-[18px] h-[18px] text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-[14px] font-bold text-slate-900 dark:text-white">Install App</h4>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-[2px]">Add to Home Screen.</p>
                <div className="flex gap-[8px] mt-[12px]">
                  <button onClick={handleInstallClick} className="bg-blue-600 text-white font-semibold text-[12px] px-[16px] py-[6px] rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors">Install</button>
                  <button onClick={() => setShowInstallPopup(false)} className="text-slate-500 dark:text-slate-400 font-medium text-[12px] px-[16px] py-[6px] hover:text-slate-800 dark:hover:text-white transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Later</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
