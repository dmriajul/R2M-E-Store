"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { BADGE_STYLES } from "@/lib/site";
import { ProductArtwork } from "@/components/product/ProductArtwork";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types";

interface ProductGalleryProps {
  product: Product;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function ProductGallery({ product }: ProductGalleryProps) {
  const images = product.images.length > 0 ? product.images : [""];
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef({ distance: 0, zoom: MIN_ZOOM });
  const panStart = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const activeSrc = images[activeImage] ?? images[0];

  const changeImage = (index: number) => {
    setActiveImage((index + images.length) % images.length);
    resetZoom();
  };

  function resetZoom() {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }

  const closeLightbox = (open: boolean) => {
    setLightboxOpen(open);
    if (!open) resetZoom();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [first, second] = Array.from(pointers.current.values());
      pinchStart.current = {
        distance: Math.hypot(first!.x - second!.x, first!.y - second!.y),
        zoom,
      };
    } else if (zoom > MIN_ZOOM) {
      panStart.current = {
        x: event.clientX,
        y: event.clientY,
        originX: pan.x,
        originY: pan.y,
      };
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2) {
      const [first, second] = Array.from(pointers.current.values());
      const distance = Math.hypot(first!.x - second!.x, first!.y - second!.y);
      if (pinchStart.current.distance > 0) {
        setZoom(
          Math.min(
            MAX_ZOOM,
            Math.max(
              MIN_ZOOM,
              pinchStart.current.zoom * (distance / pinchStart.current.distance),
            ),
          ),
        );
      }
      return;
    }

    if (zoom > MIN_ZOOM) {
      setPan({
        x: panStart.current.originX + event.clientX - panStart.current.x,
        y: panStart.current.originY + event.clientY - panStart.current.y,
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current.distance = 0;
    if (pointers.current.size === 1) {
      const [point] = Array.from(pointers.current.values());
      panStart.current = {
        x: point!.x,
        y: point!.y,
        originX: pan.x,
        originY: pan.y,
      };
    }
  };

  const renderImage = (size: "detail" | "zoom") => (
    <OptimizedImage
      src={activeSrc}
      alt={`${product.name} — image ${activeImage + 1}`}
      preset={size}
      priority={size === "zoom"}
      objectFit={size === "zoom" ? "contain" : "cover"}
      className="h-full w-full"
      fallback={
        <ProductArtwork
          product={product}
          index={activeImage}
          size="detail"
          className="h-full w-full"
        />
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={`Open image ${activeImage + 1} of ${images.length} for ${product.name}`}
          className="group relative block aspect-square w-full overflow-hidden rounded-3xl border border-glass-border bg-[#101010] text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {renderImage("detail")}
          <span className="pointer-events-none absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-3 py-2 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ZoomIn aria-hidden className="size-4" />
            Zoom image
          </span>
        </button>

        {product.badge && (
          <Badge
            className={cn(
              "absolute top-4 left-4 border text-[10px] font-bold tracking-wider uppercase backdrop-blur-md",
              BADGE_STYLES[product.badge],
            )}
          >
            {product.badge}
          </Badge>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Product images">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => changeImage(index)}
              aria-label={`View image ${index + 1} of ${images.length}`}
              aria-pressed={activeImage === index}
              className={cn(
                "group/thumb relative size-20 shrink-0 overflow-hidden rounded-xl border transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-24",
                activeImage === index
                  ? "border-primary/70"
                  : "border-glass-border opacity-70 hover:opacity-100",
              )}
            >
              <OptimizedImage
                src={image}
                alt=""
                preset="thumbnail"
                className="h-full w-full"
                fallback={
                  <ProductArtwork
                    product={product}
                    index={index}
                    size="thumb"
                    className="h-full w-full"
                  />
                }
              />
            </button>
          ))}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={closeLightbox}>
        <DialogContent
          showCloseButton
          className="flex h-[min(92dvh,900px)] w-[min(96vw,1200px)] max-w-none flex-col gap-3 overflow-hidden border-glass-border bg-[#090909]/98 p-3 backdrop-blur-2xl sm:p-5"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{product.name} image viewer</DialogTitle>
            <DialogDescription>
              Image {activeImage + 1} of {images.length}. Pinch or use the controls to zoom.
            </DialogDescription>
          </DialogHeader>

          <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={() => (zoom > MIN_ZOOM ? resetZoom() : setZoom(2))}
            style={{ touchAction: "none" }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: pointers.current.size > 0 ? "none" : "transform 160ms ease-out",
              }}
            >
              {renderImage("zoom")}
            </div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => changeImage(activeImage - 1)}
                  aria-label="Previous image"
                  className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2.5 text-white backdrop-blur hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ChevronLeft aria-hidden className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => changeImage(activeImage + 1)}
                  aria-label="Next image"
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2.5 text-white backdrop-blur hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ChevronRight aria-hidden className="size-5" />
                </button>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3">
            <p className="truncate text-xs text-muted-foreground">
              {product.name} · {activeImage + 1} / {images.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - 0.5))}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
                className="rounded-full border border-glass-border p-2 text-foreground disabled:opacity-40"
              >
                <ZoomOut aria-hidden className="size-4" />
              </button>
              <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + 0.5))}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
                className="rounded-full border border-glass-border p-2 text-foreground disabled:opacity-40"
              >
                <ZoomIn aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                aria-label="Reset zoom"
                className="rounded-full border border-glass-border p-2 text-foreground"
              >
                <RotateCcw aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
