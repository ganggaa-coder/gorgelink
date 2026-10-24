import { createDecipheriv } from 'crypto';

interface MediaItem {
  label: string;
  url: string;
  type: 'video' | 'audio' | 'image' | 'source' | 'other';
  quality?: string;
  extension?: string;
  size?: string;
}

interface ExtractionResult {
  title: string;
  cover?: string;
  duration?: string | number;
  author?: {
    nickname?: string;
    avatar?: string;
  };
  url?: string;
  medias: MediaItem[];
  platform?: string;
  cached?: boolean;
}

// In-memory cache for long-lasting performance and zero rate-limiting (15 minute TTL)
interface CacheEntry {
  data: ExtractionResult;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getFromCache(key: string): ExtractionResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return { ...entry.data, cached: true };
}

function setCache(key: string, data: ExtractionResult) {
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function decodeSavetube(enc: string) {
  try {
    const secretKey = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
    const data = Buffer.from(enc, 'base64');
    const iv = data.subarray(0, 16);
    const content = data.subarray(16);
    const key = Buffer.from(secretKey, 'hex');
    const decipher = createDecipheriv('aes-128-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
    return JSON.parse(decrypted.toString());
  } catch (error: any) {
    throw new Error('Savetube decrypt failed: ' + error.message);
  }
}

async function parseYouTube(rawUrl: string): Promise<ExtractionResult> {
  let cdn = 'cdn400.savetube.vip';
  try {
    const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', {
      signal: AbortSignal.timeout(3500),
    });
    if (cdnRes.ok) {
      const cdnData = await cdnRes.json();
      if (cdnData.cdn) cdn = cdnData.cdn;
    }
  } catch (e) {
    // fallback
  }

  const infoRes = await fetch(`https://${cdn}/v2/info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Referer: 'https://save-tube.com/',
    },
    body: JSON.stringify({ url: rawUrl }),
    signal: AbortSignal.timeout(12000),
  });

  if (!infoRes.ok) {
    throw new Error(`YouTube resolver returned status: ${infoRes.status}`);
  }

  const infoget = await infoRes.json();
  if (!infoget?.data) {
    throw new Error('Failed to parse YouTube stream metadata');
  }

  const info = decodeSavetube(infoget.data);

  // Fetch HD 720p download URL
  let hdUrl = '';
  try {
    const dlRes = await fetch(`https://${cdn}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://save-tube.com/',
      },
      body: JSON.stringify({ downloadType: 'video', quality: '720', key: info.key }),
      signal: AbortSignal.timeout(6000),
    });
    const dlData = await dlRes.json();
    hdUrl = dlData.data?.downloadUrl || '';
  } catch (e) {
    // Non-fatal
  }

  // Fetch 1080p Full HD download URL
  let fhdUrl = '';
  try {
    const dlRes = await fetch(`https://${cdn}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://save-tube.com/',
      },
      body: JSON.stringify({ downloadType: 'video', quality: '1080', key: info.key }),
      signal: AbortSignal.timeout(6000),
    });
    const dlData = await dlRes.json();
    fhdUrl = dlData.data?.downloadUrl || '';
  } catch (e) {
    // Non-fatal
  }

  // Fetch MP3 Audio download URL
  let audioUrl = '';
  try {
    const aRes = await fetch(`https://${cdn}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://save-tube.com/',
      },
      body: JSON.stringify({ downloadType: 'audio', quality: '128', key: info.key }),
      signal: AbortSignal.timeout(6000),
    });
    const aData = await aRes.json();
    audioUrl = aData.data?.downloadUrl || '';
  } catch (e) {
    // Non-fatal
  }

  const medias: MediaItem[] = [];

  if (fhdUrl) {
    medias.push({
      label: 'Video 1080p (Full HD)',
      url: fhdUrl,
      type: 'video',
      quality: '1080p',
      extension: 'mp4',
    });
  }

  if (hdUrl) {
    medias.push({
      label: 'Video 720p (HD)',
      url: hdUrl,
      type: 'video',
      quality: '720p',
      extension: 'mp4',
    });
  }

  if (info.video_formats?.[0]?.url) {
    medias.push({
      label: 'Video 360p (SD Direct)',
      url: info.video_formats[0].url,
      type: 'video',
      quality: '360p',
      extension: 'mp4',
    });
  }

  if (audioUrl) {
    medias.push({
      label: 'Audio MP3 (128 kbps)',
      url: audioUrl,
      type: 'audio',
      quality: '128kbps',
      extension: 'mp3',
    });
  }

  if (info.thumbnail) {
    medias.push({
      label: 'Cover Thumbnail',
      url: info.thumbnail,
      type: 'image',
      extension: 'webp',
    });
  }

  return {
    title: info.title || 'YouTube Video',
    cover: info.thumbnail,
    duration: info.durationLabel || info.duration,
    author: {
      nickname: 'YouTube Creator',
    },
    url: hdUrl || fhdUrl || info.video_formats?.[0]?.url || rawUrl,
    medias,
    platform: 'YouTube',
  };
}

