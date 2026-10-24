"use client";

import React, { useState, useEffect } from 'react';
import {
  Download,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
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
        label: customLabel.trim() || 'Media',
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
  let sourceUrl: MediaLink | null = null;
  let photo: MediaLink | null = null;
  let audio: MediaLink | null = null;
  const videos: MediaLink[] = [];
  const others: MediaLink[] = [];

  const seenUrls = new Set<string>();

  rawLinks.forEach((link) => {
    if (seenUrls.has(link.url)) return;
    seenUrls.add(link.url);

    const url = link.url.toLowerCase();
    const label = link.label.toLowerCase();

    if (
      (url.includes('tiktok.com') || url.includes('instagram.com/reel')) &&
      !url.includes('ies-music') &&
      !url.includes('fbcdn') &&
      !url.includes('.mp4')
    ) {
      sourceUrl = { label: 'Source Media Link', url: link.url, type: 'source' };
    } else if (
      link.rawType === 'audio' ||
      label.includes('[audio]') ||
      label.includes('(.m4a)') ||
      label.includes('(.mp3)') ||
      url.includes('.mp3') ||
      url.includes('.m4a') ||
      url.includes('audiotrack') ||
      url.includes('mime_type=audio') ||
      url.includes('ies-music.tiktokcdn')
    ) {
      if (!audio) {
        audio = { label: 'Audio MP3', url: link.url, type: 'audio', extension: 'mp3', quality: '128 kbps' };
      } else {
        others.push({ label: link.label || 'Audio Stream', url: link.url, type: 'audio' });
      }
    } else if (
      link.rawType === 'video' ||
      label.includes('[video]') ||
      label.includes('(.mp4)') ||
      url.includes('.mp4') ||
      label.includes('video') ||
      label.includes('play') ||
      label.includes('hdplay')
    ) {
      let quality = 'HD';
      if (label.includes('1080') || url.includes('1080')) quality = '1080p';
      else if (label.includes('720') || url.includes('720')) quality = '720p';
      else if (label.includes('360') || url.includes('360')) quality = '360p';

      videos.push({
        label: link.label || 'Video MP4',
        url: link.url,
        type: 'video',
        quality,
        extension: 'mp4',
      });
    } else if (
      link.rawType === 'image' ||
      url.includes('.jpg') ||
      url.includes('.png') ||
      url.includes('.jpeg') ||
      url.includes('.webp') ||
      label.includes('thumbnail') ||
      label.includes('cover') ||
      label.includes('pic')
    ) {
      if (!photo) {
        photo = { label: 'Cover Image', url: link.url, type: 'image', extension: 'jpg' };
      } else {
        others.push({ label: link.label || 'Image', url: link.url, type: 'image' });
      }
    } else {
      others.push({ label: link.label || 'Stream Link', url: link.url, type: 'other' });
    }
  });

  const sortedLinks: MediaLink[] = [];
  if (photo) sortedLinks.push(photo);

  videos.forEach((vid, index) => {
    let videoLabel = vid.label;
    if (videoLabel === 'Media' || videoLabel === 'Video MP4') {
      if (index === 0) videoLabel = 'Video 720p (HD)';
      else if (index === 1) videoLabel = 'Video 1080p (Full HD)';
      else videoLabel = `Video Stream ${index + 1}`;
    }
    sortedLinks.push({ ...vid, label: videoLabel });
  });

  if (audio) sortedLinks.push(audio);

  others.forEach((other, index) => {
    sortedLinks.push({
      ...other,
      label: other.label || `Media Option ${index + 1}`,
    });
  });

  if (sourceUrl) sortedLinks.push(sourceUrl);

  return sortedLinks;
}

