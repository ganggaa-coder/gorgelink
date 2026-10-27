"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Download,
  Link as LinkIcon,
  AlertCircle,
  X,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Moon,
  Sun,
  Video,
  Music,
  Image as ImageIcon,
  ArrowRight,
  Smartphone,
  CheckCircle,
  Share,
  MoreVertical,
  Laptop,
  Layers,
  ShieldCheck,
  Radio,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import Image from './components/Image';

export interface MediaLink {
  label: string;
  url: string;
  type?: 'video' | 'audio' | 'image' | 'source' | 'other';
  quality?: string;
  extension?: string;
  size?: string;
}

export interface ExtractionHistoryItem {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  thumbnail?: string;
  linksCount: number;
  platform?: string;
}

function isUrl(str: string): boolean {
  if (typeof str !== 'string' || !str.startsWith('http')) return false;
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
    for (let i = 0; i < obj.length; i++) {
      links.push(...gatherLinks(obj[i], prefix));
    }
  } else if (typeof obj === 'object') {
    if (typeof obj.url === 'string' && isUrl(obj.url)) {
      let customLabel = prefix;
      if (obj.label) {
        customLabel = obj.label;
      } else {
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

    const entries = Object.entries(obj);
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      if (key === 'url' && typeof value === 'string' && isUrl(value)) continue;

      if (typeof value === 'string' && isUrl(value)) {
        const cleanKey = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        links.push({ label: `${prefix} ${cleanKey}`.trim(), url: value });
      } else if (typeof value === 'object' && value !== null) {
        const nextPrefix = prefix ? prefix : key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        links.push(...gatherLinks(value, nextPrefix));
      }
    }
  }
  return links;
}

const TYPE_PRIORITY: Record<string, number> = {
  video: 1,
  audio: 2,
  image: 3,
  other: 4,
  source: 5,
};

function formatAndSortLinks(rawLinks: { label: string; url: string; rawType?: string }[]): MediaLink[] {
  const seenUrls = new Set<string>();
  const results: MediaLink[] = [];

  for (let i = 0; i < rawLinks.length; i++) {
    const link = rawLinks[i];
    if (seenUrls.has(link.url)) continue;
    seenUrls.add(link.url);

    const urlLower = link.url.toLowerCase();
    const labelLower = link.label.toLowerCase();

    let type: MediaLink['type'] = 'other';
    let quality = '';
    let extension = 'mp4';

    if (
      link.rawType === 'audio' ||
      labelLower.includes('audio') ||
      labelLower.includes('mp3') ||
      labelLower.includes('m4a') ||
      urlLower.includes('.mp3') ||
      urlLower.includes('.m4a') ||
      labelLower.includes('kbps')
    ) {
      type = 'audio';
      extension = 'mp3';
      if (labelLower.includes('320')) quality = '320 kbps';
      else if (labelLower.includes('256')) quality = '256 kbps';
      else if (labelLower.includes('128')) quality = '128 kbps';
    } else if (
      link.rawType === 'image' ||
      labelLower.includes('thumbnail') ||
      labelLower.includes('cover') ||
      labelLower.includes('photo') ||
      labelLower.includes('slide') ||
      labelLower.includes('artwork') ||
      urlLower.includes('.jpg') ||
      urlLower.includes('.jpeg') ||
      urlLower.includes('.png') ||
      urlLower.includes('.webp')
    ) {
      type = 'image';
      extension = urlLower.includes('.webp') ? 'webp' : urlLower.includes('.png') ? 'png' : 'jpg';
      if (labelLower.includes('1080') || labelLower.includes('maxres')) quality = '1080p';
      else if (labelLower.includes('480') || labelLower.includes('hq')) quality = '480p';
    } else if (
      link.rawType === 'video' ||
      labelLower.includes('video') ||
      labelLower.includes('mp4') ||
      urlLower.includes('.mp4') ||
      labelLower.includes('hd')
    ) {
      type = 'video';
      extension = 'mp4';
      if (labelLower.includes('1080')) quality = '1080p';
      else if (labelLower.includes('720')) quality = '720p';
      else if (labelLower.includes('480')) quality = '480p';
      else if (labelLower.includes('360')) quality = '360p';
    }

    results.push({
      label: link.label,
      url: link.url,
      type,
      quality,
      extension,
    });
  }

  return results.sort((a, b) => {
    const diff = (TYPE_PRIORITY[a.type || 'other'] || 4) - (TYPE_PRIORITY[b.type || 'other'] || 4);
    if (diff !== 0) return diff;
    return b.label.localeCompare(a.label);
  });
}

