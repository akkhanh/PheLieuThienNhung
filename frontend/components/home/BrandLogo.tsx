import React from "react";

export default function BrandLogo({ className = "" }: { className?: string }) {
  // A plain SVG image stays smaller than the raster optimization runtime.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/thien-nhung-logo-black.svg" alt="Phế Liệu Thiên Nhung" className={`brand-logo ${className}`.trim()} width="640" height="200" />;
}
