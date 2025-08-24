import type { Image } from "../music-types";

export function getImageByWidth(images: Image[], minWidth: number) {
  const smallestFirstImages = images.toSorted((a, b) => a.width - b.width);

  const image1x =
    smallestFirstImages.find((image) => image.width >= minWidth) ||
    smallestFirstImages.at(-1);
  const image2x = smallestFirstImages.find(
    (image) => image.width >= minWidth * 2,
  );

  return { image1x, image2x };
}
