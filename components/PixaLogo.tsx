import React from "react";

interface PixaLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  theme?: "light" | "dark";
}

export const PixaLogoIcon: React.FC<{ className?: string; size?: number; theme?: "light" | "dark" }> = ({
  className = "",
  size = 32,
  theme = "light",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pixa Logo"
    >
      {/* Top curved leaf/petal pointing up and to the right */}
      <path
        d="M20 37.5C20 18 36.5 4 56 4C73 4 84 15 84 37.5C64 37.5 42 37.5 20 37.5Z"
        fill={theme === "dark" ? "#FFFFFF" : "#111318"}
      />
      {/* Bottom-left electric blue vertical curved stem */}
      <path
        d="M20 37.5C32 37.5 42 37.5 42 37.5V72C42 81 33 88 20 88C14.5 88 9 84 9 76V51C9 43.5 14 37.5 20 37.5Z"
        fill="#3478F6"
      />
      {/* Bottom-right lighter blue curved lobe/bowl */}
      <path
        d="M42 37.5C66 37.5 84 49 84 65C84 81 68 72 58 72H42V37.5Z"
        fill="#60A5FA"
      />
    </svg>
  );
};

export const PixaLogo: React.FC<PixaLogoProps> = ({
  className = "",
  size = 32,
  showWordmark = true,
  wordmarkClassName = "",
  theme = "light",
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <PixaLogoIcon size={size} theme={theme} />
      {showWordmark && (
        <span
          className={`font-bold tracking-tight text-xl ${
            theme === "dark" ? "text-white" : "text-[#111318] dark:text-white"
          } ${wordmarkClassName}`}
          style={{ fontFamily: "var(--font-outfit), 'Satoshi', var(--font-manrope), sans-serif" }}
        >
          Pixa
        </span>
      )}
    </div>
  );
};

export default PixaLogo;
