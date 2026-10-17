"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapRef } from "react-map-gl/mapbox";
import type { LocationAddress, LocationSuggestion } from "@/lib/geocoding";

export interface MapboxLocationPickerProps {
  onAddressChange: (address: LocationAddress) => void;
}
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const DHAKA: [number, number] = [90.4125, 23.8103];
const NOT_FOUND = "Location not found. Please try postal code or manual entry.";

export function MapboxLocationPicker({ onAddressChange }: MapboxLocationPickerProps) {
  const [modules, setModules] = useState<{
    Map: React.ElementType;
    Marker: React.ElementType;
    NavigationControl: React.ElementType | null;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<LocationSuggestion | null>(null);
  const [marker, setMarker] = useState({ lng: DHAKA[0], lat: DHAKA[1] });
  const mapRef = useRef<MapRef | null>(null);
  const onAddressRef = useRef(onAddressChange);
  onAddressRef.current = onAddressChange;
  const requestRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);
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

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("pointerdown", close); requestRef.current?.abort(); operationRef.current += 1; };
  }, []);

  const handleSelect = useCallback((suggestion: LocationSuggestion) => {
    operationRef.current += 1;
    requestRef.current?.abort();
    setSearching(false);
    setLocating(false);
    const [lng, lat] = suggestion.center;
    setMarker({ lng, lat });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: suggestion.approximate ? 10 : 15 });
    setSelected(suggestion);
    setQuery(suggestion.placeName);
    setOpen(false);
    setSuggestions([]);
    setMessage(suggestion.approximate ? "Postal area selected. Marker is an approximate district centre, not the post office. Drag it to your delivery spot and confirm the address below." : null);
    // Preserve the selected provider/postal address: reverse-geocoding here
    // used to replace rural names with an unrelated major-city address.
    onAddressRef.current(suggestion.address);
  }, []);

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      requestRef.current?.abort();
      requestRef.current = controller;
      setSearching(true);
      setMessage(null);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json() as { data?: LocationSuggestion[]; error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(result.error ?? NOT_FOUND);
        const list = result.data ?? [];
        if (/^\d{4}$/.test(query.trim()) && list.length === 1) {
          handleSelect(list[0]!);
        } else {
          setSuggestions(list);
          setOpen(list.length > 0);
          if (!list.length) setMessage(NOT_FOUND);
        }
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : NOT_FOUND);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, selected, handleSelect]);

  const reverseGeocode = useCallback(async (lng: number, lat: number, operation: number) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setSearching(true);
    try {
      const response = await fetch(`/api/geocode?lng=${lng}&lat=${lat}`, { signal: controller.signal, cache: "no-store" });
      const result = await response.json() as { data?: LocationSuggestion[]; error?: string };
      if (controller.signal.aborted || operationRef.current !== operation) return;
      const suggestion = result.data?.[0];
      if (!response.ok || !suggestion) throw new Error(result.error ?? NOT_FOUND);
      // The GPS/drag point, not the geocoder's area centre, is authoritative.
      handleSelect({ ...suggestion, center: [lng, lat] });
    } catch {
      if (!controller.signal.aborted && operationRef.current === operation) setMessage(NOT_FOUND);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, [handleSelect]);

  const handleMarkerDragEnd = useCallback((event: { lngLat: { lng: number; lat: number } }) => {
    const { lng, lat } = event.lngLat;
    const operation = ++operationRef.current;
    setMarker({ lng, lat });
    setQuery("");
    setSelected(null);
    setSuggestions([]);
    setOpen(false);
    setLocating(false);
    void reverseGeocode(lng, lat, operation);
  }, [reverseGeocode]);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setMessage("Geolocation is unavailable. Please search or enter your address manually."); return; }
    const operation = ++operationRef.current;
    requestRef.current?.abort();
    setLocating(true);
    setSearching(false);
    setQuery("");
    setSelected(null);
    setSuggestions([]);
    setOpen(false);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (operationRef.current !== operation) return;
      setLocating(false);
      if (coords.longitude < 88 || coords.longitude > 93 || coords.latitude < 20 || coords.latitude > 27) {
        setMessage("Please select a delivery location in Bangladesh."); return;
      }
      setMarker({ lng: coords.longitude, lat: coords.latitude });
      mapRef.current?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 15 });
      void reverseGeocode(coords.longitude, coords.latitude, operation);
    }, () => {
      if (operationRef.current !== operation) return;
      setLocating(false);
      setMessage("Could not access your location. Allow location permission, try again, or enter your address manually.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };

  const MapComponent = modules?.Map;
  const MarkerComponent = modules?.Marker;
  const NavigationControl = modules?.NavigationControl;

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-6 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search Bangladesh location or postal code"
          aria-expanded={open}
          aria-controls="location-suggestions"
          role="combobox"
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            operationRef.current += 1;
            requestRef.current?.abort();
            setQuery(event.target.value); setSelected(null); setSuggestions([]); setOpen(false); setMessage(null); setSearching(false); setLocating(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter") { event.preventDefault(); if (open && suggestions[0]) handleSelect(suggestions[0]); }
            if (event.key === "ArrowDown") { event.preventDefault(); containerRef.current?.querySelector<HTMLButtonElement>("[role=option]")?.focus(); }
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search area or postal code (e.g. Shiromoni, 9204)"
          className="h-12 w-full rounded-xl border border-glass-border bg-[#1A1A1A] pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        />
        {searching || locating ? <Loader2 aria-label="Finding location" className="absolute top-6 right-3.5 size-4 -translate-y-1/2 animate-spin text-primary" /> : selected ? <Check aria-label="Selected location" className="absolute top-6 right-3.5 size-4 -translate-y-1/2 text-primary" /> : null}
        {open && suggestions.length > 0 && (
          <ul id="location-suggestions" role="listbox" aria-label="Location suggestions" className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-glass-border bg-[#1A1A1A] py-1 shadow-xl">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} role="presentation">
                <button type="button" role="option" aria-selected={selected?.id === suggestion.id} onClick={() => handleSelect(suggestion)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setOpen(false);
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      const buttons = Array.from(containerRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? []);
                      const index = buttons.indexOf(event.currentTarget);
                      buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
                    }
                  }}
                  className={cn("flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-white/5 focus:bg-primary/15 focus:outline-none", selected?.id === suggestion.id && "bg-primary/15 text-primary")}>
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{suggestion.placeName}<span className="block text-xs text-muted-foreground">{suggestion.source === "locationiq" ? "© LocationIQ / OpenStreetMap contributors" : suggestion.source === "postal" ? suggestion.approximate ? "Postal directory · approximate district centre" : "Postal directory · locality centre" : "Mapbox"}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && <p className="flex gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2 text-xs text-primary"><Check aria-hidden className="size-4 shrink-0" />{selected.placeName}{selected.source === "locationiq" ? " · © LocationIQ / OpenStreetMap contributors" : ""}</p>}
      <button type="button" onClick={useMyLocation} disabled={locating} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-50"><LocateFixed aria-hidden className="size-4" />Use my current location</button>
      {message && <p role="status" className="text-sm text-amber-300">{message}</p>}
      {/* Map */}
      {MapComponent && MarkerComponent && !loadError ? (
      <div
        className="relative h-[300px] overflow-hidden rounded-2xl border border-glass-border"
      >
        <MapComponent
          ref={mapRef}
          mapboxAccessToken={TOKEN}
          initialViewState={{ longitude: marker.lng, latitude: marker.lat, zoom: selected?.approximate ? 10 : 13 }}
          onError={() => setLoadError("Map could not load. Please use search or manual address entry.")}
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
      ) : <div className="rounded-xl border border-glass-border p-4 text-sm text-muted-foreground">{loadError ?? "Loading map…"} Search and manual entry remain available.</div>}
      <p className="text-xs text-muted-foreground">Can&apos;t find your area? Try postal code or type manually. Drag the marker to fine-tune the delivery spot; always confirm the address fields below. Geocoding: <a href="https://locationiq.com/" target="_blank" rel="noreferrer" className="underline">LocationIQ</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>. Postal coordinates: <a href="https://www.geonames.org/7486172/" target="_blank" rel="noreferrer" className="underline">GeoNames</a> / <a href="https://github.com/whosonfirst-data/whosonfirst-data-admin-bd/blob/c6c88a155fe0215a778e4a80118a9a3d4a5c7071/LICENSE.md" target="_blank" rel="noreferrer" className="underline">Who’s On First (license)</a>.</p>
    </div>
  );
}
