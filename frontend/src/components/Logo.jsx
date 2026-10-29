import React from 'react';
import { Link } from 'react-router-dom';

const Logo = ({ className = '', size = 'md', to = '/' }) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const content = (
    <div className={`flex items-center gap-2.5 font-bold tracking-tight select-none ${className}`}>
      {/* Icon: Blood Drop intertwined with network link */}
      <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-md shadow-red-500/20 ${iconSizes[size]}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5/6 h-5/6">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" fillOpacity="0.85" />
          {/* Connection node icon */}
          <circle cx="12" cy="14" r="2.5" fill="#ffffff" stroke="none" />
          <path d="M12 11.5v-2" stroke="#ffffff" strokeWidth="2" />
        </svg>
      </div>

      <div className="flex flex-col leading-none">
        <span className={`${className.includes('text-white') ? 'text-white' : 'text-slate-900'} font-extrabold ${textSizes[size]}`}>
          Blood<span className="text-red-600">Connect</span>
        </span>
        {size !== 'sm' && (
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
            Emergency Donor Network
          </span>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-block transition-opacity hover:opacity-95">
        {content}
      </Link>
    );
  }

  return content;
};

export default Logo;
