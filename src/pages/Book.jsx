import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import StayFlexiEmbed from '../components/StayFlexiEmbed';
import { SITE } from '../data/siteData';
import '../App.css';

const bookJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `Book a stay at ${SITE.name}`,
  description: `Book private rooms and dorms at ${SITE.name} in Shoja, Himachal Pradesh. Real-time availability and secure online payment.`,
  url: `${SITE.url}/book`,
  potentialAction: {
    '@type': 'ReserveAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE.url}/book`,
      actionPlatform: [
        'http://schema.org/DesktopWebPlatform',
        'http://schema.org/MobileWebPlatform',
      ],
    },
    result: {
      '@type': 'LodgingReservation',
      name: `Reservation at ${SITE.name}`,
    },
  },
};

export default function Book() {
  return (
    <>
      <SeoHead
        title={`Book a Stay | ${SITE.name}`}
        description={`Book private rooms and dorms at ${SITE.name} in Shoja, Himachal Pradesh. Check real-time availability and pay securely online.`}
        path="/book"
        jsonLd={bookJsonLd}
      />

      <div className="book-page">
        <header className="book-page-header">
          <Link to="/" className="book-page-back">
            <ArrowLeft size={18} aria-hidden="true" />
            Chhaon Stays
          </Link>
          <h1 className="book-page-title">Book your stay</h1>
          <p className="book-page-subtitle">
            Real-time availability · Secure payment via Razorpay
          </p>
        </header>

        <StayFlexiEmbed fullHeight />
      </div>
    </>
  );
}