const COMPACT_PLATFORMS = [
  { name: 'YouTube', placeholder: 'https://www.youtube.com/watch?v=...' },
  { name: 'TikTok', placeholder: 'https://vt.tiktok.com/...' },
  { name: 'Instagram', placeholder: 'https://www.instagram.com/reel/...' },
  { name: 'Spotify', placeholder: 'https://open.spotify.com/track/...' },
  { name: 'Suno AI', placeholder: 'https://suno.com/song/...' },
  { name: 'Twitter/X', placeholder: 'https://x.com/.../status/...' },
  { name: 'Facebook', placeholder: 'https://fb.watch/...' },
  { name: 'SoundCloud', placeholder: 'https://soundcloud.com/...' },
] as const;

const LOADING_STEPS = [
  'Menghubungi endpoint Multi-CDN & bypass rate-limit...',
  'Mengekstrak track audio (320kbps MP3) & video resolusi tinggi (1080p/4K)...',
  'Mengurai album foto slide & cover artwork...',
  'Menyiapkan tautan unduhan langsung tanpa watermark...',
] as const;

// Isolated Loading Scanner Component prevents root re-renders every interval tick
const CyberLoadingScanner = memo(function CyberLoadingScanner() {
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1300);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-8 shadow-lg relative overflow-hidden flex flex-col items-center justify-center text-center gap-6"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 via-cyan-400/10 to-blue-500/5 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent animate-pulse" />

      <div className="relative flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.35, 1.7], opacity: [0.5, 0.2, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border border-[var(--accent-primary)] pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1.45], opacity: [0.6, 0.3, 0] }}
          transition={{ repeat: Infinity, duration: 2, delay: 0.6, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border border-cyan-400/40 pointer-events-none"
        />

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          className="w-20 h-20 rounded-full border-2 border-dashed border-[var(--accent-primary)]/40 p-1 flex items-center justify-center"
        >
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
            className="w-full h-full rounded-full border border-[var(--accent-primary)]/20"
          />
        </motion.div>

        <div className="absolute w-14 h-14 rounded-full overflow-hidden border-2 border-[var(--accent-primary)] bg-[var(--bg-canvas)] shadow-[0_0_20px_rgba(56,189,248,0.35)] flex items-center justify-center">
          <Image
            src="/icon.png"
            alt="GorgeLink"
            width={56}
            height={56}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 h-8">
        {[0.4, 0.8, 1.2, 0.6, 1.0, 0.7, 1.1, 0.5, 0.9, 0.3].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scaleY: [0.25, 1, 0.4, 0.85, 0.3],
              opacity: [0.6, 1, 0.7, 1, 0.6],
            }}
            transition={{
              repeat: Infinity,
              duration: 0.9 + (i % 3) * 0.2,
              delay: i * 0.08,
              ease: 'easeInOut',
            }}
            className="w-1.5 sm:w-2 bg-gradient-to-t from-[var(--accent-primary)] to-cyan-300 rounded-full origin-bottom h-7 shadow-xs"
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 max-w-lg z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-semibold tracking-wide">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>GORGELINK MEDIA STREAM ENGINE</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={loadingStep}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-sm sm:text-base font-semibold text-[var(--text-primary)]"
          >
            {LOADING_STEPS[loadingStep]}
          </motion.p>
        </AnimatePresence>

        <p className="text-xs text-[var(--text-muted)]">
          Mendeteksi stream audio, video 4K/1080p, dan slide foto resolusi penuh...
        </p>
      </div>

      <div className="w-full max-w-md h-1.5 bg-[var(--bg-canvas)] rounded-full overflow-hidden border border-[var(--border-subtle)] relative">
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          className="w-1/2 h-full bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-[var(--text-secondary)]">
        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
          LATENCY: LOW
        </span>
        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
          CODEC: DIRECT STREAM
        </span>
        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
          SSL: ENCRYPTED
        </span>
      </div>
    </motion.div>
  );
});

