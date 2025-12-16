import React from "react";

export default function LoadingSpinner({ size = 64, text = "Loading..." }: { size?: number; text?: string }) {
  const stroke = Math.max(3, Math.floor(size / 18));
  const r = (size / 2) - stroke;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="flex flex-col items-center gap-3">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="animate-spin"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            className="opacity-20 stroke-current text-gray-300 dark:text-gray-700 fill-none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ * 0.75} ${circ}`}
            strokeDashoffset="0"
            className="stroke-current text-blue-500 dark:text-blue-300 fill-none"
            style={{ transformOrigin: "50% 50%" }}
          />
        </svg>

        <div className="text-sm text-gray-600 dark:text-gray-300">{text}</div>
      </div>
    </div>
  );
}