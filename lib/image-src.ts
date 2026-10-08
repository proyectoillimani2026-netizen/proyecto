export function menuSources(url: string, sizes: string) {
  const src = url || "/food-fallback.svg";
  if (!src.endsWith("-720.webp")) return { src, srcSet: undefined, sizes };
  const small = src.replace("-720.webp", "-256.webp");
  return { src: small, srcSet: `${small} 256w, ${src} 720w`, sizes };
}

export function bannerSources(url: string) {
  const sizes = "(max-width: 640px) 100vw, 60vw";
  if (!url.endsWith("-1200.webp")) return { src: url, srcSet: undefined, sizes };
  const small = url.replace("-1200.webp", "-800.webp");
  return { src: small, srcSet: `${small} 800w, ${url} 1200w`, sizes };
}
