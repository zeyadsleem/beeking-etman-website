import { isPlaceholderImage } from "./storefront";

const catalogPhotoPrefix = "/images/Beeking Etman/";
const catalogPhotos: Record<string, string> = {
  "honey-clover-500g-plastic": "عسل برسيم 500 جرام بلاستيك.png",
  "honey-clover-1kg-plastic-sku1001": "عسل 1 كيلو برسيم بلاستيك.png",
};

/** Keep genuine product photos, excluding legacy cross-sells and brand artwork. */
export function productPhotos(
  product: { slug?: string; image: string; images: string[]; variants: { image: string }[] },
  selectedImage?: string,
): string[] {
  const ownImages = product.variants.map((v) => v.image).filter((src) => !isPlaceholderImage(src));
  if (!isPlaceholderImage(product.image)) ownImages.push(product.image);
  const fallback = product.slug && catalogPhotos[product.slug];
  if (!ownImages.length && fallback) ownImages.push(catalogPhotoPrefix + fallback);
  const candidates = [selectedImage, ...ownImages, ...product.images];
  return [
    ...new Set(
      candidates.filter((src): src is string => {
        if (!src || isPlaceholderImage(src) || /etman-wax|\/logo\./.test(src)) return false;
        // Legacy seed galleries contain other products from the same category.
        // Retain custom uploads and only the product's own library photos.
        return !src.startsWith(catalogPhotoPrefix) || ownImages.includes(src);
      }),
    ),
  ];
}
