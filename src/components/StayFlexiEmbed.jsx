import { ExternalLink } from 'lucide-react';
import { SITE } from '../data/siteData';

export default function StayFlexiEmbed({ fullHeight = false }) {
  const url = SITE.stayflexi.bookingEngineUrl;

  return (
    <div className={`stayflexi-embed${fullHeight ? ' stayflexi-embed--full' : ''}`}>
      <iframe
        src={url}
        title="Book your stay at Chhaon Stays"
        className="stayflexi-iframe"
        loading={fullHeight ? 'eager' : 'lazy'}
        allow="payment"
      />
      <p className="stayflexi-fallback">
        Having trouble loading the booking form?{' '}
        <a href={url} target="_blank" rel="noreferrer">
          Open booking page <ExternalLink size={14} aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}
