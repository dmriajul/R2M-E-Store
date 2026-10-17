"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RETURN_PAGE_SIZE, RETURNS_AUTO_REFRESH_KEY, RETURNS_LOAD_ERROR, isUrgentReturn, returnReference, returnsToCsv, statusAfterAction, type ReturnActionInput, type ReturnsPage } from "@/lib/admin-returns";
import type { ApiResponse, ReturnRequestRecord } from "@/types";

interface FeedState {
  rows: ReturnRequestRecord[];
  total: number;
  summary: ReturnsPage["summary"];
  nextCursor: string | null;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  errorDetail: string | null;
  updatedAt: string | null;
}
const initialState: FeedState = { rows: [], total: 0, summary: { total: 0, pending: 0, urgent: 0 }, nextCursor: null, loading: true, refreshing: false, loadingMore: false, error: null, errorDetail: null, updatedAt: null };

export async function fetchReturnsPage(query: string, cursor: string | null, signal: AbortSignal, pageSize = RETURN_PAGE_SIZE): Promise<ReturnsPage> {
  const params = new URLSearchParams(query);
  params.set("pageSize", String(pageSize));
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/admin/returns?${params}`, { cache: "no-store", signal });
  const result = await response.json() as ReturnsPage;
  if (!response.ok || !result.success || !Array.isArray(result.data) || !result.pagination) throw new Error(result.error ?? RETURNS_LOAD_ERROR);
  return result;
}

export function useAdminReturns(query: string) {
  const [feed, setFeed] = useState<FeedState>(initialState);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [offline, setOffline] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const feedRef = useRef(feed);
  feedRef.current = feed;
  const fetchRef = useRef<AbortController | null>(null);
  const mutationRef = useRef<AbortController | null>(null);
  const exportRef = useRef<AbortController | null>(null);

  const load = useCallback(async (more = false, notify = false) => {
    if (fetchRef.current || mutationRef.current) return false;
    const cursor = more ? feedRef.current.nextCursor : null;
    if (more && !cursor) return false;
    if (!navigator.onLine) {
      setOffline(true);
      setFeed((s) => ({ ...s, loading: false, error: RETURNS_LOAD_ERROR, errorDetail: "You are offline. Reconnect to load the latest requests." }));
      if (notify) toast.error(RETURNS_LOAD_ERROR);
      return false;
    }
    const controller = new AbortController();
    fetchRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setFeed((s) => ({ ...s, loading: !more && s.rows.length === 0, refreshing: !more, loadingMore: more, error: null, errorDetail: null }));
    try {
      const result = await fetchReturnsPage(query, cursor, controller.signal);
      if (controller.signal.aborted || fetchRef.current !== controller) return false;
      setFeed((s) => ({
        ...s, rows: more ? [...new Map([...s.rows, ...result.data].map((r) => [r.id, r])).values()] : result.data,
        total: result.pagination.total, summary: result.summary, nextCursor: result.pagination.nextCursor,
        loading: false, refreshing: false, loadingMore: false, updatedAt: new Date().toISOString(), error: null, errorDetail: null,
      }));
      if (notify) toast.success("Returns list updated");
      return true;
    } catch (error) {
      if (fetchRef.current !== controller) return false;
      setFeed((s) => ({ ...s, error: RETURNS_LOAD_ERROR, errorDetail: controller.signal.aborted ? "The request timed out. Your existing list has been kept." : error instanceof Error ? error.message : null }));
      if (notify) toast.error(RETURNS_LOAD_ERROR);
      return false;
    } finally {
      clearTimeout(timeout);
      if (fetchRef.current === controller) {
        fetchRef.current = null;
        setFeed((s) => ({ ...s, loading: false, refreshing: false, loadingMore: false }));
      }
    }
  }, [query]);

  useEffect(() => {
    setFeed(initialState);
    void load();
    return () => {
      const controller = fetchRef.current;
      fetchRef.current = null;
      controller?.abort();
    };
  }, [load]);

  useEffect(() => {
    try { setAutoRefresh(localStorage.getItem(RETURNS_AUTO_REFRESH_KEY) === "true"); } catch { /* Restricted storage must not break fetching. */ }
    return () => {
      const mutation = mutationRef.current;
      const exporting = exportRef.current;
      mutationRef.current = null;
      exportRef.current = null;
      mutation?.abort();
      exporting?.abort();
    };
  }, []);

  const toggleAutoRefresh = (value: boolean) => {
    setAutoRefresh(value);
    try { localStorage.setItem(RETURNS_AUTO_REFRESH_KEY, String(value)); } catch { toast.info("Auto-refresh preference applies to this visit only; it could not be saved."); }
  };

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOffline = () => setOffline(true);
    const onOnline = () => { setOffline(false); void load(); };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => { window.removeEventListener("offline", onOffline); window.removeEventListener("online", onOnline); };
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => { if (!document.hidden && navigator.onLine) void load(); }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r" || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if ((event.target as Element | null)?.closest("input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=dialog]")) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      void load(false, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load]);

  const performAction = useCallback(async (item: ReturnRequestRecord, input: ReturnActionInput) => {
    if (mutationRef.current || !navigator.onLine) return false;
    const pendingFetch = fetchRef.current;
    fetchRef.current = null;
    pendingFetch?.abort();
    const controller = new AbortController();
    mutationRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    const snapshot = feedRef.current;
    const status = statusAfterAction(input.action);
    const selectedStatuses = new URLSearchParams(query).get("status")?.split(",");
    const remainsVisible = !selectedStatuses?.length || selectedStatuses.includes(status);
    setUpdatingId(item.id);
    setFeed((s) => ({
      ...s, rows: s.rows.flatMap((r) => r.id !== item.id ? [r] : remainsVisible ? [{ ...r, status, ...(input.action === "reject" ? { adminNote: input.adminNote } : {}) }] : []),
      total: s.total - (remainsVisible ? 0 : 1), loading: false, refreshing: false, loadingMore: false,
      summary: { ...s.summary, pending: s.summary.pending - (item.status === "PENDING" ? 1 : 0), urgent: s.summary.urgent - (isUrgentReturn(item) ? 1 : 0) },
    }));
    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: controller.signal });
      const result = await response.json() as ApiResponse<{ request: ReturnRequestRecord; notification: string }>;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Could not update return request. Try again.");
      if (controller.signal.aborted) throw new Error("Update timed out");
      const updated = result.data.request;
      setFeed((s) => ({ ...s, rows: s.rows.map((r) => r.id === updated.id ? updated : r) }));
      const verb = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "completed";
      toast.success(`Return ${returnReference(item.id)} ${verb}`);
      window.dispatchEvent(new Event("mukra:returns-updated"));
      return true;
    } catch (error) {
      if (mutationRef.current === controller) {
        setFeed(snapshot);
        toast.error(controller.signal.aborted ? "Update timed out. Refresh to check whether it was saved before retrying." : error instanceof Error ? error.message : "Could not update return request. Try again.");
      }
      return false;
    } finally {
      clearTimeout(timeout);
      if (mutationRef.current === controller) {
        mutationRef.current = null;
        setUpdatingId(null);
        // Reconcile server counts/filter membership without turning a successful
        // PATCH into a failed action if this subsequent GET fails.
        void load();
      }
    }
  }, [query, load]);

  const exportCsv = useCallback(async () => {
    if (exportRef.current || !navigator.onLine) return;
    const controller = new AbortController();
    exportRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setExporting(true);
    try {
      const all = new Map<string, ReturnRequestRecord>();
      const seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const result = await fetchReturnsPage(query, cursor, controller.signal, 100);
        for (const row of result.data) all.set(row.id, row);
        cursor = result.pagination.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error("Export pagination could not advance. Please retry.");
        if (cursor) seen.add(cursor);
      } while (cursor && !controller.signal.aborted);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(new Blob(["\uFEFF", returnsToCsv([...all.values()])], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `mukra-returns-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exported ${all.size} return requests`);
    } catch (error) {
      if (exportRef.current === controller) toast.error(error instanceof Error ? error.message : "Could not export returns");
    } finally {
      clearTimeout(timeout);
      if (exportRef.current === controller) { exportRef.current = null; setExporting(false); }
    }
  }, [query]);

  const refresh = useCallback(() => load(false, true), [load]);
  const loadMore = useCallback(() => load(true), [load]);

  return { ...feed, offline, autoRefresh, toggleAutoRefresh, updatingId, performAction, exporting, exportCsv, refresh, loadMore };
}
