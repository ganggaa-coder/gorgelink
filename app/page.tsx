"use client";

import React, { useState, useEffect } from 'react';
import {
  Download,
  Link as LinkIcon,
  AlertCircle,
  X,
  Copy,
  Check,
  Clipboard,
  ExternalLink,
  History,
  Trash2,
  Moon,
  Sun,
  Video,
  Music,
  Image as ImageIcon,
  ArrowRight,
  ShieldCheck,
  Layers,
  Radio,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MediaLink {
  label: string;
  url: string;
  type?: 'video' | 'audio' | 'image' | 'source' | 'other';
  quality?: string;
  extension?: string;
  size?: string;
}

interface ExtractionHistoryItem {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  thumbnail?: string;
  linksCount: number;
  platform?: string;
}

function isUrl(str: string) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function gatherLinks(obj: any, prefix = ''): { label: string; url: string; rawType?: string }[] {
  const links: { label: string; url: string; rawType?: string }[] = [];
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
      if (obj.label) customLabel = obj.label;
      else {
        if (obj.type) customLabel += ` [${obj.type}]`;
        if (obj.quality) customLabel += ` - ${obj.quality}`;
        if (obj.extension) customLabel += ` (.${obj.extension})`;
      }

      links.push({
        label: customLabel.trim() || 'Media Stream',
        url: obj.url,
        rawType: obj.type,
      });
    }

    Object.entries(obj).forEach(([key, value]) => {
      if (key === 'url' && typeof value === 'string' && isUrl(value)) return;

      if (typeof value === 'string' && isUrl(value)) {
        const cleanKey = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        links.push({ label: `${prefix} ${cleanKey}`.trim(), url: value });
      } else if (typeof value === 'object') {
        const nextPrefix = prefix ? prefix : key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        links.push(...gatherLinks(value, nextPrefix));
      }
    });
  }
  return links;
}

function formatAndSortLinks(rawLinks: { label: string; url: string; rawType?: string }[]): MediaLink[] {
  const seenUrls = new Set<string>();
  const results: MediaLink[] = [];

  rawLinks.forEach((link) => {
    if (seenUrls.has(link.url)) return;
    seenUrls.add(link.url);

    const url = link.url.toLowerCase();
    const label = link.label.toLowerCase();

    let type: MediaLink['type'] = 'other';
    let quality = '';
    let extension = 'mp4';

    if (
      link.rawType === 'audio' ||
      label.includes('audio') ||
      label.includes('mp3') ||
      label.includes('m4a') ||
      url.includes('.mp3') ||
      url.includes('.m4a') ||
      label.includes('kbps')
    ) {
      type = 'audio';
      extension = 'mp3';
      if (label.includes('320')) quality = '320 kbps';
      else if (label.includes('256')) quality = '256 kbps';
      else if (label.includes('128')) quality = '128 kbps';
    } else if (
      link.rawType === 'image' ||
      label.includes('thumbnail') ||
      label.includes('cover') ||
      label.includes('photo') ||
      url.includes('.jpg') ||
      url.includes('.jpeg') ||
      url.includes('.png') ||
      url.includes('.webp')
    ) {
      type = 'image';
      extension = url.includes('.webp') ? 'webp' : 'jpg';
      if (label.includes('1080') || label.includes('maxres')) quality = '1080p';
      else if (label.includes('480') || label.includes('hq')) quality = '480p';
    } else if (
      link.rawType === 'video' ||
      label.includes('video') ||
      label.includes('mp4') ||
      url.includes('.mp4') ||
      label.includes('hd')
    ) {
      type = 'video';
      extension = 'mp4';
      if (label.includes('1080')) quality = '1080p';
      else if (label.includes('720')) quality = '720p';
      else if (label.includes('480')) quality = '480p';
      else if (label.includes('360')) quality = '360p';
    }

    results.push({
      label: link.label,
      url: link.url,
      type,
      quality,
      extension,
    });
  });

  // Sort logically: Videos first (highest resolution), then Audios (highest bitrate), then Images, then others
  return results.sort((a, b) => {
    const order: Record<string, number> = { video: 1, audio: 2, image: 3, other: 4, source: 5 };
    const diff = (order[a.type || 'other'] || 4) - (order[b.type || 'other'] || 4);
    if (diff !== 0) return diff;
    return b.label.localeCompare(a.label);
  });
}