const SUPPORTED_NETWORKS = [
  'TikTok',
  'YouTube',
  'Instagram Reels',
  'Facebook Watch',
  'Twitter / X',
  'Threads',
  'SoundCloud',
  'CapCut',
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

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gorgelink_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('gorgelink_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('gorgelink_theme', 'light');
    }
  }, [darkMode]);

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
        setError(data.Error || 'Failed to process media. Ensure the link is public and valid.');
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

        let detectedPlatform = 'Media';
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('youtube') || lowerUrl.includes('youtu.be')) detectedPlatform = 'YouTube';
        else if (lowerUrl.includes('tiktok')) detectedPlatform = 'TikTok';
        else if (lowerUrl.includes('instagram')) detectedPlatform = 'Instagram';
        else if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.watch')) detectedPlatform = 'Facebook';
        else if (lowerUrl.includes('twitter') || lowerUrl.includes('x.com')) detectedPlatform = 'Twitter';
        else if (lowerUrl.includes('threads')) detectedPlatform = 'Threads';

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
    <div className="flex flex-col min-h-screen w-full bg-[#FAFAFA] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F8FAFC] selection:bg-blue-100 dark:selection:bg-blue-900/60 font-sans transition-colors duration-200">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (Clean text links) — Zone 3 (1 primary action / theme) */}
      <header className="h-16 sticky top-0 z-40 bg-white/95 dark:bg-[#0E1526]/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800/80 px-6 sm:px-10 flex items-center justify-between gap-8 transition-colors">
        {/* Zone 1: Single Wordmark */}
        <a
          href="/"
          className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Download className="w-4 h-4" />
          </div>
          <span>
            Gorge<span className="text-blue-600 dark:text-blue-500">Link</span>
          </span>
        </a>

        {/* Zone 2: 4 Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600 dark:text-neutral-400">
          <a
            href="#extractor"
            onClick={() => setActiveTab('extractor')}
            className={`hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'extractor' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            Extractor
          </a>
          <a
            href="#architecture"
            className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Architecture
          </a>
          <a
            href="#networks"
            className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Supported Platforms
          </a>
          {history.length > 0 && (
            <button
              onClick={() => {
                setActiveTab(activeTab === 'history' ? 'extractor' : 'history');
                setShowHistory(!showHistory);
              }}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <span>Recent History</span>
              <span className="text-xs font-mono font-mono-numbers text-neutral-400 dark:text-neutral-500">
                ({history.length})
              </span>
            </button>
          )}
        </nav>

        {/* Zone 3: 1 Primary action + Theme toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowCommunityModal(true)}
            className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Community
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors shrink-0"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Container: Baseline 1440px presence with disciplined 60-30-10 palette */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 md:py-16 flex flex-col gap-12" id="extractor">
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Quiet Unboxed Metadata Kicker (Anti-slop: NO PILLS) */}
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-4 tracking-wide uppercase">
            <span>High-Speed Extraction</span>
            <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">·</span>
            <span>Zero Watermarks</span>
            <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">·</span>
            <span>Direct Stream Proxy</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-4 text-balance">
            Universal media extraction for modern creators.
          </h1>

          <p className="text-base text-neutral-600 dark:text-neutral-400 mb-8 max-w-2xl leading-relaxed">
            Extract high-definition video, audio streams, and original cover assets from TikTok, YouTube, Instagram, and more without watermarks.
          </p>

          {/* Extractor Input Canvas: Single-elevation card with 1px border */}
          <div className="w-full bg-white dark:bg-[#111726] p-3 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <form onSubmit={handleDownload} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative flex items-center">
                <input
                  id="media-url-input"
                  type="url"
                  placeholder="Paste URL (e.g., https://youtu.be/... or TikTok / IG link)"
                  className="w-full h-12 bg-neutral-50 dark:bg-[#0A0F1D] text-neutral-900 dark:text-neutral-100 text-sm px-4 pr-24 rounded-lg border border-neutral-300 dark:border-neutral-700/80 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
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
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                      title="Clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-200/60 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                    >
                      Paste
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{loading ? 'Resolving Streams...' : 'Extract Media'}</span>
              </button>
            </form>

            {/* Error Notice */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clean Unboxed Supported Platforms Strip (Anti-slop: zero pills) */}
            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium text-neutral-400 dark:text-neutral-500">Supported:</span>
              {SUPPORTED_NETWORKS.map((platform, idx) => (
                <React.Fragment key={platform}>
                  <span>{platform}</span>
                  {idx < SUPPORTED_NETWORKS.length - 1 && (
                    <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">·</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* Loading State Indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 gap-3"
            >
              <div className="w-8 h-8 rounded-full border-2 border-blue-200 dark:border-blue-950 border-t-blue-600 animate-spin" />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                Handshaking with media stream resolver...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results View: Clean Structured Layout */}
        <AnimatePresence mode="wait">
          {result && !loading && (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full bg-white dark:bg-[#111726] rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 shadow-sm"
            >
              {/* Media Header & Attribution */}
              <div className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
                {mediaCover && (
                  <div className="w-full sm:w-44 h-28 sm:h-32 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800 relative">
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
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                      <span>{result.platform || 'Media Asset'}</span>
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
                          <span className="text-emerald-600 dark:text-emerald-400">Cached instant</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white line-clamp-2">
                      {mediaTitle}
                    </h2>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-neutral-500">
                    <span className="font-mono-numbers">{links.length} formats resolved</span>
                  </div>
                </div>
              </div>

              {/* Formats Table */}
              <div className="mt-6">
                <h3 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3">
                  Available Streams & Formats
                </h3>

                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                  {links.map((link, idx) => {
                    const isVideo = link.type === 'video' || link.label.toLowerCase().includes('video');
                    const isAudio = link.type === 'audio' || link.label.toLowerCase().includes('audio');
                    const isImage = link.type === 'image' || link.label.toLowerCase().includes('thumbnail') || link.label.toLowerCase().includes('cover');

                    const filename = `${mediaTitle.slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '_')}${
                      isAudio ? '.mp3' : isImage ? '.webp' : '.mp4'
                    }`;

                    const proxyDownloadUrl = `/api/stream?url=${encodeURIComponent(link.url)}&filename=${encodeURIComponent(filename)}`;

                    return (
                      <div
                        key={idx}
                        className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center justify-center shrink-0">
                            {isVideo ? (
                              <Video className="w-4 h-4" />
                            ) : isAudio ? (
                              <Music className="w-4 h-4" />
                            ) : isImage ? (
                              <ImageIcon className="w-4 h-4" />
                            ) : (
                              <LinkIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                              {link.label}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-neutral-500">
                              <span>{link.extension ? link.extension.toUpperCase() : 'Stream'}</span>
                              {link.quality && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono-numbers">{link.quality}</span>
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
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>

                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                            title="Open direct URL"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          <button
                            onClick={() => handleCopyLink(link.url, idx)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                            title="Copy link"
                          >
                            {copiedLinkIndex === idx ? (
                              <Check className="w-4 h-4 text-emerald-600" />
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

              {/* Developer JSON Inspector (Clean collapsible) */}
              <details className="mt-6 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden group">
                <summary className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/40 text-xs font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer flex items-center justify-between select-none">
                  <span>Raw API Response Payload</span>
                  <span className="text-neutral-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                </summary>
                <div className="p-4 bg-neutral-900 text-xs font-mono text-neutral-200 whitespace-pre-wrap overflow-x-auto max-h-64 relative">
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

        {/* History View: High-density Data Grid */}
        {showHistory && history.length > 0 && (
          <section className="w-full bg-white dark:bg-[#111726] rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">Recent Extractions</h3>
                <p className="text-xs text-neutral-500">Stored locally in your browser session</p>
              </div>
              <button
                onClick={clearHistory}
                className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear History
              </button>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setUrl(item.url);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="py-3 px-2 flex items-center justify-between gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 rounded cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt="thumb"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-cover rounded shrink-0 bg-neutral-100 dark:bg-neutral-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <span>{item.platform || 'Media'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-numbers">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mechanism-to-Outcome Architecture Section (Clean Anti-Slop Layout) */}
        <section id="architecture" className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Under the Hood</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Robust multi-engine pipeline engineered for longevity and uptime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-white dark:bg-[#111726] border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mb-3">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
                Multi-CDN Fallback Pool
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Connects to dynamic CDN pools with AES-128-CBC cipher resolution for YouTube and multi-origin parsers for TikTok.
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-[#111726] border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <div className="w-8 h-8 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-3">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
                LRU Stream Cache
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                15-minute in-memory caching eliminates redundant external scraper calls, completely bypassing third-party rate limits.
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-[#111726] border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <div className="w-8 h-8 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center mb-3">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1.5">
                Browser Stream Attachment
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Direct media streams pass through a local HTTP pipeline setting attachment headers for seamless 1-click downloads.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer: Quiet 3-zone contract */}
      <footer className="w-full border-t border-neutral-200 dark:border-neutral-800/80 py-8 bg-white dark:bg-[#0E1526] px-6 sm:px-10 mt-auto transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-800 dark:text-white">GorgeLink</span>
            <span aria-hidden="true">·</span>
            <span>Universal Media Extraction Engine</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ganggaa-coder/gorgelink"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              GitHub Repo
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.instagram.com/g4nggaa?igsh=eW4zeWY1NjY3a2k2"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Developed by G4NGGAAA
            </a>
            <span aria-hidden="true">·</span>
            <span className="font-mono-numbers">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Community Modal (Triggered intentionally by user, NOT on arrival) */}
      <AnimatePresence>
        {showCommunityModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111726] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 w-full max-w-sm p-6 rounded-xl relative shadow-xl"
            >
              <button
                onClick={() => setShowCommunityModal(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold mb-1">GorgeLink Community</h3>
              <p className="text-xs text-neutral-500 mb-5">
                Join our channel for update notifications, API changelogs, and support.
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
                  className="h-10 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
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
