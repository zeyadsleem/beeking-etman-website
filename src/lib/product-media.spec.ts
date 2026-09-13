import { describe, expect, it } from "vite-plus/test";
import { productPhotos } from "./product-media";

describe("productPhotos", () => {
  it("removes unrelated legacy gallery images and duplicate angles while retaining uploads", () => {
    const own = "/images/Beeking Etman/own.jpg";
    expect(
      productPhotos({
        image: own,
        variants: [{ image: own }],
        images: [
          own,
          "/images/Beeking Etman/other.jpg",
          "/uploads/back.jpg",
          "/images/etman-wax-ar.png",
        ],
      }),
    ).toEqual([own, "/uploads/back.jpg"]);
  });
  it("does not present a category photo as a missing product's photograph", () => {
    expect(
      productPhotos({
        image: "/logo.svg",
        variants: [],
        images: ["/images/Beeking Etman/other.jpg"],
      }),
    ).toEqual([]);
  });
  it("puts the selected variant first", () => {
    expect(
      productPhotos(
        {
          image: "/uploads/a.jpg",
          variants: [{ image: "/uploads/a.jpg" }, { image: "/uploads/b.jpg" }],
          images: [],
        },
        "/uploads/b.jpg",
      ),
    ).toEqual(["/uploads/b.jpg", "/uploads/a.jpg"]);
  });
});
