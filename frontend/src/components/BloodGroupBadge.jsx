import React from 'react';

const BloodGroupBadge = ({ group, size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'text-xs px-2 py-0.5 min-w-[2.2rem]',
    md: 'text-sm px-2.5 py-1 min-w-[2.8rem]',
    lg: 'text-base px-3 py-1.5 min-w-[3.5rem]',
    xl: 'text-xl px-4 py-2 font-black min-w-[4.2rem]',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-extrabold rounded-lg bg-red-100 text-red-700 border border-red-300 shadow-2xs tracking-tight ${sizeMap[size]} ${className}`}
    >
      {group}
    </span>
  );
};

export default BloodGroupBadge;
