import React from "react";
import Link from "next/link";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function BricDocIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background soft geometric shape */}
      <rect x="4" y="4" width="28" height="28" rx="8" className="fill-brand-600" />
      {/* Primary document outline motif */}
      <path
        d="M10 9C10 7.89543 10.8954 7 12 7H20L26 13V27C26 28.1046 25.1046 29 24 29H12C10.8954 29 10 28.1046 10 27V9Z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Fold corner */}
      <path
        d="M20 7V12C20 12.5523 20.4477 13 21 13H26"
        fill="#c7d2fe"
      />
      {/* Intelligent connected page / node motif */}
      <circle cx="16" cy="18" r="1.75" className="fill-brand-700" />
      <circle cx="20.5" cy="18" r="1.75" className="fill-brand-600" />
      <circle cx="16" cy="23" r="1.75" className="fill-brand-500" />
      <path
        d="M16 18H20.5M16 18V23"
        stroke="#4f46e5"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className = "", iconOnly = false, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl font-bold",
  };

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-7 h-7",
    lg: "w-9 h-9",
  };

  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      <div className="transition-transform duration-200 group-hover:scale-105">
        <BricDocIcon className={iconSizes[size]} />
      </div>
      {!iconOnly && (
        <span className={`font-semibold tracking-tight text-slate-900 dark:text-white ${sizeClasses[size]}`}>
          Bric<span className="text-brand-600 dark:text-brand-400">Doc</span>
        </span>
      )}
    </Link>
  );
}
