import manifest from '../../public/instagram/media_manifest.json';
import { SITE } from './siteData';

/** Weighted reach score: likes + comments×3 + views×0.1 */
export function getReach(post) {
  return (post.likes ?? 0) + (post.comments ?? 0) * 3 + (post.views ?? 0) * 0.1;
}

const CATEGORY_META = {
  'winter-snow': {
    id: 'winter-snow',
    label: 'Winter & Snow',
    emoji: '❄️',
    description: 'First snowfall, cozy mornings, and the valley in white.',
    featured: true,
  },
  'life-at-chhaon': {
    id: 'life-at-chhaon',
    label: 'Life at Chhaon',
    emoji: '🏠',
    description: 'Bonfires, strangers turned friends, and Amrit holding court.',
  },
  'the-stay': {
    id: 'the-stay',
    label: 'The Stay',
    emoji: '🛏️',
    description: 'Rooms, views, and why travellers keep coming back.',
  },
  'mountains-adventures': {
    id: 'mountains-adventures',
    label: 'Mountains & Trails',
    emoji: '🥾',
    description: 'Hikes, hidden waterfalls, and slow days in the valley.',
  },
  'spring-festivals': {
    id: 'spring-festivals',
    label: 'Spring & Festivals',
    emoji: '🌸',
    description: 'Holi colours, spring rain, and the mountains waking up.',
  },
};

/** Curated category per shortcode — overrides keyword heuristics for edge cases */
const CATEGORY_OVERRIDES = {
  DSryk2fkrqL: 'winter-snow',
  DS4eXfZkjcN: 'winter-snow',
  DSpFvuukttV: 'winter-snow',
  DWyxYqKCWD9: 'winter-snow',
  'DW1sSB-E7nD': 'winter-snow',
  DTsdlbDj3WJ: 'mountains-adventures',
  'DSSI-Kwkhvs': 'life-at-chhaon',
  DSPWgT8DE6D: 'mountains-adventures',
  DSKGhKEElRx: 'life-at-chhaon',
};

function categorize(post) {
  if (CATEGORY_OVERRIDES[post.shortcode]) {
    return CATEGORY_OVERRIDES[post.shortcode];
  }

  const text = `${post.caption_preview} ${post.date}`.toLowerCase();

  if (/snow|snowfall|winter|cold bite|christmas|cozy|warmth within|hot chocolate|❄|☃|🌨|first snowfall|snow falling|spring snow|in winter/i.test(text)) {
    return 'winter-snow';
  }
  if (/holi|spring arrives|🌸|march turns gently|bloom|flower/i.test(text)) {
    return 'spring-festivals';
  }
  if (/raghupur|jalori|hike|trail|trek|waterfall|sunset|sajwar|sketch walk|fort|adventure|things to do|moving postcard|tirthan/i.test(text)) {
    return 'mountains-adventures';
  }
  if (/host|amrit|bonfire|dance|games|music|community|stranger|dosti|art inside|people don|solo trip|20s|theory|postcards/i.test(text)) {
    return 'life-at-chhaon';
  }
  return 'the-stay';
}

function mediaUrl(filename) {
  if (filename.endsWith('.mp4')) return `/instagram/reels/${filename}`;
  return `/instagram/images/${filename}`;
}

function enrichPost(raw) {
  const files = raw.files ?? [];
  const videoFile = files.find((f) => f.endsWith('.mp4'));
  const imageFiles = files.filter((f) => f.endsWith('.jpg'));
  const thumbFile =
    imageFiles.find((f) => f.includes('_thumb.')) ??
    imageFiles.find((f) => f.includes('_img.')) ??
    imageFiles[0];

  const category = categorize(raw);
  const reach = getReach(raw);
  const isReel = raw.type === 'reel' || Boolean(videoFile);

  return {
    id: raw.shortcode,
    shortcode: raw.shortcode,
    date: raw.date,
    type: raw.type,
    caption: raw.caption_preview,
    likes: raw.likes,
    comments: raw.comments,
    views: raw.views,
    reach,
    category,
    isReel,
    hasVideo: Boolean(videoFile),
    thumbnail: thumbFile ? mediaUrl(thumbFile) : null,
    video: videoFile ? mediaUrl(videoFile) : null,
    images: imageFiles.map(mediaUrl),
    instagramUrl: isReel
      ? `https://www.instagram.com/reel/${raw.shortcode}/`
      : `https://www.instagram.com/p/${raw.shortcode}/`,
    isFeaturedWinter: category === 'winter-snow' && reach >= 240,
  };
}

export const INSTAGRAM_POSTS = manifest.map(enrichPost).sort((a, b) => b.reach - a.reach);

export const INSTAGRAM_CATEGORIES = Object.values(CATEGORY_META).map((cat) => ({
  ...cat,
  posts: INSTAGRAM_POSTS.filter((p) => p.category === cat.id),
}));

export const WINTER_FEATURED = INSTAGRAM_POSTS.filter((p) => p.category === 'winter-snow')
  .sort((a, b) => b.reach - a.reach)
  .slice(0, 6);

export const TOP_POSTS = INSTAGRAM_POSTS.slice(0, 8);

export const INSTAGRAM_PROFILE = {
  url: SITE.instagram,
  handle: SITE.instagramHandle,
  postCount: INSTAGRAM_POSTS.length,
  totalLikes: INSTAGRAM_POSTS.reduce((sum, p) => sum + (p.likes ?? 0), 0),
};

export function formatEngagement(n) {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}
