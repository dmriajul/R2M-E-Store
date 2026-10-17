"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapRef } from "react-map-gl/mapbox";

export interface MapboxLocationPickerProps {
  /** Called whenever the marker moves (search selection or manual drag). */
  onAddressChange: (address: {
    address1: string;
    address2?: string;
    city: string;
    state?: string;
    postalCode?: string;
  }) => void;
}

interface Suggestion {
  id: string;
  placeName: string;
  center: [number, number];
}

interface ParsedAddress {
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const DHAKA: [number, number] = [90.4125, 23.8103];

/** Map a Mapbox context entry to a value by its id prefix. */
function contextValue(context: Array<{ id: string; text: string }> | undefined, prefix: string): string | undefined {
  return context?.find((entry) => entry.id.startsWith(prefix))?.text;
}

function parseReverse(feature: {
  place_name?: string;
  text?: string;
  address?: string;
  context?: Array<{ id: string; text: string }>;
}): ParsedAddress {
  const context = feature.context ?? [];
  const district =
    contextValue(context, "district") ??
    contextValue(context, "place") ??
    feature.text ??
    "";
  const thana = contextValue(context, "locality") ?? contextValue(context, "neighborhood");
  const region = contextValue(context, "region");
  const postcode = contextValue(context, "postcode");

  const streetParts = [feature.address, feature.text].filter(Boolean).join(" ").trim();
  const detailed = feature.place_name?.split(",")[0]?.trim() || streetParts || feature.place_name || "";

  return {
    address1: detailed,
    address2: thana && thana !== district ? thana : undefined,
    city: district || "Dhaka",
    state: region,
    postalCode: postcode,
  };
}

/**
 * Visual Mapbox location picker.
 *
 * Modules are loaded dynamically so `mapbox-gl` never blocks the initial
 * render, and the Mapbox stylesheet is injected on mount.
 */
export function MapboxLocationPicker({ onAddressChange }: MapboxLocationPickerProps) {
  const [modules, setModules] = useState<{
    Map: React.ElementType;
    Marker: React.ElementType;
    NavigationControl: React.ElementType | null;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [reversing, setReversing] = useState(false);

  const [marker, setMarker] = useState<{ lng: number; lat: number }>({ lng: DHAKA[0], lat: DHAKA[1] });
  const mapRef = useRef<MapRef | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dynamically load Mapbox + react-map-gl and the stylesheet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!TOKEN) {
        setLoadError("Mapbox is not configured. Please type your address manually below.");
        return;
      }
      try {
        const [mb, rm] = await Promise.all([
          import("mapbox-gl"),
          import("react-map-gl/mapbox"),
        ]);
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (cancelled) return;
        mb.default.accessToken = TOKEN;
        setModules({
          Map: rm.Map as React.ElementType,
          Marker: rm.Marker as React.ElementType,
          NavigationControl: (rm.NavigationControl ?? null) as React.ElementType | null,
        });
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Mapbox failed to load. Please type your address manually below.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reverseGeocode = useCallback(
    async (lng: number, lat: number) => {
      if (!TOKEN) return;
      setReversing(true);
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${encodeURIComponent(
            TOKEN,
          )}&country=bd&types=address,poi,place,locality,neighborhood,district,region&limit=1`,
        );
        if (!response.ok) throw new Error("Reverse geocoding failed");
        const data = (await response.json()) as { features?: Array<Parameters<typeof parseReverse>[0]> };
        const feature = data.features?.[0];
        if (feature) {
          const parsed = parseReverse(feature);
          onAddressChange(parsed);
          if (feature.place_name) setQuery(feature.place_name);
        }
      } catch {
        // Silent: manual entry remains available.
      } finally {
        setReversing(false);
      }
    },
    [onAddressChange],
  );

  // Search suggestions.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2 || !TOKEN) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${encodeURIComponent(
            TOKEN,
          )}&country=bd&autocomplete=true&limit=5`,
        );
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as {
          features?: Array<{ id: string; place_name: string; center: [number, number] }>;
        };
        const list: Suggestion[] = (data.features ?? []).map((feature) => ({
          id: feature.id,
          placeName: feature.place_name,
          center: feature.center,
        }));
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      const [lng, lat] = suggestion.center;
      setMarker({ lng, lat });
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 });
      setQuery(suggestion.placeName);
      setOpen(false);
      setSuggestions([]);
      void reverseGeocode(lng, lat);
    },
    [reverseGeocode],
  );

  const handleMarkerDragEnd = useCallback(
    (event: { lngLat: { lng: number; lat: number } }) => {
      const { lng, lat } = event.lngLat;
      setMarker({ lng, lat });
      void reverseGeocode(lng, lat);
    },
    [reverseGeocode],
  );

  if (loadError) {
    return (
      <div className="rounded-2xl border border-glass-border bg-glass px-4 py-3 text-sm text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (!modules) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-glass-border bg-glass">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const MapComponent = modules!.Map;
  const MarkerComponent = modules!.Marker;
  const NavigationControl = modules!.NavigationControl;

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search location (e.g. Dhanmondi)"
          className={cn(
            "h-12 w-full rounded-xl border border-glass-border bg-[#1A1A1A] pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          )}
        />
        {searching || reversing ? (
          <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}

        {open && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-glass-border bg-[#1A1A1A] py-1 shadow-xl">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-white/5"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{suggestion.placeName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="relative h-[300px] overflow-hidden rounded-2xl border border-glass-border"
      >
        <MapComponent
          ref={mapRef}
          mapboxAccessToken={TOKEN}
          initialViewState={{ longitude: DHAKA[0], latitude: DHAKA[1], zoom: 13 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        >
          <MarkerComponent
            longitude={marker.lng}
            latitude={marker.lat}
            draggable
            onDragEnd={handleMarkerDragEnd}
          >
            <div className="grid size-8 place-items-center rounded-full border-2 border-primary bg-primary/90 text-primary-foreground shadow-lg">
              <MapPin className="size-4" />
            </div>
          </MarkerComponent>
          {NavigationControl ? <NavigationControl position="top-right" /> : null}
        </MapComponent>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag the marker to fine-tune the delivery spot. Address fields update automatically.
      </p>
    </div>
  );
}
