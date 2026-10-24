import { createDecipheriv } from 'crypto';

export interface MediaItem {
  label: string;
  url: string;
  type: 'video' | 'audio' | 'image' | 'source' | 'other';
  quality?: string;
  extension?: string;
  size?: string;
  bitrate?: string;
}

export interface ExtractionResult {
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

// In-memory LRU Cache with 20 minutes TTL for maximum longevity & zero rate-limiting
interface CacheEntry {
  data: ExtractionResult;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 20 * 60 * 1000;

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
  if (cache.size > 300) {
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

// Extract comprehensive formats for YouTube (All video resolutions, All audio bitrates, All covers)
async function parseYouTubeComprehensive(rawUrl: string): Promise<ExtractionResult> {
  const cdnList = ['cdn400.savetube.vip', 'cdn406.savetube.vip', 'cdn408.savetube.vip'];
  let cdn = cdnList[Math.floor(Math.random() * cdnList.length)];

  try {
    const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', {
      signal: AbortSignal.timeout(3000),
    });
    if (cdnRes.ok) {
      const cdnData = await cdnRes.json();
      if (cdnData.cdn) cdn = cdnData.cdn;
    }
  } catch (e) {
    // fallback to selected CDN
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
    throw new Error(`YouTube resolver returned HTTP ${infoRes.status}`);
  }

  const infoget = await infoRes.json();
  if (!infoget?.data) {
    throw new Error('Failed to parse YouTube stream metadata');
  }

  const info = decodeSavetube(infoget.data);
  const medias: MediaItem[] = [];

  // Parallel fetch for video resolutions (1080p, 720p, 480p)
  const videoQualities = ['1080', '720', '480'];
  const videoPromises = videoQualities.map(async (q) => {
    try {
      const dlRes = await fetch(`https://${cdn}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://save-tube.com/',
        },
        body: JSON.stringify({ downloadType: 'video', quality: q, key: info.key }),
        signal: AbortSignal.timeout(7000),
      });
      const dlData = await dlRes.json();
      if (dlData.data?.downloadUrl) {
        return {
          label: q === '1080' ? 'Video 1080p (Full HD)' : q === '720' ? 'Video 720p (HD)' : 'Video 480p (Medium)',
          url: dlData.data.downloadUrl,
          type: 'video' as const,
          quality: `${q}p`,
          extension: 'mp4',
        };
      }
    } catch {
      // non-fatal
    }
    return null;
  });

  // Parallel fetch for audio bitrates (320kbps, 256kbps, 128kbps)
  const audioQualities = ['320', '256', '128'];
  const audioPromises = audioQualities.map(async (q) => {
    try {
      const dlRes = await fetch(`https://${cdn}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://save-tube.com/',
        },
        body: JSON.stringify({ downloadType: 'audio', quality: q, key: info.key }),
        signal: AbortSignal.timeout(7000),
      });
      const dlData = await dlRes.json();
      if (dlData.data?.downloadUrl) {
        return {
          label:
            q === '320'
              ? 'Audio MP3 (320 kbps Studio Quality)'
              : q === '256'
              ? 'Audio MP3 (256 kbps High Fidelity)'
              : 'Audio MP3 (128 kbps Standard)',
          url: dlData.data.downloadUrl,
          type: 'audio' as const,
          quality: `${q} kbps`,
          extension: 'mp3',
        };
      }
    } catch {
      // non-fatal
    }
    return null;
  });

  const [videoResults, audioResults] = await Promise.all([
    Promise.all(videoPromises),
    Promise.all(audioPromises),
  ]);

  videoResults.forEach((v) => {
    if (v) medias.push(v);
  });

  // Direct fast stream from YouTube formats if available
  if (info.video_formats?.[0]?.url) {
    medias.push({
      label: 'Video 360p (Direct Google Stream)',
      url: info.video_formats[0].url,
      type: 'video',
      quality: '360p',
      extension: 'mp4',
    });
  }

  audioResults.forEach((a) => {
    if (a) medias.push(a);
  });

  // All thumbnail resolutions
  const videoId = info.id || (rawUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1]);
  if (videoId) {
    medias.push({
      label: 'Cover Thumbnail (MaxRes 1920x1080)',
      url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      type: 'image',
      quality: '1080p',
      extension: 'jpg',
    });
    medias.push({
      label: 'Cover Thumbnail (HQ 640x480)',
      url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      type: 'image',
      quality: '480p',
      extension: 'jpg',
    });
  } else if (info.thumbnail) {
    medias.push({
      label: 'Cover Thumbnail',
      url: info.thumbnail,
      type: 'image',
      extension: 'webp',
    });
  }

  return {
    title: info.title || 'YouTube Video',
    cover: info.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : undefined),
    duration: info.durationLabel || (info.duration ? `${Math.round(Number(info.duration) / 60)} min` : undefined),
    author: {
      nickname: 'YouTube Creator',
    },
    url: medias[0]?.url || rawUrl,
    medias,
    platform: 'YouTube',
  };
}