async function parseTikTokFallback(rawUrl: string): Promise<ExtractionResult | null> {
  try {
    const tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(rawUrl)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!tikwmRes.ok) return null;

    const tikData = await tikwmRes.json();
    if (tikData.code === 0 && tikData.data) {
      const medias: MediaItem[] = [];

      if (tikData.data.play) {
        medias.push({
          label: 'Video (No Watermark)',
          url: tikData.data.play,
          type: 'video',
          quality: 'HD',
          extension: 'mp4',
        });
      }

      if (tikData.data.hdplay) {
        medias.push({
          label: 'Video (Full HD)',
          url: tikData.data.hdplay,
          type: 'video',
          quality: '1080p',
          extension: 'mp4',
        });
      }

      if (tikData.data.music) {
        medias.push({
          label: 'Audio Track (MP3)',
          url: tikData.data.music,
          type: 'audio',
          extension: 'mp3',
        });
      }

      if (tikData.data.origin_cover || tikData.data.cover) {
        medias.push({
          label: 'Cover Photo',
          url: tikData.data.origin_cover || tikData.data.cover,
          type: 'image',
          extension: 'jpg',
        });
      }

      return {
        title: tikData.data.title || 'TikTok Video',
        cover: tikData.data.cover || tikData.data.origin_cover,
        author: {
          nickname: tikData.data.author?.nickname || tikData.data.author?.unique_id,
          avatar: tikData.data.author?.avatar,
        },
        duration: tikData.data.duration,
        url: tikData.data.play,
        medias,
        platform: 'TikTok',
      };
    }
  } catch (e) {
    console.warn('TikWM scraper error:', e);
  }
  return null;
}

export class VidsSave {
  baseUrl: string;
  auth: string;
  domain: string;

  constructor() {
    this.baseUrl = 'https://api.vidssave.com/api/contentsite_api';
    this.auth = '20250901majwlqo';
    this.domain = 'api-ak.vidssave.com';
  }

  async download(url: string): Promise<ExtractionResult | any> {
    if (!url) throw new Error('URL is required');

    const cleanUrl = url.trim();

    // Check LRU Cache
    const cached = getFromCache(cleanUrl);
    if (cached) {
      return cached;
    }

    // 1. YouTube Dedicated Scraper
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      try {
        const ytResult = await parseYouTube(cleanUrl);
        setCache(cleanUrl, ytResult);
        return ytResult;
      } catch (ytErr: any) {
        console.warn('YouTube direct parser failed, falling back to oEmbed:', ytErr);
        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`
          );
          if (oembedRes.ok) {
            const oembed = await oembedRes.json();
            const fallbackResult: ExtractionResult = {
              title: oembed.title || 'YouTube Video',
              cover: oembed.thumbnail_url,
              author: { nickname: oembed.author_name },
              medias: [
                {
                  label: 'Cover Thumbnail (HD)',
                  url: oembed.thumbnail_url,
                  type: 'image',
                  extension: 'jpg',
                },
                {
                  label: 'Original Source',
                  url: cleanUrl,
                  type: 'source',
                },
              ],
              platform: 'YouTube',
            };
            setCache(cleanUrl, fallbackResult);
            return fallbackResult;
          }
        } catch (e) {
          // ignore
        }
        throw new Error('Unable to extract YouTube video. Ensure the video is public and valid.');
      }
    }

    // 2. TikTok Scraper (with fallback)
    if (cleanUrl.includes('tiktok.com')) {
      const tikwmResult = await parseTikTokFallback(cleanUrl);
      if (tikwmResult && tikwmResult.medias.length > 0) {
        setCache(cleanUrl, tikwmResult);
        return tikwmResult;
      }
    }

    // 3. Multi-platform Universal Resolver (Instagram, Facebook, Threads, X, SoundCloud, etc.)
    try {
      const payload = new URLSearchParams({
        auth: this.auth,
        domain: this.domain,
        origin: 'source',
        link: cleanUrl,
      });

      const res = await fetch(`${this.baseUrl}/media/parse`, {
        method: 'POST',
        headers: {
          accept: '*/*',
          'accept-language': 'id-ID,en-US;q=0.9,en;q=0.8',
          'cache-control': 'no-cache',
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://vidssave.com',
          pragma: 'no-cache',
          referer: 'https://vidssave.com/',
          'user-agent':
            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
        },
        body: payload.toString(),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && (data.data || (data.status !== 0 && data.status_code !== 'analyze_failed'))) {
          const resultData = data.data || data;
          setCache(cleanUrl, resultData);
          return resultData;
        }
      }
    } catch (primaryErr) {
      console.warn('Universal parser error:', primaryErr);
    }

    // Last-ditch TikTok fallback if it wasn't caught earlier
    if (cleanUrl.includes('tiktok.com')) {
      const fallback = await parseTikTokFallback(cleanUrl);
      if (fallback) {
        setCache(cleanUrl, fallback);
        return fallback;
      }
    }

    throw new Error('Unable to parse media from this link. Please check if the post is public and supported.');
  }
}

export const api = new VidsSave();
