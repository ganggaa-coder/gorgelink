import React from 'react';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  priority?: boolean;
}

/**
 * Reusable Image component compatible with Next.js/React Image API.
 * Safely renders optimized images from the /public folder with lazy loading and async decoding.
 */
export default function Image({
  src,
  alt,
  width,
  height,
  className = '',
  loading = 'lazy',
  priority = false,
  ...rest
}: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : loading}
      decoding="async"
      className={className}
      {...rest}
    />
  );
}

export { Image };
