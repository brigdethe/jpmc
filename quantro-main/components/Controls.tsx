import React from 'react';

const NavIconWrapper: React.FC<{
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ children, active, onClick, disabled = false, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 shrink-0 ${
      disabled
        ? 'opacity-40 cursor-not-allowed bg-white text-gray-400 border border-transparent'
        : active
          ? 'bg-black text-white'
          : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent hover:border-gray-200'
    } ${className}`}
  >
    {children}
  </button>
);

const IconMapPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconPie = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>;
const IconFolder = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>;
const IconFile = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const IconUser = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const IconColumns = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path></svg>;

interface ControlsProps {
  heading: string;
  showIconToolbar: boolean;
  chartsOpen?: boolean;
  onChartsOpenChange?: (open: boolean) => void;
  amenityMapOpen?: boolean;
  amenityMapEnabled?: boolean;
  onToggleAmenityMap?: () => void;
  compareOpen?: boolean;
  compareEnabled?: boolean;
  onToggleCompare?: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  heading,
  showIconToolbar,
  chartsOpen = false,
  onChartsOpenChange = (_o: boolean) => {},
  amenityMapOpen = false,
  amenityMapEnabled = false,
  onToggleAmenityMap = () => {},
  compareOpen = false,
  compareEnabled = false,
  onToggleCompare = () => {},
}) => {
  return (
    <div className="flex flex-col gap-6 mb-8">
      <div
        className={`flex flex-col gap-4 items-start ${
          showIconToolbar ? 'md:flex-row md:justify-between md:items-center' : ''
        }`}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-medium text-textPrimary">{heading}</h1>
          <div className="flex items-center gap-2 text-xs text-textTertiary">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span>FWCLT</span>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-500">Fort Worth, TX</span>
          </div>
        </div>

        {showIconToolbar && (
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-sm">
            <NavIconWrapper
              active={!chartsOpen && !amenityMapOpen}
              onClick={() => onChartsOpenChange(false)}
            >
              <IconFolder />
            </NavIconWrapper>
            <NavIconWrapper
              active={amenityMapOpen}
              disabled={!amenityMapEnabled}
              onClick={() => {
                if (!amenityMapEnabled) return;
                onChartsOpenChange(false);
                onToggleAmenityMap();
              }}
            >
              <IconMapPin />
            </NavIconWrapper>
            <NavIconWrapper
              active={chartsOpen}
              onClick={() => {
                onChartsOpenChange(true);
              }}
              aria-current={chartsOpen ? 'page' : undefined}
            >
              <IconPie />
            </NavIconWrapper>
            <NavIconWrapper
              active={compareOpen}
              disabled={!compareEnabled}
              onClick={onToggleCompare}
              title="Compare properties"
            >
              <IconFile />
            </NavIconWrapper>
            <NavIconWrapper>
              <IconUser />
            </NavIconWrapper>
            <NavIconWrapper>
              <IconColumns />
            </NavIconWrapper>
          </div>
        )}
      </div>
    </div>
  );
};
