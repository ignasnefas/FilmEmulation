import { useState } from 'react';

export const DesktopDownloadBanner = () => {
  const [isOpen, setIsOpen] = useState(true);

  // Don't show in Electron app
  if (typeof window !== 'undefined' && (window as any).electron?.isElectron) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1.22l3.97 1.987a2 2 0 01.9 2.605L13.72 9.9a2.009 2.009 0 01.428.678h3.341a2 2 0 110 4h-.464a2 2 0 01-.268 3.519l1.43 4.605a2 2 0 01-1.903 2.668H5.75a2 2 0 01-1.903-2.668l1.43-4.605A2 2 0 013.544 14H3a2 2 0 110-4h3.341a2.009 2.009 0 01.428-.678l-1.147-1.481a2 2 0 01.9-2.605L9 4.22V3a1 1 0 011-1h0z" />
          </svg>
          <span className="font-medium">TheFilmLab Desktop App</span>
        </div>
        <p className="text-blue-100 text-sm flex-1">Faster performance and offline support with our native desktop application</p>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/neetfrog/TheFilmLab/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold whitespace-nowrap hover:bg-blue-50 transition-colors text-sm"
          >
            Download for Windows
          </a>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close desktop download banner"
            className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesktopDownloadBanner;
