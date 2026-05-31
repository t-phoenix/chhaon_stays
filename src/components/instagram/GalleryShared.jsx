import { useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Play,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Snowflake,
  Eye,
} from 'lucide-react';
import { INSTAGRAM_PROFILE, formatEngagement } from '../../data/instagramGallery';

export function InstagramIcon({ size = 20 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function SnowParticles({ count = 18 }) {
  return (
    <div className="ig-snow-field" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="ig-snowflake"
          style={{
            left: `${(i * 5.7 + 3) % 100}%`,
            animationDelay: `${(i * 0.45) % 5}s`,
            animationDuration: `${6 + (i % 4)}s`,
            fontSize: `${0.55 + (i % 3) * 0.25}rem`,
            opacity: 0.15 + (i % 5) * 0.08,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}

export function EngagementBadge({ post }) {
  return (
    <div className="ig-card-stats">
      {post.likes != null && (
        <span>
          <Heart size={13} aria-hidden="true" />
          {formatEngagement(post.likes)}
        </span>
      )}
      {post.views != null && (
        <span>
          <Eye size={13} aria-hidden="true" />
          {formatEngagement(post.views)}
        </span>
      )}
      {post.comments != null && post.comments > 0 && (
        <span>
          <MessageCircle size={13} aria-hidden="true" />
          {formatEngagement(post.comments)}
        </span>
      )}
    </div>
  );
}

export function GalleryCard({ post, size = 'normal', onOpen, asLink }) {
  const isLarge = size === 'large';
  const isWide = size === 'wide';

  const className = [
    'ig-card',
    isLarge && 'ig-card--large',
    isWide && 'ig-card--wide',
    post.category === 'winter-snow' && 'ig-card--winter',
    asLink && 'ig-card--link',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {post.thumbnail && (
        <img src={post.thumbnail} alt="" className="ig-card-img" loading="lazy" />
      )}
      <div className="ig-card-overlay" />
      {post.isReel && (
        <span className="ig-card-reel-badge">
          <Play size={14} fill="currentColor" aria-hidden="true" />
          Reel
        </span>
      )}
      {post.category === 'winter-snow' && (
        <span className="ig-card-snow-badge">
          <Snowflake size={12} aria-hidden="true" />
        </span>
      )}
      <div className="ig-card-caption">
        <p>{post.caption}</p>
        <EngagementBadge post={post} />
      </div>
    </>
  );

  if (asLink) {
    return (
      <a
        href={asLink}
        className={className}
        aria-label={`View ${post.isReel ? 'reel' : 'post'}: ${post.caption.slice(0, 60)}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpen?.(post)}
      aria-label={`Open ${post.isReel ? 'reel' : 'post'}: ${post.caption.slice(0, 60)}`}
    >
      {inner}
    </button>
  );
}

export function Lightbox({ post, onClose, onPrev, onNext, hasPrev, hasNext }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = post.hasVideo
    ? [
        { type: 'video', src: post.video, poster: post.thumbnail },
        ...post.images.map((src) => ({ type: 'image', src })),
      ]
    : post.images.map((src) => ({ type: 'image', src }));

  const current = slides[slideIndex] ?? slides[0];

  useEffect(() => {
    setSlideIndex(0);
  }, [post.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const goSlide = (dir) => {
    setSlideIndex((i) => {
      const next = i + dir;
      if (next < 0) return slides.length - 1;
      if (next >= slides.length) return 0;
      return next;
    });
  };

  return (
    <div className="ig-lightbox" role="dialog" aria-modal="true" aria-label="Instagram post viewer">
      <button type="button" className="ig-lightbox-close" onClick={onClose} aria-label="Close">
        <X size={24} />
      </button>

      {hasPrev && (
        <button type="button" className="ig-lightbox-nav ig-lightbox-nav--prev" onClick={onPrev} aria-label="Previous post">
          <ChevronLeft size={28} />
        </button>
      )}
      {hasNext && (
        <button type="button" className="ig-lightbox-nav ig-lightbox-nav--next" onClick={onNext} aria-label="Next post">
          <ChevronRight size={28} />
        </button>
      )}

      <div className="ig-lightbox-inner">
        <div className="ig-lightbox-media">
          {current?.type === 'video' ? (
            <video
              key={current.src}
              src={current.src}
              poster={current.poster}
              controls
              autoPlay
              playsInline
              className="ig-lightbox-video"
            />
          ) : (
            <img src={current?.src} alt="" className="ig-lightbox-img" />
          )}

          {slides.length > 1 && (
            <>
              <button type="button" className="ig-lightbox-slide ig-lightbox-slide--prev" onClick={() => goSlide(-1)} aria-label="Previous slide">
                <ChevronLeft size={20} />
              </button>
              <button type="button" className="ig-lightbox-slide ig-lightbox-slide--next" onClick={() => goSlide(1)} aria-label="Next slide">
                <ChevronRight size={20} />
              </button>
              <div className="ig-lightbox-dots">
                {slides.map((_, i) => (
                  <span key={i} className={i === slideIndex ? 'active' : ''} />
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="ig-lightbox-meta">
          <div className="ig-lightbox-meta-header">
            <InstagramIcon size={22} />
            <span>{INSTAGRAM_PROFILE.handle}</span>
          </div>
          <p className="ig-lightbox-caption">{post.caption}</p>
          <EngagementBadge post={post} />
          <time className="ig-lightbox-date" dateTime={post.date}>
            {new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
          <a
            href={post.instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="ig-lightbox-instagram-link"
          >
            View on Instagram <ExternalLink size={14} aria-hidden="true" />
          </a>
        </aside>
      </div>
    </div>
  );
}
