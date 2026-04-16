/**
 * ImageComponent — displays images from a URL or base64 data.
 * Was `fe(props)` in the minified code.
 *
 * Props:
 * - imageSource: URL string or base64-encoded PNG data
 * - className: Optional CSS class
 */
export function ImageComponent({ imageSource, className }) {
  if (!imageSource) return null;

  const src =
    typeof imageSource === 'string' && !imageSource.startsWith('data:') && !imageSource.startsWith('/')
      ? `data:image/png;base64,${imageSource}`
      : imageSource;

  return <img src={src} alt="" className={className || 'object-image'} />;
}

export default ImageComponent;