// Memoized Media Link Item avoids re-rendering every row when one link is copied
interface MediaLinkRowProps {
  link: MediaLink;
  index: number;
  mediaTitle: string;
  isCopied: boolean;
  onCopy: (url: string, index: number) => void;
}

const MediaLinkRow = memo(function MediaLinkRow({
  link,
  index,
  mediaTitle,
  isCopied,
  onCopy,
}: MediaLinkRowProps) {
  const isVideo = link.type === 'video';
  const isAudio = link.type === 'audio';
  const isImage = link.type === 'image';

  const safeTitle = useMemo(
    () => mediaTitle.slice(0, 36).replace(/[^a-zA-Z0-9_-]/g, '_'),
    [mediaTitle]
  );
  const filename = useMemo(() => {
    return `${safeTitle}${isAudio ? '.mp3' : isImage ? (link.extension ? `.${link.extension}` : '.jpg') : '.mp4'}`;
  }, [safeTitle, isAudio, isImage, link.extension]);

  const proxyDownloadUrl = useMemo(() => {
    return `/api/stream?url=${encodeURIComponent(link.url)}&filename=${encodeURIComponent(filename)}`;
  }, [link.url, filename]);

  return (
    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-surface-subtle)] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
          {isVideo ? (
            <Video className="w-4 h-4 text-[var(--accent-primary)]" />
          ) : isAudio ? (
            <Music className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : isImage ? (
            <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <LinkIcon className="w-4 h-4" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{link.label}</p>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>{link.extension ? link.extension.toUpperCase() : 'STREAM'}</span>
            {link.quality && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-numbers font-semibold text-[var(--accent-primary)]">
                  {link.quality}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={proxyDownloadUrl}
          download={filename}
          className="px-3.5 py-1.5 text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </a>

        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors"
          title="Buka langsung tautan"
        >
          <ExternalLink className="w-4 h-4" />
        </a>

        <button
          onClick={() => onCopy(link.url, index)}
          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
          title="Salin tautan stream"
          type="button"
        >
          {isCopied ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
});

// Memoized History Row Component
interface HistoryRowProps {
  item: ExtractionHistoryItem;
  onSelect: (url: string) => void;
}

const HistoryRow = memo(function HistoryRow({ item, onSelect }: HistoryRowProps) {
  const formattedTime = useMemo(() => {
    return new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [item.timestamp]);

  return (
    <div
      onClick={() => onSelect(item.url)}
      className="py-3 px-2 flex items-center justify-between gap-4 hover:bg-[var(--bg-surface-subtle)] rounded-xl cursor-pointer group transition-colors"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt="thumb"
            referrerPolicy="no-referrer"
            className="w-10 h-10 object-cover rounded-lg shrink-0 bg-[var(--bg-canvas)] border border-[var(--border-subtle)]"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-canvas)] text-[var(--text-secondary)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
            <Video className="w-4 h-4" />
          </div>
        )}
        <div className="overflow-hidden">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
            {item.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{item.platform || 'Media'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-numbers">{formattedTime}</span>
          </div>
        </div>
      </div>

      <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors shrink-0" />
    </div>
  );
});

// Memoized Static Section
const UnderTheHoodSection = memo(function UnderTheHoodSection() {
  return (
    <section id="hood" className="pt-4 border-t border-[var(--border-subtle)]">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Under the Hood</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Robust multi-engine pipeline engineered for longevity and uptime.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--accent-primary)] flex items-center justify-center mb-3 border border-[var(--border-subtle)]">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1.5">
            Multi-CDN Fallback Pool
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Connects to dynamic CDN pools with AES-128-CBC cipher resolution for YouTube and multi-origin parsers for TikTok.
          </p>
        </div>

        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface-subtle)] text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 border border-[var(--border-subtle)]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1.5">
            LRU Stream Cache
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            20-minute in-memory caching eliminates redundant external scraper calls, completely bypassing third-party rate limits.
          </p>
        </div>

        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface-subtle)] text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 border border-[var(--border-subtle)]">
            <Radio className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1.5">
            Browser Stream Attachment
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Direct media streams pass through a local HTTP pipeline setting attachment headers for seamless 1-click downloads.
          </p>
        </div>
      </div>
    </section>
  );
});

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
  const [showInstallModal, setShowInstallModal] = useState(false);

  // PWA Install Hook
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Mascot-derived Theme Initialization
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gorgelink_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

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

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

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

  const handleDirectInstall = useCallback(async () => {
    if (isInstallable) {
      const success = await install();
      if (success) return;
    }
    setShowInstallModal(true);
  }, [isInstallable, install]);

  const handlePasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      const input = document.getElementById('media-url-input') as HTMLInputElement;
      if (input) input.focus();
    }
  }, []);

  const handleDownload = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(cleanUrl)}`, {
        method: 'GET',
      });
      const data = await res.json();

      if (!data.Status) {
        setError(data.Error || 'Gagal mengekstrak media. Pastikan tautan bersifat publik dan valid.');
      } else {
        setResult(data.Result);

        const extracted = gatherLinks(data.Result);
        const title =
          data.Result?.title ||
          data.Result?.desc ||
          data.Result?.caption ||
          cleanUrl.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48);

        const coverImg =
          data.Result?.cover ||
          data.Result?.origin_cover ||
          data.Result?.thumbnail ||
          extracted.find((l) => l.url.includes('.jpg') || l.url.includes('.png') || l.url.includes('.webp'))?.url;

        let detectedPlatform = 'Universal';
        const lowerUrl = cleanUrl.toLowerCase();
        if (lowerUrl.includes('youtube') || lowerUrl.includes('youtu.be')) detectedPlatform = 'YouTube';
        else if (lowerUrl.includes('tiktok')) detectedPlatform = 'TikTok';
        else if (lowerUrl.includes('spotify') || lowerUrl.includes('open.spotify')) detectedPlatform = 'Spotify';
        else if (lowerUrl.includes('suno.com') || lowerUrl.includes('suno.ai')) detectedPlatform = 'Suno Music';
        else if (lowerUrl.includes('instagram')) detectedPlatform = 'Instagram';
        else if (lowerUrl.includes('twitter') || lowerUrl.includes('x.com')) detectedPlatform = 'Twitter / X';
        else if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.watch')) detectedPlatform = 'Facebook';
        else if (lowerUrl.includes('soundcloud')) detectedPlatform = 'SoundCloud';

        const newHistoryItem: ExtractionHistoryItem = {
          id: Date.now().toString(),
          url: cleanUrl,
          title: String(title),
          timestamp: Date.now(),
          thumbnail: coverImg,
          linksCount: extracted.length,
          platform: detectedPlatform,
        };

        setHistory((prevHistory) => {
          const updated = [newHistoryItem, ...prevHistory.filter((h) => h.url !== cleanUrl)].slice(0, 15);
          try {
            localStorage.setItem('gorgelink_history', JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
          return updated;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi gangguan jaringan saat memproses link.');
    } finally {
      setLoading(false);
    }
  }, [url]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('gorgelink_history');
  }, []);

  const handleCopyPayload = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const handleCopyLink = useCallback((linkUrl: string, index: number) => {
    navigator.clipboard.writeText(linkUrl);
    setCopiedLinkIndex(index);
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  }, []);

  const handleHistorySelect = useCallback((itemUrl: string) => {
    setUrl(itemUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Performance Optimization: Memoize heavy link extraction and parsing
  const rawLinks = useMemo(() => (result ? gatherLinks(result) : []), [result]);
  const links = useMemo(() => formatAndSortLinks(rawLinks), [rawLinks]);

  const mediaTitle = useMemo(() => {
    return result?.title || result?.desc || result?.caption || 'Media Asset';
  }, [result]);

  const mediaAuthor = useMemo(() => {
    return result?.author?.nickname || result?.author?.unique_id || null;
  }, [result]);

  const mediaDuration = useMemo(() => {
    return result?.duration ? String(result.duration) : null;
  }, [result]);

  const mediaCover = useMemo(() => {
    return (
      result?.cover ||
      result?.origin_cover ||
      result?.thumbnail ||
      links.find((l) => l.type === 'image')?.url
    );
  }, [result, links]);

  return (
    <div className="flex flex-col min-h-screen w-full font-sans transition-colors duration-200">
      {/* Top Bar: Mascot Avatar Icon + Brand + Navigation + Direct Install APK + Theme Switcher */}
      <header className="h-16 sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 sm:px-8 flex items-center justify-between gap-4 sm:gap-6 transition-colors shadow-xs">
        <a
          href="/"
          className="text-lg font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0 flex items-center gap-2.5 group"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-[var(--border-subtle)] shadow-xs shrink-0 bg-[var(--bg-canvas)] transition-transform group-hover:scale-105">
            <Image
              src="/icon.png"
              alt="GorgeLink Mascot"
              width={36}
              height={36}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <span className="font-extrabold tracking-tight">
            Gorge<span className="text-[var(--accent-primary)]">Link</span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-secondary)]">
          <a
            href="#extractor"
            onClick={() => setActiveTab('extractor')}
            className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'extractor' ? 'text-[var(--accent-primary)] font-bold' : ''
            }`}
          >
            Extractor
          </a>
          <a
            href="#hood"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Under the Hood
          </a>
          {history.length > 0 && (
            <button
              onClick={() => {
                setActiveTab((prev) => (prev === 'history' ? 'extractor' : 'history'));
                setShowHistory((prev) => !prev);
              }}
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
              type="button"
            >
              <span>Recent History</span>
              <span className="text-xs font-mono font-mono-numbers opacity-80 bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)]">
                {history.length}
              </span>
            </button>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {!isInstalled ? (
            <button
              onClick={handleDirectInstall}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-xs font-semibold shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
              title="Install GorgeLink as Web APK"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Install APK</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Installed</span>
            </div>
          )}

          <button
            onClick={toggleTheme}
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] text-xs font-medium transition-all shadow-xs cursor-pointer select-none"
            aria-label="Toggle theme mode"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowCommunityModal(true)}
            type="button"
            className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--border-subtle)] rounded-xl transition-colors whitespace-nowrap shrink-0 border border-[var(--border-subtle)] cursor-pointer"
          >
            Community
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10 flex flex-col gap-8" id="extractor">
        {/* Mascot Banner Hero Card */}
        <section className="w-full rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-xs relative bg-[var(--bg-surface)]">
          <div className="w-full aspect-[21/9] sm:aspect-[16/7] relative overflow-hidden bg-[var(--bg-canvas)]">
            <Image
              src="/banner.png"
              alt="GorgeLink Anime Mascot Banner"
              width={1200}
              height={525}
              className="w-full h-full object-cover object-center"
              priority
            />
          </div>
        </section>

        {/* Hero Headline & Subtitle */}
        <section className="flex flex-col items-center text-center max-w-3xl mx-auto -mt-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)] mb-2 tracking-wide uppercase">
            <span>Fast · Free · No Watermark · High Quality</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2.5 text-balance">
            GorgeLink Downloader
          </h1>

          <p className="text-sm sm:text-base text-[var(--text-secondary)] mb-6 max-w-2xl leading-relaxed">
            Unduh video resolusi tinggi, audio MP3, foto slide, dan cover dari YouTube, TikTok, Instagram, Spotify, Suno, dan platform lainnya.
          </p>

          {/* Extractor Input Card */}
          <div className="w-full bg-[var(--bg-surface)] p-3 sm:p-4 rounded-2xl border border-[var(--border-subtle)] shadow-xs">
            <form onSubmit={handleDownload} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative flex items-center">
                <input
                  id="media-url-input"
                  type="url"
                  placeholder="Tempel tautan video, musik, atau foto di sini..."
                  className="w-full h-12 bg-[var(--bg-canvas)] text-[var(--text-primary)] text-sm px-4 pr-24 rounded-xl border border-[var(--border-subtle)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none transition-all"
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
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                      title="Clear input"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] hover:bg-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
                    >
                      Paste
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="h-12 px-6 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-end gap-0.5 h-4">
                      <motion.span
                        animate={{ scaleY: [0.3, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 0.6, ease: 'easeInOut' }}
                        className="w-1 h-3.5 bg-current rounded-full origin-bottom"
                      />
                      <motion.span
                        animate={{ scaleY: [0.8, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 0.5, ease: 'easeInOut' }}
                        className="w-1 h-3.5 bg-current rounded-full origin-bottom"
                      />
                      <motion.span
                        animate={{ scaleY: [0.4, 0.9, 0.3] }}
                        transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
                        className="w-1 h-3.5 bg-current rounded-full origin-bottom"
                      />
                    </span>
                    <span>Memproses...</span>
                  </div>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Extract Media</span>
                  </>
                )}
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
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 text-xs rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compact Supported Platforms */}
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-muted)]">Supported:</span>
              {COMPACT_PLATFORMS.map((p, idx) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setUrl(p.placeholder)}
                  className="hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                  title={`Test format: ${p.placeholder}`}
                >
                  <span>{p.name}</span>
                  {idx < COMPACT_PLATFORMS.length - 1 && <span className="ml-2 opacity-30">·</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Modern Cyber Media Ingestion Loading State */}
        <AnimatePresence>
          {loading && <CyberLoadingScanner key="scanner" />}
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
              className="w-full bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 md:p-8 shadow-xs"
            >
              {/* Media Title & Author Block */}
              <div className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-[var(--border-subtle)]">
                {mediaCover && (
                  <div className="w-full sm:w-48 h-32 rounded-xl overflow-hidden shrink-0 bg-[var(--bg-canvas)] relative border border-[var(--border-subtle)]">
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] mb-1.5">
                      <span className="font-bold text-[var(--accent-primary)]">
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
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Cached instant</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] line-clamp-2">
                      {mediaTitle}
                    </h2>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className="font-mono-numbers">{links.length} opsi unduhan tersedia</span>
                  </div>
                </div>
              </div>

              {/* Formats Grid / Table */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Pilihan Format & Unduhan
                  </h3>
                  <span className="text-xs text-[var(--text-muted)]">Download langsung</span>
                </div>

                <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                  {links.map((link, idx) => (
                    <MediaLinkRow
                      key={`${link.url}-${idx}`}
                      link={link}
                      index={idx}
                      mediaTitle={mediaTitle}
                      isCopied={copiedLinkIndex === idx}
                      onCopy={handleCopyLink}
                    />
                  ))}
                </div>
              </div>

              {/* Developer JSON Inspector */}
              <details className="mt-6 border border-[var(--border-subtle)] rounded-xl overflow-hidden group">
                <summary className="px-4 py-2 bg-[var(--bg-canvas)] text-xs font-medium text-[var(--text-secondary)] cursor-pointer flex items-center justify-between select-none">
                  <span>Raw API Response Payload</span>
                  <span className="group-open:rotate-180 transition-transform text-xs">▼</span>
                </summary>
                <div className="p-4 bg-[#070D18] text-xs font-mono text-neutral-200 whitespace-pre-wrap overflow-x-auto max-h-60 relative">
                  <button
                    onClick={handleCopyPayload}
                    type="button"
                    className="absolute top-3 right-3 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                  {JSON.stringify(result, null, 2)}
                </div>
              </details>
            </motion.section>
          )}
        </AnimatePresence>

        {/* History Section */}
        {showHistory && history.length > 0 && (
          <section className="w-full bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Recent Extractions</h3>
                <p className="text-xs text-[var(--text-secondary)]">Tersimpan secara lokal di browser</p>
              </div>
              <button
                onClick={clearHistory}
                type="button"
                className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Riwayat
              </button>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {history.map((item) => (
                <HistoryRow
                  key={item.id}
                  item={item}
                  onSelect={handleHistorySelect}
                />
              ))}
            </div>
          </section>
        )}

        {/* Extraction Matrix: Under the Hood Architecture 3 Cards */}
        <UnderTheHoodSection />
      </main>

      {/* Footer: Clean branded layout with mascot */}
      <footer className="w-full border-t border-[var(--border-subtle)] py-6 bg-[var(--bg-surface)] px-4 sm:px-8 mt-auto transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg overflow-hidden border border-[var(--border-subtle)] shadow-2xs shrink-0">
              <Image
                src="/icon.png"
                alt="GorgeLink Chibi"
                width={24}
                height={24}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-extrabold text-[var(--text-primary)]">GorgeLink Downloader</span>
            <span aria-hidden="true">·</span>
            <span>Universal Media & Audio Engine</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleDirectInstall}
              type="button"
              className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              <Smartphone className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Install APK</span>
            </button>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/ganggaa-coder/gorgelink"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              GitHub
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.instagram.com/g4nggaa?igsh=eW4zeWY1NjY3a2k2"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Developer: G4NGGAAA
            </a>
            <span aria-hidden="true">·</span>
            <span className="font-mono-numbers">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Direct Install APK Guide Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] w-full max-w-md p-6 rounded-2xl relative shadow-2xl"
            >
              <button
                onClick={() => setShowInstallModal(false)}
                type="button"
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-[var(--border-subtle)] shadow-xs shrink-0">
                  <Image
                    src="/icon.png"
                    alt="GorgeLink Icon"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold">Pasang GorgeLink (Web APK)</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Instal langsung ke layar utama HP atau desktop
                  </p>
                </div>
              </div>

              {isInstallable && (
                <div className="mb-4">
                  <button
                    onClick={async () => {
                      await install();
                      setShowInstallModal(false);
                    }}
                    type="button"
                    className="w-full py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Lanjutkan Instalasi Sekarang</span>
                  </button>
                </div>
              )}

              <div className="space-y-3 text-xs text-[var(--text-secondary)]">
                <div className="p-3.5 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Untuk HP Android (Chrome / Samsung / Edge):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Ketuk ikon titik tiga <MoreVertical className="w-3.5 h-3.5 inline text-[var(--text-muted)]" /> di pojok kanan atas browser.</li>
                    <li>Pilih menu <strong>"Instal Aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</li>
                    <li>GorgeLink akan langsung terpasang di HP seperti APK asli.</li>
                  </ol>
                </div>

                <div className="p-3.5 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-1.5">
                    <Share className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>Untuk iPhone / iPad (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Ketuk tombol <strong>Bagikan (Share)</strong> <Share className="w-3.5 h-3.5 inline text-[var(--text-muted)]" /> di bilah bawah Safari.</li>
                    <li>Gulir dan ketuk <strong>"Tambahkan ke Layar Utama"</strong>.</li>
                    <li>Ketuk <strong>Tambah</strong> di pojok kanan atas.</li>
                  </ol>
                </div>

                <div className="p-3.5 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-1.5">
                    <Laptop className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Untuk Laptop / PC (Chrome / Edge):</span>
                  </div>
                  <p className="pl-1">
                    Klik ikon instal di ujung kanan address bar browser (atau Menu ➔ "Instal GorgeLink").
                  </p>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setShowInstallModal(false)}
                  type="button"
                  className="w-full py-2 bg-[var(--bg-surface-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold rounded-xl transition-colors cursor-pointer border border-[var(--border-subtle)]"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] w-full max-w-sm p-6 rounded-2xl relative shadow-xl"
            >
              <button
                onClick={() => setShowCommunityModal(false)}
                type="button"
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold mb-1">GorgeLink Community</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-5">
                Bergabunglah dengan channel resmi WhatsApp kami untuk pembaruan fitur, changelog API, dan panduan.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="https://whatsapp.com/channel/0029Vb6DPnBIXnliEawZjb41"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowCommunityModal(false)}
                  className="h-10 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-xs font-bold rounded-xl flex items-center justify-center transition-colors shadow-xs"
                >
                  Join WhatsApp Channel
                </a>
                <button
                  onClick={() => setShowCommunityModal(false)}
                  type="button"
                  className="h-10 bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] text-xs font-medium rounded-xl hover:bg-[var(--border-subtle)] transition-colors border border-[var(--border-subtle)] cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