// TikTok Comprehensive Multi-Quality Resolver
async function parseTikTok(rawUrl: string): Promise<ExtractionResult | null> {
  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(rawUrl)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const d = json.data;
        const medias: MediaItem[] = [];

        if (d.play) {
          medias.push({
            label: 'Video (HD No Watermark)',
            url: d.play,
            type: 'video',
            quality: 'HD',
            extension: 'mp4',
          });
        }

        if (d.hdplay) {
          medias.push({
            label: 'Video 1080p (Full HD)',
            url: d.hdplay,
            type: 'video',
            quality: '1080p',
            extension: 'mp4',
          });
        }

        if (d.wmplay) {
          medias.push({
            label: 'Video (Original Watermarked)',
            url: d.wmplay,
            type: 'video',
            quality: 'Watermarked',
            extension: 'mp4',
          });
        }

        if (d.music) {
          medias.push({
            label: 'Audio Track (Original MP3)',
            url: d.music,
            type: 'audio',
            quality: '128 kbps',
            extension: 'mp3',
          });
        }

        if (d.images && Array.isArray(d.images)) {
          d.images.forEach((imgUrl: string, idx: number) => {
            medias.push({
              label: `Photo Slide ${idx + 1} (Original JPG)`,
              url: imgUrl,
              type: 'image',
              extension: 'jpg',
            });
          });
        }

        if (d.origin_cover || d.cover) {
          medias.push({
            label: 'Cover Photo (Original HD)',
            url: d.origin_cover || d.cover,
            type: 'image',
            extension: 'jpg',
          });
        }

        return {
          title: d.title || 'TikTok Media',
          cover: d.origin_cover || d.cover,
          duration: d.duration ? `${d.duration}s` : undefined,
          author: {
            nickname: d.author?.nickname || d.author?.unique_id,
            avatar: d.author?.avatar,
          },
          url: d.play || rawUrl,
          medias,
          platform: 'TikTok',
        };
      }
    }
  } catch (e) {
    console.warn('TikWM scraper error:', e);
  }
  return null;
}

// Twitter / X Resolver
async function parseTwitter(rawUrl: string): Promise<ExtractionResult | null> {
  const statusMatch = rawUrl.match(/(?:twitter\.com|x\.com)\/(?:[a-zA-Z0-9_]+)\/status\/([0-9]+)/);
  if (!statusMatch) return null;
  const tweetId = statusMatch[1];

  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GorgeLinkBot/2.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.tweet) {
        const t = data.tweet;
        const medias: MediaItem[] = [];

        if (t.media?.videos && Array.isArray(t.media.videos)) {
          t.media.videos.forEach((vid: any, idx: number) => {
            if (vid.url) {
              medias.push({
                label: `Video Stream ${idx + 1} (MP4)`,
                url: vid.url,
                type: 'video',
                extension: 'mp4',
              });
            }
          });
        }

        if (t.media?.photos && Array.isArray(t.media.photos)) {
          t.media.photos.forEach((photo: any, idx: number) => {
            if (photo.url) {
              medias.push({
                label: `Photo ${idx + 1} (Full HD JPG)`,
                url: photo.url,
                type: 'image',
                extension: 'jpg',
              });
            }
          });
        }

        if (medias.length > 0) {
          return {
            title: t.text || 'Twitter / X Post',
            cover: t.media?.photos?.[0]?.url || t.media?.videos?.[0]?.thumbnail_url,
            author: {
              nickname: t.author?.name || t.author?.screen_name,
              avatar: t.author?.avatar_url,
            },
            url: medias[0].url,
            medias,
            platform: 'Twitter / X',
          };
        }
      }
    }
  } catch (e) {
    console.warn('Twitter parser error:', e);
  }
  return null;
}

// Cobalt Tools API Parser (Untuk Instagram, Facebook, Reddit, Pinterest, dll)
async function parseCobaltTools(rawUrl: string): Promise<ExtractionResult | null> {
  try {
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({ url: rawUrl }),
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const data = await res.json();
      const medias: MediaItem[] = [];

      if (data.status === 'stream' || data.status === 'redirect' || data.url) {
        medias.push({
          label: 'Direct Download Media',
          url: data.url,
          type: (data.url.includes('.mp4') || data.url.includes('.webm')) ? 'video' : 'other',
          extension: data.url.includes('.mp4') ? 'mp4' : 'auto'
        });
      } else if (data.status === 'picker' && Array.isArray(data.picker)) {
        data.picker.forEach((item: any, idx: number) => {
          medias.push({
            label: `Gallery Media ${idx + 1}`,
            url: item.url,
            type: item.type === 'video' ? 'video' : 'image',
            extension: item.type === 'video' ? 'mp4' : 'jpg'
          });
        });
      }

      if (medias.length > 0) {
        let platform = 'Other';
        if (rawUrl.includes('instagram.com')) platform = 'Instagram';
        else if (rawUrl.includes('facebook.com') || rawUrl.includes('fb.watch')) platform = 'Facebook';
        else if (rawUrl.includes('reddit.com')) platform = 'Reddit';
        else if (rawUrl.includes('pinterest.com')) platform = 'Pinterest';

        return {
          title: data.text || `${platform} Media Post`,
          url: medias[0].url,
          medias,
          platform
        };
      }
    }
  } catch (e) {
    console.warn('Cobalt tools parser error:', e);
  }
  return null;
}

