import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MapPin, Clock, User } from "lucide-react";
import { fetchItinerary, listItineraries } from "../api/client";
import TripMap from "../components/TripMap";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "../components/ui/primitives";

function formatWhen(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TravelerDashboard() {
  const { itinId } = useParams();
  const stored = typeof window !== "undefined" ? localStorage.getItem("tripguard-last-itin") : null;
  const { data: trips = [] } = useQuery({ queryKey: ["itineraries"], queryFn: listItineraries });
  const activeId = itinId || stored || trips[0]?.id;

  const { data: itinerary, isLoading, error } = useQuery({
    queryKey: ["itinerary", activeId],
    queryFn: () => fetchItinerary(activeId!),
    enabled: Boolean(activeId),
  });

  if (!activeId) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h1 className="text-2xl font-bold">Traveler dashboard</h1>
          <p className="text-muted-foreground">No trip has been entered yet. Create one on the dashboard to see the traveler timeline and map.</p>
          <Link className="text-primary underline" to="/">Go to dashboard</Link>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <p>Loading traveler itinerary...</p>;
  if (error || !itinerary) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p>This trip is not available. Enter a trip from the dashboard.</p>
          <Link className="text-primary underline" to="/">Back to dashboard</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-primary">Traveler view</p>
          <h1 className="text-3xl font-bold mt-1">{itinerary.name}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <User className="w-4 h-4" /> {itinerary.traveler_name}
          </p>
        </div>
        <Link to={`/operations/${itinerary.id}`} className="text-sm text-primary underline">Open in operations</Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Live map</CardTitle>
          </CardHeader>
          <CardContent>
            <TripMap key={itinerary.id} itinerary={itinerary} height={460} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your itinerary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {itinerary.segments.map((segment) => (
              <div key={segment.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{segment.name}</p>
                    <p className="text-sm text-muted-foreground">{segment.type} · {segment.location_start} {segment.location_end ? `→ ${segment.location_end}` : ""}</p>
                  </div>
                  <Badge variant={segment.status === "DISRUPTED" ? "destructive" : "secondary"}>{segment.status}</Badge>
                </div>
                <p className="text-sm mt-2 flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {formatWhen(segment.start_time)} – {formatWhen(segment.end_time)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
