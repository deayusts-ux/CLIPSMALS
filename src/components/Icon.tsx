"use client";

export function Icon({
  name,
  className = "",
  fill = false,
  size,
}: {
  name: string;
  className?: string;
  fill?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`material-symbols-outlined ${fill ? "icon-fill" : ""} ${className}`}
      style={size ? { fontSize: size } : undefined}
      aria-hidden
    >
      {name}
    </span>
  );
}