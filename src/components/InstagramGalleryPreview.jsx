import { Link } from 'react-router-dom';
import { ArrowRight, Snowflake } from 'lucide-react';
import {
  INSTAGRAM_CATEGORIES,
  WINTER_FEATURED,
  TOP_POSTS,
  INSTAGRAM_PROFILE,
  formatEngagement,
} from '../data/instagramGallery';
import { SnowParticles, GalleryCard, InstagramIcon } from './instagram/GalleryShared';

const PREVIEW_SCROLL = TOP_POSTS.filter(
  (p) => !WINTER_FEATURED.slice(0, 3).some((w) => w.id === p.id),
).slice(0, 5);

export default function InstagramGalleryPreview() {
  const winterCategory = INSTAGRAM_CATEGORIES.find((c) => c.id === 'winter-snow');

  return (
    <section id="moments" className="section ig-gallery-section ig-gallery-preview">
      <SnowParticles count={12} />

      <div className="ig-gallery-header">
        <span className="section-label">@chhaonstays</span>
        <h2 className="section-title">Moments from the mountains.</h2>
        <p className="ig-gallery-desc">
          Snow days, bonfire nights, and the posts that travelled furthest — a glimpse from our Instagram.
        </p>
      </div>

      <div className="ig-preview-spotlight">
        <div className="ig-winter-spotlight-header">
          <div className="ig-winter-badge">
            <Snowflake size={18} aria-hidden="true" />
            <span>Winter at Chhaon</span>
          </div>
          <p className="ig-winter-subtitle">
            {winterCategory?.description}
          </p>
        </div>

        <div className="ig-preview-hero-grid">
          {WINTER_FEATURED[0] && (
            <GalleryCard
              post={WINTER_FEATURED[0]}
              size="large"
              asLink={`/gallery?post=${WINTER_FEATURED[0].id}`}
            />
          )}
          <div className="ig-winter-hero-side">
            {WINTER_FEATURED.slice(1, 3).map((post) => (
              <GalleryCard
                key={post.id}
                post={post}
                asLink={`/gallery?post=${post.id}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="ig-preview-scroll-wrap">
        <p className="ig-preview-scroll-label">Most loved across the feed</p>
        <div className="ig-preview-scroll">
          {PREVIEW_SCROLL.map((post) => (
            <GalleryCard
              key={post.id}
              post={post}
              asLink={`/gallery?post=${post.id}`}
            />
          ))}
        </div>
      </div>

      <div className="ig-preview-categories">
        {INSTAGRAM_CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            to={`/gallery?cat=${cat.id}`}
            className={`ig-preview-cat-chip ${cat.featured ? 'ig-preview-cat-chip--winter' : ''}`}
          >
            <span aria-hidden="true">{cat.emoji}</span>
            {cat.label}
            <span className="ig-filter-count">{cat.posts.length}</span>
          </Link>
        ))}
      </div>

      <div className="ig-preview-cta">
        <a href={INSTAGRAM_PROFILE.url} target="_blank" rel="noreferrer" className="ig-preview-follow">
          <InstagramIcon size={18} />
          {INSTAGRAM_PROFILE.handle}
        </a>
        <Link to="/gallery" className="ig-gallery-explore-btn">
          Explore full gallery
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <p className="ig-gallery-note">
          {INSTAGRAM_PROFILE.postCount} posts · {formatEngagement(INSTAGRAM_PROFILE.totalLikes)}+ likes
        </p>
      </div>
    </section>
  );
}
