import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SITE } from '../data/siteData';
import '../guides.css';

export default function GuideLayout({ children }) {
  return (
    <div className="guide-layout">
      <header className="guide-header">
        <div className="guide-header-inner">
          <Link to="/" className="guide-back">
            <ArrowLeft size={18} aria-hidden="true" />
            Chhaon Stays
          </Link>
          <nav className="guide-header-nav">
            <Link to="/guides">All guides</Link>
            <Link to="/book" className="guide-header-cta">
              Book stay <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="guide-footer">
        <p>
          Base yourself at{' '}
          <Link to="/">Chhaon Stays &amp; Cafe</Link> in Shoja — {SITE.distanceFromJibhi} from Jibhi.
        </p>
        <p>
          Questions? WhatsApp{' '}
          <a href={SITE.whatsapp}>{SITE.phoneDisplay}</a>
        </p>
      </footer>
    </div>
  );
}
