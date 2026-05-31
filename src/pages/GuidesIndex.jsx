import { Link } from 'react-router-dom';
import GuideLayout from '../components/GuideLayout';
import SeoHead from '../components/SeoHead';
import { GUIDES } from '../data/guides';
import { SITE } from '../data/siteData';

export default function GuidesIndex() {
  return (
    <GuideLayout>
      <SeoHead
        title="Shoja & Tirthan Valley Travel Guides | Chhaon Stays"
        description="Free travel guides for Shoja, Jalori Pass, Serolsar Lake, Jibhi, and Tirthan Valley — written by the team at Chhaon Stays mountain hostel."
        path="/guides"
        image="/images/chhaon/p3.jpg"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Shoja Travel Guides',
          description: 'Travel guides for Shoja and Tirthan Valley',
          url: `${SITE.url}/guides`,
          publisher: { '@type': 'Organization', name: SITE.name },
        }}
      />
      <div className="guides-index">
        <header className="guides-index-header">
          <span className="section-label">travel guides</span>
          <h1>Explore Shoja &amp; Tirthan Valley</h1>
          <p>
            Practical guides for treks, drives, and slow days around Chhaon Stays — written from the village, for travellers who want more than a Google pin.
          </p>
        </header>
        <div className="guides-grid">
          {GUIDES.map((guide) => (
            <Link key={guide.slug} to={`/guides/${guide.slug}`} className="guide-card-link">
              <img src={guide.heroImage} alt={guide.title} className="guide-card-img" loading="lazy" />
              <div className="guide-card-body">
                <h2>{guide.title}</h2>
                <p>{guide.excerpt}</p>
                <span className="guide-card-meta">{guide.readTime} · {guide.distance}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </GuideLayout>
  );
}
