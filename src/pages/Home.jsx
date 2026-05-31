import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  ArrowRight,
  Wifi,
  Flame,
  Car,
  Compass,
  Trees,
  Star,
  Phone,
  MessageSquare,
  Menu,
  X,
  Sparkles,
  Bath,
  ExternalLink,
  Info,
  CalendarCheck,
  CreditCard,
} from 'lucide-react';
import {
  SITE,
  IMAGES,
  STAY_OPTIONS,
  AMENITY_LABELS,
  MENU_ITEMS,
  EXPLORE_SPOTS,
  REVIEWS,
  ROUTES,
} from '../data/siteData';
import '../App.css';

const Instagram = ({ size = 24, className }) => (
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
    className={className}
    aria-hidden="true"
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const AMENITY_ICONS = {
  'Free Wi-Fi': Wifi,
  'Hot Showers': Bath,
  Heating: Flame,
  'Free Parking': Car,
  'Pet Friendly': Sparkles,
  'Coworking Space': Compass,
  Laundry: Sparkles,
  Garden: Trees,
};

const REVIEW_LOOP = [...REVIEWS, ...REVIEWS];

function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} aria-label="Main navigation">
        <div className="brand-container">
          <a href="#top" className="brand-logo" onClick={closeMenu}>
            Chhaon <span className="brand-subtitle">stays</span>
          </a>
        </div>

        <div className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
          <a href="#story" className="nav-link" onClick={closeMenu}>The Story</a>
          <a href="#stay" className="nav-link" onClick={closeMenu}>Stay</a>
          <a href="#cafe" className="nav-link" onClick={closeMenu}>Cafe</a>
          <a href="#explore" className="nav-link" onClick={closeMenu}>Explore</a>
          <Link to="/book" className="btn-primary nav-cta" onClick={closeMenu}>Book Your Stay</Link>
        </div>

        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Hero */}
      <header id="top" className="hero-section">
        <div className="hero-media">
          <img
            src={IMAGES.hero}
            alt="Guests sharing a book in a cozy wood-paneled dorm at Chhaon Stays, Shoja, with mountain views through the window"
            className="hero-img kenburns"
            fetchPriority="high"
          />
          <div className="hero-overlay-radial" />
          <div className="hero-overlay-gradient" />
          <div className="hero-particles" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className="particle" style={{ '--i': i }} />
            ))}
          </div>
        </div>

        <div className="hero-content animate-fade-in">
          <span className="hero-cursive">{SITE.hindiName}</span>
          <h1 className="hero-title">Chhaon</h1>
          <p className="hero-subtitle">{SITE.tagline}</p>
          <div className="hero-location">
            <MapPin size={18} aria-hidden="true" />
            <span>{SITE.location}</span>
          </div>
          <div className="hero-ctas">
            <Link to="/book" className="btn-primary">
              Book your stay <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href="#story" className="btn-secondary">
              Wander through
            </a>
          </div>
        </div>

        <div className="scroll-indicator animate-float" aria-hidden="true">
          <span className="scroll-text">scroll</span>
          <div className="scroll-line" />
        </div>
      </header>

      {/* Story */}
      <section id="story" className="section story-section paper-grain">
        <div className="story-content text-left">
          <span className="section-label">a quiet beginning</span>
          <h2 className="section-title">
            Where the mountains <em>hold</em> you.
          </h2>
          <div className="story-text">
            <p>
              Chhaon was born from a simple belief — that the best travel experiences are not about the places you see, but about the moments you pause.
            </p>
            <p>
              Nestled in the quiet village of Shoja in Himachal Pradesh&apos;s Tirthan Valley, Chhaon is a mountain hostel and cafe with {SITE.accommodation.privateRooms} private rooms and {SITE.accommodation.dorms} dorms — just {SITE.distanceFromJibhi} from Jibhi. A place where time slows down, strangers become friends over hot chocolate, and the only agenda is to breathe.
            </p>
            <p className="story-quote">
              &ldquo;Chhaon&rdquo; means shade in Hindi. That is all this place promises to be — a sheltering pause in your journey.
            </p>
            <p>
              Founded by {SITE.host.name} — a mountain lover who left the city to build something real — Chhaon is not a business. It is a lived philosophy: that hospitality is personal, food should be honest, and mountains are not a backdrop but an active part of the experience.
            </p>
          </div>
        </div>

        <div className="story-images">
          <div className="story-img-card main">
            <img src={IMAGES.story[0]} alt="Cozy interior of Chhaon Stays mountain hostel" loading="lazy" />
            <div className="story-img-label">
              <span className="story-img-label-title">made slowly, in the mountains.</span>
            </div>
          </div>
          <div className="story-img-card secondary">
            <img src={IMAGES.story[1]} alt="Host Amrit and guests at Chhaon Stays" loading="lazy" />
            <div className="story-img-label">
              <span className="story-img-label-title">{SITE.host.name}</span>
              <span className="story-img-label-subtitle">Host · {SITE.host.handle}</span>
            </div>
          </div>
          <div className="story-img-card tertiary">
            <img src={IMAGES.story[2]} alt="Attic space and balcony views at Chhaon" loading="lazy" />
          </div>
        </div>
      </section>

      {/* Stay */}
      <section id="stay" className="section stay-section">
        <div className="stay-intro">
          <span className="section-label">stay</span>
          <h2 className="section-title">Your room with a view.</h2>
          <p className="stay-intro-desc">Private rooms and dorms — each with the mountains at your window.</p>
        </div>

        <div className="stay-cards-row">
          {STAY_OPTIONS.map((option) => (
            <article key={option.key} className="stay-card">
              <div className="stay-card-image-wrapper">
                <img src={option.image} alt={`${option.title} at Chhaon Stays Shoja`} className="stay-card-image" loading="lazy" />
                <div className="stay-card-image-gradient" />
              </div>
              <div className="stay-card-content">
                <h3 className="stay-card-title">{option.title}</h3>
                <ul className="stay-card-features">
                  {option.notes.map((note) => (
                    <li key={note} className="stay-card-feature-item">
                      <span className="feature-dash" aria-hidden="true" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="comforts-sub-section">
          <h3 className="comforts-heading">Quiet comforts</h3>
          <div className="comforts-icon-row">
            {AMENITY_LABELS.map((label) => {
              const Icon = AMENITY_ICONS[label] || Sparkles;
              return (
                <div key={label} className="comfort-icon-item">
                  <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
          <div className="comforts-cta-container">
            <Link to="/book" className="btn-primary">
              Check Availability <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Cafe */}
      <section id="cafe" className="section cafe-section">
        <div className="cafe-bg" aria-hidden="true">
          <img src={IMAGES.cafe} alt="" loading="lazy" />
          <div className="cafe-bg-gradient" />
        </div>
        <div className="cafe-inner">
          <div className="cafe-content">
            <span className="section-label cafe-label">the cafe</span>
            <h2 className="section-title cafe-title">Good food, better conversations.</h2>
            <p className="cafe-highlight">
              The best food in Shoja.<br />Ask anyone.
            </p>
            <div className="cafe-text">
              <p>
                Our cafe is not an afterthought. It is the heart of Chhaon. Every meal is made with care, not just ingredients — from steaming egg parathas at breakfast to our legendary spring rolls and caramelised onion egg sandwiches.
              </p>
              <p>
                Sit indoors with a book and a cup of chai. Or take your coffee to the outdoor deck and let the valley keep you company. You do not need to be a guest to eat here.
              </p>
            </div>
            <div className="cafe-badges">
              <div className="cafe-badge"><div className="cafe-badge-dot" />Indian &amp; continental menu</div>
              <div className="cafe-badge"><div className="cafe-badge-dot" />Outdoor dining</div>
            </div>
          </div>

          <div className="cafe-menu-card">
            <h3 className="menu-card-title">Signature plates</h3>
            <p className="menu-card-sub">things people remember</p>
            <div className="menu-items-list">
              {MENU_ITEMS.map((item) => (
                <div key={item.name} className="menu-item">
                  <div className="menu-item-header">
                    <span className="menu-item-name">{item.name}</span>
                    <div className="menu-item-spacer" />
                    <span className="menu-item-label">{item.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Explore */}
      <section id="explore" className="section explore-section paper-grain">
        <div className="explore-header">
          <span className="section-label">explore</span>
          <h2 className="section-title">The mountains have plans for you.</h2>
          <p className="explore-desc">
            Shoja is not a tourist town. It is a secret the valley has been keeping.
          </p>
        </div>

        <div className="explore-bento">
          {EXPLORE_SPOTS.map((spot) => (
            <Link key={spot.title} to={`/guides/${spot.slug}`} className={`explore-card explore-span-${spot.span} explore-card-link`}>
              <img src={spot.image} alt={`${spot.title} near Chhaon Stays, Shoja`} className="explore-card-img" loading="lazy" />
              <div className="explore-card-gradient" />
              <div className="explore-card-content">
                <div className="explore-card-badge">
                  <MapPin size={12} aria-hidden="true" />
                  <span>{spot.distance}</span>
                </div>
                <h3 className="explore-card-title">{spot.title}</h3>
                <p className="explore-card-desc">{spot.note}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="explore-guides-cta">
          <Link to="/guides">
            Read all travel guides <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="section reviews-section">
        <div className="reviews-header">
          <span className="section-label">guests</span>
          <h2 className="section-title">They came as guests. They left as family.</h2>
          <p className="reviews-badge-line">
            {SITE.ratings.google.score} on Google Maps. {SITE.ratings.google.count} reviews. Every single one, five stars.
          </p>
        </div>

        <div className="reviews-marquee-wrap">
          <div className="reviews-fade reviews-fade-left" aria-hidden="true" />
          <div className="reviews-fade reviews-fade-right" aria-hidden="true" />
          <div className="marquee-track" aria-label="Guest reviews">
            {REVIEW_LOOP.map((review, i) => (
              <figure key={`${review.name}-${i}`} className="review-card">
                <div className="review-stars" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="review-text">{review.text}</blockquote>
                <figcaption className="review-author">
                  <span className="review-author-name">{review.name}</span>
                  <span className="review-platform">{review.source}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="ratings-badges-row">
          <div className="rating-badge">
            <span className="rating-badge-value">{SITE.ratings.google.score}</span>
            <div className="rating-badge-label">
              <span className="rating-badge-platform">Google Maps</span>
              <span className="rating-badge-count">{SITE.ratings.google.count} reviews</span>
            </div>
          </div>
          <div className="rating-badge">
            <span className="rating-badge-value">{SITE.ratings.booking.score}</span>
            <div className="rating-badge-label">
              <span className="rating-badge-platform">Booking.com</span>
              <span className="rating-badge-count">{SITE.ratings.booking.count} reviews</span>
            </div>
          </div>
          <span className="rating-and-counting">and counting…</span>
        </div>
      </section>

      {/* How to Reach */}
      <section id="reach" className="section location-section">
        <div className="location-content">
          <span className="section-label">how to reach</span>
          <h2 className="section-title">Finding your way to Chhaon.</h2>

          <div className="location-address-card">
            <div className="location-address-icon-box">
              <MapPin size={24} aria-hidden="true" />
            </div>
            <address className="location-address-text">
              NH-305, near Achru, Shoja · HP {SITE.address.postalCode}
            </address>
          </div>

          <table className="distances-table">
            <caption className="sr-only">Travel distances to Chhaon Stays from major cities</caption>
            <tbody>
              {ROUTES.map((route) => (
                <tr key={route.from} className="distances-row">
                  <td className="distances-cell location-name">{route.from}</td>
                  <td className="distances-cell distance">{route.distance}</td>
                  <td className="distances-cell duration">{route.time}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="location-tip">
            <Info size={18} aria-hidden="true" />
            <span>
              <strong>tip:</strong> Take the bus to Aut or Banjar. From there, a local bus or taxi brings you to Shoja. Or ride your bike — half our guests do. Need help? Call {SITE.phoneAltDisplay}.
            </span>
          </div>
        </div>

        <div className="map-wrapper">
          <iframe
            src="https://www.google.com/maps?q=Chhaon+Stays+%26+Cafe,+Shoja,+Himachal+Pradesh&output=embed"
            className="map-iframe"
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Chhaon Stays Map — Shoja, Himachal Pradesh"
          />
        </div>
      </section>

      {/* Book */}
      <section id="book" className="section book-section">
        <div className="book-bg" aria-hidden="true">
          <img src={IMAGES.story[0]} alt="" />
        </div>
        <div className="book-header">
          <span className="section-label">come stay</span>
          <h2 className="section-title">Come. The mountains are waiting.</h2>
          <p className="book-subtitle">
            Book directly — real-time availability and secure payment.
          </p>
        </div>

        <div className="book-container">
          <div className="booking-form-card book-cta-card">
            <h3 className="booking-form-title">Book your stay</h3>
            <p className="booking-form-subtitle">
              Choose your dates, pick a room, and confirm instantly. {SITE.accommodation.privateRooms} private rooms and {SITE.accommodation.dorms} dorms available.
            </p>

            <ul className="book-cta-features">
              <li>
                <CalendarCheck size={20} aria-hidden="true" />
                <span>Live availability calendar</span>
              </li>
              <li>
                <CreditCard size={20} aria-hidden="true" />
                <span>Secure payment via Razorpay — UPI, cards &amp; wallets</span>
              </li>
            </ul>

            <Link to="/book" className="form-submit-btn">
              Book now <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <p className="form-footer-note">Instant confirmation · Best direct rate</p>
          </div>

          <div className="direct-contact-column">
            <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="contact-card highlighted">
              <div className="contact-icon-box"><MessageSquare size={24} aria-hidden="true" /></div>
              <div className="contact-card-info">
                <span className="contact-card-label">questions?</span>
                <h4 className="contact-card-title">Message on WhatsApp</h4>
                <span className="contact-card-value">{SITE.phoneDisplay}</span>
              </div>
            </a>

            <a href={`tel:${SITE.phone}`} className="contact-card">
              <div className="contact-icon-box"><Phone size={24} aria-hidden="true" /></div>
              <div className="contact-card-info">
                <span className="contact-card-label muted">call us</span>
                <h4 className="contact-card-title">Direct Mobile Call</h4>
                <span className="contact-card-value">{SITE.phoneDisplay}</span>
              </div>
            </a>

            <a href={SITE.instagram} target="_blank" rel="noreferrer" className="contact-card">
              <div className="contact-icon-box"><Instagram size={24} /></div>
              <div className="contact-card-info">
                <span className="contact-card-label muted">socials</span>
                <h4 className="contact-card-title">Or find us on Instagram</h4>
                <span className="contact-card-value">{SITE.instagramHandle}</span>
              </div>
            </a>

            <div className="booking-platforms">
              <p className="booking-platforms-label">Also listed on</p>
              <div className="booking-platforms-links">
                {SITE.bookingLinks.map((link) => (
                  <a key={link.name} href={link.url} target="_blank" rel="noreferrer" className="platform-link">
                    {link.name} <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <h2 className="footer-logo">Chhaon <span>stays</span></h2>
            <p className="footer-tagline">{SITE.tagline}</p>
          </div>
          <div className="footer-column">
            <h3 className="footer-heading">Find us</h3>
            <ul className="footer-info-list">
              <li className="footer-info-item">
                <MapPin size={18} aria-hidden="true" />
                <span>{SITE.address.full}</span>
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <h3 className="footer-heading">Say hello</h3>
            <ul className="footer-info-list">
              <li className="footer-info-item">
                <Phone size={18} aria-hidden="true" />
                <a href={`tel:${SITE.phone}`}>{SITE.phoneDisplay}</a>
              </li>
              <li className="footer-info-item">
                <Instagram size={18} />
                <a href={SITE.instagram} target="_blank" rel="noreferrer">{SITE.instagramHandle}</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Chhaon Stays &amp; Cafe. All rights reserved.</span>
          <nav className="footer-nav" aria-label="Footer">
            <a href="#story">Story</a>
            <a href="#stay">Stay</a>
            <a href="#cafe">Cafe</a>
            <a href="#explore">Explore</a>
            <Link to="/guides">Guides</Link>
            <Link to="/book">Book</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

export default Home;
