import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus, Trash2, Plane, Pencil } from "lucide-react";
import { createItinerary, deleteItinerary, fetchItinerary, listItineraries, updateItinerary } from "../api/client";
import TripMap from "../components/TripMap";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "../components/ui/primitives";
import type { Itinerary, SegmentDraft, SegmentType } from "../types";

const TYPES: SegmentType[] = ["FLIGHT", "TRAIN", "TRANSFER", "HOTEL", "ACTIVITY"];

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function itineraryToDrafts(itinerary: Itinerary): SegmentDraft[] {
  const ordered = [...itinerary.segments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
  return ordered.map((segment) => ({
    type: segment.type,
    name: segment.name,
    description: segment.description || "",
    start_time: toLocalInput(new Date(segment.start_time)),
    end_time: toLocalInput(new Date(segment.end_time)),
    location_start: segment.location_start || "",
    location_end: segment.location_end || "",
    cost: String(segment.cost ?? 0),
  }));
}

function blankSegment(): SegmentDraft {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    type: "FLIGHT",
    name: "",
    description: "",
    start_time: toLocalInput(start),
    end_time: toLocalInput(end),
    location_start: "",
    location_end: "",
    cost: "0",
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: trips = [], isLoading } = useQuery({ queryKey: ["itineraries"], queryFn: listItineraries });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId || trips[0]?.id;

  const { data: selectedTrip } = useQuery({
    queryKey: ["itinerary", activeId],
    queryFn: () => fetchItinerary(activeId!),
    enabled: Boolean(activeId),
  });

  const [tripName, setTripName] = useState("");
  const [travelerName, setTravelerName] = useState("");
  const [segments, setSegments] = useState<SegmentDraft[]>([blankSegment(), blankSegment()]);
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setTripName("");
    setTravelerName("");
    setSegments([blankSegment(), blankSegment()]);
  }

  function startEdit(itinerary: Itinerary) {
    const drafts = itineraryToDrafts(itinerary);
    setEditingId(itinerary.id);
    setTripName(itinerary.name);
    setTravelerName(itinerary.traveler_name);
    setSegments(drafts.length ? drafts : [blankSegment()]);
    setSelectedId(itinerary.id);
    window.setTimeout(() => {
      document.getElementById("trip-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createItinerary>[0]) =>
      editingId ? updateItinerary(editingId, payload) : createItinerary(payload),
    onSuccess: (saved) => {
      localStorage.setItem("tripguard-last-itin", saved.id);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.setQueryData(["itinerary", saved.id], saved);
      setSelectedId(saved.id);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItinerary,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.removeQueries({ queryKey: ["itinerary", deletedId] });
      if (editingId === deletedId) resetForm();
      if (selectedId === deletedId) setSelectedId(null);
    },
  });

  const stats = useMemo(() => {
    const disrupted = trips.filter((t) => t.status === "DISRUPTED" || t.status === "AT_RISK").length;
    return { trips: trips.length, legs: trips.reduce((sum, t) => sum + t.segment_count, 0), disrupted };
  }, [trips]);

  function updateSegment(index: number, patch: Partial<SegmentDraft>) {
    setSegments((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const payloadSegments = segments
      .filter((s) => s.name.trim() && s.location_start.trim())
      .map((s) => ({
        ...s,
        start_time: new Date(s.start_time).toISOString(),
        end_time: new Date(s.end_time).toISOString(),
        cost: Number(s.cost) || 0,
      }));
    if (!tripName.trim() || !travelerName.trim() || payloadSegments.length === 0) return;
    saveMutation.mutate({
      name: tripName.trim(),
      traveler_name: travelerName.trim(),
      segments: payloadSegments,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-primary">Operations home</p>
        <h1 className="text-3xl font-bold mt-1">Dashboard</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Enter a real trip, then open the traveler view or run a disruption from Operations. Maps use OpenStreetMap plus geocoding for each stop.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Trips</p><p className="text-3xl font-bold">{stats.trips}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Segments</p><p className="text-3xl font-bold">{stats.legs}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">At risk</p><p className="text-3xl font-bold">{stats.disrupted}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Trip map</CardTitle>
          </CardHeader>
          <CardContent>
            <TripMap key={selectedTrip?.id || "empty"} itinerary={selectedTrip} />
            {!selectedTrip && <p className="text-sm text-muted-foreground mt-3">Save a trip with city names to plot the route.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved trips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading trips...</p>}
            {!isLoading && trips.length === 0 && (
              <p className="text-sm text-muted-foreground">No trips yet. Enter one below instead of using a demo itinerary.</p>
            )}
            {trips.map((trip) => (
              <div key={trip.id} className={`rounded-lg border p-3 ${trip.id === activeId ? "border-primary" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <button className="text-left" onClick={() => setSelectedId(trip.id)}>
                    <p className="font-medium">{trip.name}</p>
                    <p className="text-sm text-muted-foreground">{trip.traveler_name} · {trip.segment_count} segments</p>
                  </button>
                  <Badge>{trip.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{trip.locations.join(" → ") || "No locations"}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" onClick={() => { localStorage.setItem("tripguard-last-itin", trip.id); navigate(`/operations/${trip.id}`); }}>
                    <Plane className="w-3 h-3 mr-1" /> Operations
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { localStorage.setItem("tripguard-last-itin", trip.id); navigate(`/traveler/${trip.id}`); }}>
                    Traveler view
                  </Button>
                  <Button
                    size="sm"
                    variant={editingId === trip.id ? "default" : "outline"}
                    onClick={async () => {
                      const full = trip.id === selectedTrip?.id ? selectedTrip : await fetchItinerary(trip.id);
                      startEdit(full);
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> {editingId === trip.id ? "Editing" : "Edit"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(trip.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card id="trip-editor">
        <CardHeader>
          <CardTitle>{editingId ? `Edit trip · ${editingId}` : "Manual trip entry"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm space-y-1">
                <span>Trip name</span>
                <input className="w-full h-10 rounded-md border border-input bg-background px-3" value={tripName} onChange={(e) => setTripName(e.target.value)} placeholder="Mumbai weekend" required />
              </label>
              <label className="text-sm space-y-1">
                <span>Traveler name</span>
                <input className="w-full h-10 rounded-md border border-input bg-background px-3" value={travelerName} onChange={(e) => setTravelerName(e.target.value)} placeholder="Priya Shah" required />
              </label>
            </div>

            {segments.map((segment, index) => (
              <div key={index} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Segment {index + 1}</p>
                  {segments.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSegments((rows) => rows.filter((_, i) => i !== index))}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select className="h-10 rounded-md border border-input bg-background px-3" value={segment.type} onChange={(e) => updateSegment(index, { type: e.target.value as SegmentType })}>
                    {TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input className="h-10 rounded-md border border-input bg-background px-3 md:col-span-2" placeholder="Flight Mumbai to Delhi" value={segment.name} onChange={(e) => updateSegment(index, { name: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="h-10 rounded-md border border-input bg-background px-3" placeholder="From: Mumbai" value={segment.location_start} onChange={(e) => updateSegment(index, { location_start: e.target.value })} />
                  <input className="h-10 rounded-md border border-input bg-background px-3" placeholder="To: Delhi" value={segment.location_end} onChange={(e) => updateSegment(index, { location_end: e.target.value })} />
                  <input type="datetime-local" className="h-10 rounded-md border border-input bg-background px-3" value={segment.start_time} onChange={(e) => updateSegment(index, { start_time: e.target.value })} />
                  <input type="datetime-local" className="h-10 rounded-md border border-input bg-background px-3" value={segment.end_time} onChange={(e) => updateSegment(index, { end_time: e.target.value })} />
                  <input className="h-10 rounded-md border border-input bg-background px-3" placeholder="Notes" value={segment.description} onChange={(e) => updateSegment(index, { description: e.target.value })} />
                  <input className="h-10 rounded-md border border-input bg-background px-3" placeholder="Cost" value={segment.cost} onChange={(e) => updateSegment(index, { cost: e.target.value })} />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setSegments((rows) => [...rows, blankSegment()])}>
                <Plus className="w-4 h-4 mr-2" /> Add segment
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editingId ? "Update trip" : "Save trip"}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel edit
                </Button>
              )}
            </div>
            {saveMutation.isError && <p className="text-sm text-destructive">Could not save the trip. Check the API is running.</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
