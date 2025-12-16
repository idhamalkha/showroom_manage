import './LoadingOverlay.css';

export default function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="mm-loading-overlay" role="status" aria-live="polite">
      <div className="mm-loading-panel">
        <svg className="mm-spinner" viewBox="0 0 50 50" aria-hidden>
          <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
        </svg>
        <div className="mm-loading-text">{message ?? 'Menyimpan...'}</div>
      </div>
    </div>
  );
}
