import { useState, useCallback, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Snowflake } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  INSTAGRAM_POSTS,
  INSTAGRAM_CATEGORIES,
  WINTER_FEATURED,
  INSTAGRAM_PROFILE,
  formatEngagement,
} from '../data/instagramGallery';
import { SITE } from '../data/siteData';
import {
  SnowParticles,
  GalleryCard,
  Lightbox,
  InstagramIcon,
} from '../components/instagram/GalleryShared';
import '../App.css';

const VALID_CATS = new Set(['all', ...INSTAGRAM_CATEGORIES.map((c) => c.id)]);

export default function Gallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catParam = searchParams.get('cat') ?? 'winter-snow';
  const postParam = searchParams.get('post');
  const initialCategory = VALID_CATS.has(catParam) ? catParam : 'winter-snow';

  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [lightboxPost, setLightboxPost] = useState(null);

  const filteredPosts = useMemo(
    () =>
      activeCategory === 'all'
        ? INSTAGRAM_POSTS
        : INSTAGRAM_POSTS.filter((p) => p.category === activeCategory),
    [activeCategory],
  );

  const openLightbox = useCallback((post) => {
    setLightboxPost(post);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('post', post.id);
      if (activeCategory !== 'all') next.set('cat', activeCategory);
      return next;
    }, { replace: true });
  }, [activeCategory, setSearchParams]);

  const closeLightbox = useCallback(() => {
    setLightboxPost(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('post');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setCategory = (cat) => {
    setActiveCategory(cat);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (cat === 'winter-snow') next.delete('cat');
      else next.set('cat', cat);
      next.delete('post');
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (VALID_CATS.has(catParam)) {
      setActiveCategory(catParam);
    }
  }, [catParam]);

  useEffect(() => {
    if (!postParam) {
      setLightboxPost(null);
      return;
    }
    const post = INSTAGRAM_POSTS.find((p) => p.id === postParam);
    if (post) {
      setLightboxPost(post);
      if (catParam === 'all' || !VALID_CATS.has(catParam)) {
        setActiveCategory(post.category);
      }
    }
  }, [postParam, catParam]);

  const lightboxPool = useMemo(() => {
    if (!lightboxPost) return filteredPosts;
    if (filteredPosts.some((p) => p.id === lightboxPost.id)) return filteredPosts;
    return INSTAGRAM_POSTS.filter((p) => p.category === lightboxPost.category);
  }, [lightboxPost, filteredPosts]);

  const lightboxIndex = lightboxPost
    ? lightboxPool.findIndex((p) => p.id === lightboxPost.id)
    : -1;

  const goLightbox = (dir) => {
    if (lightboxIndex < 0) return;
    const next = (lightboxIndex + dir + lightboxPool.length) % lightboxPool.length;
    openLightbox(lightboxPool[next]);
  };

  const winterCategory = INSTAGRAM_CATEGORIES.find((c) => c.id === 'winter-snow');

  return (
    <div className="gallery-page">
      <SeoHead
        title="Photo & Reel Gallery | Chhaon Stays Shoja"
        description="Browse winter snow moments, mountain adventures, and life at Chhaon Stays — curated from @chhaonstays Instagram, sorted by reach."
        path="/gallery"
        image={WINTER_FEATURED[0]?.thumbnail ?? '/images/chhaon/Hero.jpg'}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ImageGallery',
          name: 'Chhaon Stays Instagram Gallery',
          description: 'Moments from Chhaon Stays in Shoja, Himachal Pradesh',
          url: `${SITE.url}/gallery`,
          author: { '@type': 'Organization', name: SITE.name },
        }}
      />

      <header className="gallery-page-header">
        <div className="gallery-page-header-inner">
          <Link to="/" className="gallery-page-back">
            <ArrowLeft size={18} aria-hidden="true" />
            Chhaon Stays
          </Link>
          <nav className="gallery-page-nav">
            <Link to="/guides">Guides</Link>
            <Link to="/book" className="gallery-page-book">Book stay</Link>
          </nav>
        </div>
      </header>

      <main className="ig-gallery-section ig-gallery-full">
        <SnowParticles />

        <div className="ig-gallery-header">
          <span className="section-label">@chhaonstays</span>
          <h1 className="section-title">The full gallery.</h1>
          <p className="ig-gallery-desc">
            Every reel and photo from our feed — organised by season and story, ranked by what resonated most with travellers.
          </p>
          <div className="ig-gallery-stats">
            <span>{INSTAGRAM_PROFILE.postCount} posts</span>
            <span aria-hidden="true">·</span>
            <span>{formatEngagement(INSTAGRAM_PROFILE.totalLikes)}+ likes</span>
            <span aria-hidden="true">·</span>
            <span>{INSTAGRAM_CATEGORIES.length} collections</span>
          </div>
        </div>

        <div className="ig-winter-spotlight">
          <div className="ig-winter-spotlight-header">
            <div className="ig-winter-badge">
              <Snowflake size={18} aria-hidden="true" />
              <span>Winter at Chhaon</span>
            </div>
            <h2 className="ig-winter-title">When the valley turns white.</h2>
            <p className="ig-winter-subtitle">
              {winterCategory?.description} Our highest-reaching snow season posts, from the first flakes in January to spring surprises in March.
            </p>
          </div>

          <div className="ig-winter-hero-grid">
            {WINTER_FEATURED[0] && (
              <GalleryCard post={WINTER_FEATURED[0]} size="large" onOpen={openLightbox} />
            )}
            <div className="ig-winter-hero-side">
              {WINTER_FEATURED.slice(1, 3).map((post) => (
                <GalleryCard key={post.id} post={post} onOpen={openLightbox} />
              ))}
            </div>
          </div>

          <div className="ig-winter-strip">
            {WINTER_FEATURED.slice(3).map((post) => (
              <GalleryCard key={post.id} post={post} size="wide" onOpen={openLightbox} />
            ))}
          </div>
        </div>

        <div className="ig-filters-wrap">
          <div className="ig-filters" role="tablist" aria-label="Gallery categories">
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'all'}
              className={`ig-filter-pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setCategory('all')}
            >
              All posts
            </button>
            {INSTAGRAM_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.id}
                className={`ig-filter-pill ${activeCategory === cat.id ? 'active' : ''} ${cat.featured ? 'ig-filter-pill--winter' : ''}`}
                onClick={() => setCategory(cat.id)}
              >
                <span aria-hidden="true">{cat.emoji}</span>
                {cat.label}
                <span className="ig-filter-count">{cat.posts.length}</span>
              </button>
            ))}
          </div>
          {activeCategory !== 'all' && (
            <p className="ig-filter-desc">
              {INSTAGRAM_CATEGORIES.find((c) => c.id === activeCategory)?.description}
            </p>
          )}
        </div>

        <div className="ig-masonry">
          {filteredPosts.map((post, i) => (
            <GalleryCard
              key={post.id}
              post={post}
              size={i === 0 && activeCategory !== 'all' ? 'large' : 'normal'}
              onOpen={openLightbox}
            />
          ))}
        </div>

        <div className="ig-gallery-footer">
          <a href={INSTAGRAM_PROFILE.url} target="_blank" rel="noreferrer" className="ig-follow-btn">
            <InstagramIcon size={20} />
            Follow {INSTAGRAM_PROFILE.handle}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
          <p className="ig-gallery-note">
            {INSTAGRAM_PROFILE.postCount} posts · {formatEngagement(INSTAGRAM_PROFILE.totalLikes)}+ likes across the feed
          </p>
        </div>

        {lightboxPost && (
          <Lightbox
            post={lightboxPost}
            onClose={closeLightbox}
            onPrev={() => goLightbox(-1)}
            onNext={() => goLightbox(1)}
            hasPrev={lightboxPool.length > 1}
            hasNext={lightboxPool.length > 1}
          />
        )}
      </main>

      <footer className="gallery-page-footer">
        <p>
          Base yourself at <Link to="/">Chhaon Stays &amp; Cafe</Link> in Shoja — {SITE.distanceFromJibhi} from Jibhi.
        </p>
      </footer>
    </div>
  );
}
