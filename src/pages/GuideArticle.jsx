import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import GuideLayout from '../components/GuideLayout';
import SeoHead from '../components/SeoHead';
import { getGuideBySlug, getRelatedGuides } from '../data/guides';
import { SITE } from '../data/siteData';

export default function GuideArticle() {
  const { slug } = useParams();
  const guide = getGuideBySlug(slug);

  if (!guide) return <Navigate to="/guides" replace />;

  const related = getRelatedGuides(guide.relatedSlugs || []);
  const path = `/guides/${guide.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.metaTitle,
    description: guide.metaDescription,
    image: guide.heroImage.startsWith('http') ? guide.heroImage : `${SITE.url}${guide.heroImage}`,
    datePublished: guide.published,
    dateModified: guide.published,
    author: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
    },
    mainEntityOfPage: `${SITE.url}${path}`,
  };

  return (
    <GuideLayout>
      <SeoHead
        title={guide.metaTitle}
        description={guide.metaDescription}
        path={path}
        image={guide.heroImage}
        type="article"
        jsonLd={jsonLd}
      />
      <article className="guide-article">
        <img src={guide.heroImage} alt={guide.title} className="guide-hero-img" />
        <div className="guide-meta">
          <span>{guide.readTime}</span>
          <span>{guide.distance}</span>
          <span>Updated {guide.published}</span>
        </div>
        <h1>{guide.title}</h1>
        <p className="guide-excerpt">{guide.excerpt}</p>

        {guide.sections.map((section) => (
          <section key={section.heading} className="guide-section">
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
            {section.list && (
              <ul>
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <div className="guide-cta-box">
          <h3>Stay at Chhaon while you explore</h3>
          <p>
            3 private rooms, 2 dorms, and the best food in Shoja — {SITE.distanceFromJibhi} from Jibhi, at the heart of Tirthan Valley.
          </p>
          <div className="guide-cta-buttons">
            <Link to="/book" className="btn-primary">
              Book your stay <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/#stay" className="btn-secondary guide-home-cta">
              View rooms <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {related.length > 0 && (
          <div className="guide-related">
            <h2>More guides</h2>
            <div className="guide-related-list">
              {related.map((r) => (
                <Link key={r.slug} to={`/guides/${r.slug}`}>
                  {r.title}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </GuideLayout>
  );
}
