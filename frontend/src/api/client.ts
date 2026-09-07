import type { Itinerary, ItinerarySummary, RecoveryResponse, SegmentDraft } from "../types";

export const API_BASE = "/api";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }
  return res.json();
}

export function listItineraries() {
  return fetch(`${API_BASE}/itineraries`).then((res) => parse<ItinerarySummary[]>(res));
}

export function fetchItinerary(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}`).then((res) => parse<Itinerary>(res));
}

export function createItinerary(payload: {
  name: string;
  traveler_name: string;
  segments: Array<Omit<SegmentDraft, "cost"> & { cost: number }>;
}) {
  return fetch(`${API_BASE}/itineraries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => parse<Itinerary>(res));
}

export function updateItinerary(
  id: string,
  payload: {
    name: string;
    traveler_name: string;
    segments: Array<Omit<SegmentDraft, "cost"> & { cost: number }>;
  },
) {
  return fetch(`${API_BASE}/itinerary/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => parse<Itinerary>(res));
}

export function deleteItinerary(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}`, { method: "DELETE" }).then((res) => parse<{ ok: boolean }>(res));
}

export function disruptItinerary(id: string, segmentId: string, delayMinutes: number) {
  return fetch(`${API_BASE}/itinerary/${id}/disrupt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segment_id: segmentId, delay_minutes: delayMinutes, reason: "Manual disruption" }),
  }).then((res) => parse<Itinerary>(res));
}

export function getRecoveryPlans(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}/recover`).then((res) => parse<RecoveryResponse>(res));
}

export function applyRecoveryPlan(itinId: string, planId: string) {
  return fetch(`${API_BASE}/itinerary/${itinId}/apply-plan/${planId}`, { method: "POST" }).then((res) =>
    parse<Itinerary>(res),
  );
}

export function resetItinerary(id: string) {
  return fetch(`${API_BASE}/itinerary/${id}/reset`, { method: "POST" }).then((res) => parse<Itinerary>(res));
}