const SUPPORTED_PLATFORMS = [
  { name: 'YouTube', placeholder: 'https://www.youtube.com/watch?v=...' },
  { name: 'TikTok', placeholder: 'https://vt.tiktok.com/...' },
  { name: 'Instagram', placeholder: 'https://www.instagram.com/reel/...' },
  { name: 'Twitter / X', placeholder: 'https://x.com/.../status/...' },
  { name: 'Facebook', placeholder: 'https://fb.watch/...' },
  { name: 'SoundCloud', placeholder: 'https://soundcloud.com/...' },
  { name: 'Threads', placeholder: 'https://www.threads.net/@...' },
];

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<ExtractionHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'extractor' | 'history'>('extractor');
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  // Robust Theme Initialization
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gorgelink_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Synchronize theme with HTML root and DOM attributes
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
      localStorage.setItem('gorgelink_theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
      localStorage.setItem('gorgelink_theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('gorgelink_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      const input = document.getElementById('media-url-input') as HTMLInputElement;
      if (input) input.focus();
    }
  };

  const handleDownload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(url.trim())}`, {
        method: 'GET',
      });
      const data = await res.json();

      if (!data.Status) {
        setError(data.Error || 'Failed to extract media. Verify link is public and accessible.');
      } else {
        setResult(data.Result);

        const extracted = gatherLinks(data.Result);
        const title =
          data.Result?.title ||
          data.Result?.desc ||
          data.Result?.caption ||
          url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48);

        const coverImg =
          data.Result?.cover ||
          data.Result?.origin_cover ||
          data.Result?.thumbnail ||
          extracted.find((l) => l.url.includes('.jpg') || l.url.includes('.png') || l.url.includes('.webp'))?.url;

        let detectedPlatform = 'Universal';
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('youtube') || lowerUrl.includes('youtu.be')) detectedPlatform = 'YouTube';
        else if (lowerUrl.includes('tiktok')) detectedPlatform = 'TikTok';
        else if (lowerUrl.includes('instagram')) detectedPlatform = 'Instagram';
        else if (lowerUrl.includes('twitter') || lowerUrl.includes('x.com')) detectedPlatform = 'Twitter';
        else if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.watch')) detectedPlatform = 'Facebook';
        else if (lowerUrl.includes('soundcloud')) detectedPlatform = 'SoundCloud';

        const newHistoryItem: ExtractionHistoryItem = {
          id: Date.now().toString(),
          url: url.trim(),
          title: String(title),
          timestamp: Date.now(),
          thumbnail: coverImg,
          linksCount: extracted.length,
          platform: detectedPlatform,
        };

        const updatedHistory = [newHistoryItem, ...history.filter((h) => h.url !== url.trim())].slice(0, 15);
        setHistory(updatedHistory);
        localStorage.setItem('gorgelink_history', JSON.stringify(updatedHistory));
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('gorgelink_history');
  };

  const handleCopyPayload = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = (linkUrl: string, index: number) => {
    navigator.clipboard.writeText(linkUrl);
    setCopiedLinkIndex(index);
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  };

  const rawLinks = result ? gatherLinks(result) : [];
  const links = formatAndSortLinks(rawLinks);

  const mediaTitle = result?.title || result?.desc || result?.caption || 'Media Asset';
  const mediaAuthor = result?.author?.nickname || result?.author?.unique_id || null;
  const mediaDuration = result?.duration ? String(result.duration) : null;
  const mediaCover =
    result?.cover ||
    result?.origin_cover ||
    result?.thumbnail ||
    links.find((l) => l.type === 'image')?.url;

  return (
    <div className="flex flex-col min-h-screen w-full font-sans transition-colors duration-200">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (Clean text links) — Zone 3 (Working Theme Toggle + Action) */}
      <header className="h-16 sticky top-0 z-40 bg-white dark:bg-[#111726] border-b border-[#E2E8F0] dark:border-[#1E293B] px-6 sm:px-10 flex items-center justify-between gap-8 transition-colors">
        {/* Zone 1: Single Wordmark */}
        <a
          href="/"
          className="text-lg font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap shrink-0 flex items-center gap-2.5"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Download className="w-4 h-4" />
          </div>
          <span>
            Gorge<span className="text-blue-600 dark:text-blue-500">Link</span>
          </span>
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
          <a
            href="#extractor"
            onClick={() => setActiveTab('extractor')}
            className={`hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'extractor' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            Extractor
          </a>
          <a
            href="#features"
            className="hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Resolutions & Audio
          </a>
          <a
            href="#platforms"
            className="hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Supported Platforms
          </a>
          {history.length > 0 && (
            <button
              onClick={() => {
                setActiveTab(activeTab === 'history' ? 'extractor' : 'history');
                setShowHistory(!showHistory);
              }}
              className="hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <span>Recent History</span>
              <span className="text-xs font-mono font-mono-numbers opacity-75">({history.length})</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Functional Theme Switcher + Community Button */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Functional Dark/Light Toggle Button */}
          <button
            onClick={toggleTheme}
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#131B2E] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-xs font-medium transition-all shadow-sm cursor-pointer select-none"
            aria-label="Toggle theme mode"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowCommunityModal(true)}
            className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#28354D] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Community
          </button>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 md:py-16 flex flex-col gap-10" id="extractor">
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Clean Unboxed Metadata Kicker (Anti-AI Slop: Zero static pills) */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-3 tracking-wide uppercase">
            <span>Multi-Resolution Video</span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>Studio Audio (320 kbps)</span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>Full-Res Covers</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] mb-3 text-balance">
            High-fidelity media extraction.
          </h1>

          <p className="text-sm sm:text-base text-[#64748B] dark:text-[#94A3B8] mb-8 max-w-2xl leading-relaxed">
            Download 1080p Full HD video, high-bitrate MP3 stems, and original covers from YouTube, TikTok, Instagram, Twitter/X, and more.
          </p>

          {/* Extractor Input Box */}
          <div className="w-full bg-white dark:bg-[#131B2E] p-3 sm:p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-sm">
            <form onSubmit={handleDownload} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative flex items-center">
                <input
                  id="media-url-input"
                  type="url"
                  placeholder="Paste URL (e.g. YouTube, TikTok, Instagram Reels, X/Twitter)"
                  className="w-full h-12 bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] text-sm px-4 pr-24 rounded-lg border border-[#CBD5E1] dark:border-[#334155] placeholder:text-[#94A3B8] focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  required
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {url ? (
                    <button
                      type="button"
                      onClick={() => setUrl('')}
                      className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
                      title="Clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2.5 py-1 text-xs font-medium text-[#475569] dark:text-[#CBD5E1] bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#334155] rounded transition-colors"
                    >
                      Paste
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{loading ? 'Resolving Streams...' : 'Extract Media'}</span>
              </button>
            </form>

            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 text-xs rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Interactive Platform Shortcuts (Anti-slop: clean text buttons) */}
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-[#1E293B] flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="font-medium text-[#94A3B8]">Supported:</span>
              {SUPPORTED_PLATFORMS.map((p, idx) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setUrl(p.placeholder)}
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title={`Click to test format: ${p.placeholder}`}
                >
                  <span>{p.name}</span>
                  {idx < SUPPORTED_PLATFORMS.length - 1 && <span className="ml-2 opacity-30">·</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Loading Spinner */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 gap-2"
            >
              <div className="w-7 h-7 rounded-full border-2 border-blue-200 dark:border-blue-950 border-t-blue-600 animate-spin" />
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Fetching all available audio bitrates and video resolutions...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Showcase: High-Density Structured Formats Table */}
        <AnimatePresence mode="wait">
          {result && !loading && (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full bg-white dark:bg-[#131B2E] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] p-6 md:p-8 shadow-sm"
            >
              {/* Media Title & Author Block */}
              <div className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-[#E2E8F0] dark:border-[#1E293B]">
                {mediaCover && (
                  <div className="w-full sm:w-48 h-32 rounded-lg overflow-hidden shrink-0 bg-[#F1F5F9] dark:bg-[#0B0F19] relative border border-[#E2E8F0] dark:border-[#1E293B]">
                    <img
                      src={mediaCover}
                      alt={mediaTitle}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {result.platform || 'Universal Media'}
                      </span>
                      {mediaAuthor && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{mediaAuthor}</span>
                        </>
                      )}
                      {mediaDuration && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-numbers">{mediaDuration}</span>
                        </>
                      )}
                      {result.cached && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Cached instant</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] line-clamp-2">
                      {mediaTitle}
                    </h2>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    <span className="font-mono-numbers">{links.length} formats available for download</span>
                  </div>
                </div>
              </div>

              {/* Formats Grid / Table */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Download Stream Options
                  </h3>
                  <span className="text-xs text-[#94A3B8]">Sorted by quality</span>
                </div>

                <div className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B] rounded-lg overflow-hidden">
                  {links.map((link, idx) => {
                    const isVideo = link.type === 'video';
                    const isAudio = link.type === 'audio';
                    const isImage = link.type === 'image';

                    const safeTitle = mediaTitle.slice(0, 36).replace(/[^a-zA-Z0-9_-]/g, '_');
                    const filename = `${safeTitle}${isAudio ? '.mp3' : isImage ? (link.extension || '.jpg') : '.mp4'}`;
                    const proxyDownloadUrl = `/api/stream?url=${encodeURIComponent(link.url)}&filename=${encodeURIComponent(filename)}`;

                    return (
                      <div
                        key={idx}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] dark:hover:bg-[#1A243D] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] flex items-center justify-center shrink-0">
                            {isVideo ? (
                              <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : isAudio ? (
                              <Music className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : isImage ? (
                              <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <LinkIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                              {link.label}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                              <span>{link.extension ? link.extension.toUpperCase() : 'STREAM'}</span>
                              {link.quality && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono-numbers font-medium text-blue-600 dark:text-blue-400">
                                    {link.quality}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={proxyDownloadUrl}
                            download={filename}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>

                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] rounded transition-colors"
                            title="Open direct URL in new tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          <button
                            onClick={() => handleCopyLink(link.url, idx)}
                            className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] rounded transition-colors"
                            title="Copy direct stream URL"
                          >
                            {copiedLinkIndex === idx ? (
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Developer JSON Inspector */}
              <details className="mt-6 border border-[#E2E8F0] dark:border-[#1E293B] rounded-lg overflow-hidden group">
                <summary className="px-4 py-2 bg-[#F8FAFC] dark:bg-[#0B0F19] text-xs font-medium text-[#64748B] dark:text-[#94A3B8] cursor-pointer flex items-center justify-between select-none">
                  <span>Raw API Response Payload</span>
                  <span className="group-open:rotate-180 transition-transform text-xs">▼</span>
                </summary>
                <div className="p-4 bg-[#090D16] text-xs font-mono text-neutral-200 whitespace-pre-wrap overflow-x-auto max-h-60 relative">
                  <button
                    onClick={handleCopyPayload}
                    className="absolute top-3 right-3 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs transition-colors flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  {JSON.stringify(result, null, 2)}
                </div>
              </details>
            </motion.section>
          )}
        </AnimatePresence>

        {/* History Section */}
        {showHistory && history.length > 0 && (
          <section className="w-full bg-white dark:bg-[#131B2E] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] dark:border-[#1E293B] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Recent Extractions</h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Saved locally on your device</p>
              </div>
              <button
                onClick={clearHistory}
                className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>
            </div>

            <div className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setUrl(item.url);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="py-3 px-2 flex items-center justify-between gap-4 hover:bg-[#F8FAFC] dark:hover:bg-[#1A243D] rounded cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt="thumb"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-cover rounded shrink-0 bg-[#F1F5F9] dark:bg-[#0B0F19]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[#F1F5F9] dark:bg-[#0B0F19] text-[#64748B] flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                        <span>{item.platform || 'Media'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-numbers">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-blue-600 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Feature Grid: Resolutions & Audio Formats Overview */}
        <section id="features" className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">Multi-Tier Extraction Matrix</h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Engineered to retrieve the maximum possible resolutions, audio tracks, and original cover photos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-white dark:bg-[#131B2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl shadow-sm">
              <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mb-3">
                <Video className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                All Video Resolutions
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                Extracts 1080p Full HD, 720p HD, 480p, and 360p direct streams. No watermarks on TikTok and Instagram Reels.
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-[#131B2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl shadow-sm">
              <div className="w-8 h-8 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-3">
                <Music className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Audio Bitrate Options
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                Fetches 320 kbps Studio Quality, 256 kbps High Fidelity, and 128 kbps Standard MP3 files, ready for music production or listening.
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-[#131B2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl shadow-sm">
              <div className="w-8 h-8 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center mb-3">
                <ImageIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                Full-Resolution Covers & Slides
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                Extracts MaxRes (1920x1080) and HQ (640x480) thumbnails, as well as individual photo slides from carousel posts.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#E2E8F0] dark:border-[#1E293B] py-6 bg-white dark:bg-[#111726] px-6 sm:px-10 mt-auto transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">GorgeLink</span>
            <span aria-hidden="true">·</span>
            <span>Universal Media Downloader Engine</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ganggaa-coder/gorgelink"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0F172A] dark:hover:text-white transition-colors"
            >
              GitHub
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.instagram.com/g4nggaa?igsh=eW4zeWY1NjY3a2k2"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0F172A] dark:hover:text-white transition-colors"
            >
              Developed by G4NGGAAA
            </a>
            <span aria-hidden="true">·</span>
            <span className="font-mono-numbers">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Community Modal */}
      <AnimatePresence>
        {showCommunityModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#131B2E] border border-[#E2E8F0] dark:border-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] w-full max-w-sm p-6 rounded-xl relative shadow-xl"
            >
              <button
                onClick={() => setShowCommunityModal(false)}
                className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold mb-1">GorgeLink Community</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-5">
                Join our official WhatsApp channel for API updates, features, and developer notes.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="https://whatsapp.com/channel/0029Vb6DPnBIXnliEawZjb41"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowCommunityModal(false)}
                  className="h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center transition-colors"
                >
                  Join WhatsApp Channel
                </a>
                <button
                  onClick={() => setShowCommunityModal(false)}
                  className="h-10 bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] text-xs font-medium rounded-lg hover:bg-[#E2E8F0] dark:hover:bg-[#28354D] transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