// Universal Multi-Platform Engine
export class MediaEngine {
  async download(url: string): Promise<ExtractionResult> {
    if (!url) throw new Error('URL is required');

    const cleanUrl = url.trim();

    // 1. Check LRU Cache
    const cached = getFromCache(cleanUrl);
    if (cached) {
      return cached;
    }

    const lower = cleanUrl.toLowerCase();

    // 2. YouTube Engine (Comprehensive All-in-One Formats)
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      try {
        const ytResult = await parseYouTubeComprehensive(cleanUrl);
        setCache(cleanUrl, ytResult);
        return ytResult;
      } catch (err: any) {
        console.warn('YouTube Comprehensive failed, falling back to oEmbed:', err);
        try {
          const oembed = await (
            await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`)
          ).json();
          const videoId = cleanUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
          const fallback: ExtractionResult = {
            title: oembed.title || 'YouTube Video',
            cover: oembed.thumbnail_url,
            author: { nickname: oembed.author_name },
            medias: [
              ...(videoId
                ? [
                    {
                      label: 'Cover Thumbnail (MaxRes 1920x1080)',
                      url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                      type: 'image' as const,
                      extension: 'jpg',
                    },
                    {
                      label: 'Cover Thumbnail (HQ 640x480)',
                      url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                      type: 'image' as const,
                      extension: 'jpg',
                    },
                  ]
                : [
                    {
                      label: 'Cover Thumbnail',
                      url: oembed.thumbnail_url,
                      type: 'image' as const,
                      extension: 'jpg',
                    },
                  ]),
              {
                label: 'Original Media Link',
                url: cleanUrl,
                type: 'source' as const,
              },
            ],
            platform: 'YouTube',
          };
          setCache(cleanUrl, fallback);
          return fallback;
        } catch {
          // ignore
        }
      }
    }

    // 3. TikTok Engine
    if (lower.includes('tiktok.com')) {
      const tiktokResult = await parseTikTok(cleanUrl);
      if (tiktokResult && tiktokResult.medias.length > 0) {
        setCache(cleanUrl, tiktokResult);
        return tiktokResult;
      }
    }

    // 4. Twitter / X Engine
    if (lower.includes('twitter.com') || lower.includes('x.com')) {
      const twResult = await parseTwitter(cleanUrl);
      if (twResult && twResult.medias.length > 0) {
        setCache(cleanUrl, twResult);
        return twResult;
      }
    }

    // 5. Instagram / Facebook / Reddit Engine (Cobalt) - Diutamakan sebelum multi-source yg sering error
    if (lower.includes('instagram.com') || lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('reddit.com')) {
      const cobaltResult = await parseCobaltTools(cleanUrl);
      if (cobaltResult) {
        setCache(cleanUrl, cobaltResult);
        return cobaltResult;
      }
    }

    // 6. Generic Multi-Source Resolver (Vidssave)
    try {
      const payload = new URLSearchParams({
        auth: '4c9b7d21',
        hostname: 'vidssave.com',
        domain: 'api-ak.vidssave.com',
        origin: 'source',
        link: cleanUrl,
      });

      const res = await fetch('https://api.vidssave.com/api/contentsite_api/media/parse', {
        method: 'POST',
        headers: {
          accept: '*/*',
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://vidssave.com',
          referer: 'https://vidssave.com/',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        body: payload.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && (data.data || (data.status !== 0 && data.status_code !== 'analyze_risk' && data.status_code !== 'analyze_failed'))) {
          const resultData = data.data || data;
          
          let parsedMedias: MediaItem[] = [];
          if (Array.isArray(resultData.medias)) {
            parsedMedias = resultData.medias;
          } else if (resultData.url || resultData.play) {
            parsedMedias.push({ label: 'Media', url: resultData.url || resultData.play, type: 'other' });
          }

          if (parsedMedias.length > 0) {
            const mappedResult: ExtractionResult = {
              title: resultData.title || 'Media Content',
              cover: resultData.thumbnail || resultData.cover,
              duration: resultData.duration,
              medias: parsedMedias,
              url: parsedMedias[0].url,
              platform: 'Multi-Source',
            };
            setCache(cleanUrl, mappedResult);
            return mappedResult;
          }
        }
      }
    } catch (e) {
      console.warn('Fallback multi-source parser error:', e);
    }

    // 7. Last Resort Fallback (Cobalt untuk segala jenis link yang tidak masuk ke if di atas)
    const finalCobalt = await parseCobaltTools(cleanUrl);
    if (finalCobalt) {
      setCache(cleanUrl, finalCobalt);
      return finalCobalt;
    }

    throw new Error('Unable to extract media from this URL. Please verify the URL is public and supported.');
  }
}

export const api = new MediaEngine();
export const VidsSave = MediaEngine;
