import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchItinerary, disruptItinerary, getRecoveryPlans, applyRecoveryPlan, resetItinerary, listItineraries } from "../api/client";
import DependencyGraph from "../components/DependencyGraph";
import TripMap from "../components/TripMap";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from "../components/ui/primitives";
import { AlertTriangle, RefreshCw, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChaosSimulator() {
  const { itinId } = useParams();
  const stored = typeof window !== "undefined" ? localStorage.getItem("tripguard-last-itin") : null;
  const queryClient = useQueryClient();
  const { data: trips = [] } = useQuery({ queryKey: ["itineraries"], queryFn: listItineraries });
  const activeId = itinId || stored || trips[0]?.id;
  const [showRecovery, setShowRecovery] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(180);
  const [segmentId, setSegmentId] = useState("");

  const { data: itinerary, isLoading, error } = useQuery({
    queryKey: ["itinerary", activeId],
    queryFn: () => fetchItinerary(activeId!),
    enabled: Boolean(activeId),
  });

  const { data: recoveryData, isLoading: isLoadingRecovery, refetch: fetchPlans } = useQuery({
    queryKey: ["recovery", activeId],
    queryFn: () => getRecoveryPlans(activeId!),
    enabled: false,
  });

  const currentSegment = segmentId || itinerary?.segments[0]?.id || "";

  const disruptMutation = useMutation({
    mutationFn: () => disruptItinerary(activeId!, currentSegment, delayMinutes),
    onSuccess: (updatedItinerary) => {
      queryClient.setQueryData(["itinerary", activeId], updatedItinerary);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      setShowRecovery(true);
      fetchPlans();
    },
  });

  const applyPlanMutation = useMutation({
    mutationFn: (planId: string) => applyRecoveryPlan(activeId!, planId),
    onSuccess: (updatedItinerary) => {
      queryClient.setQueryData(["itinerary", activeId], updatedItinerary);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      setShowRecovery(false);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetItinerary(activeId!),
    onSuccess: (updatedItinerary) => {
      queryClient.setQueryData(["itinerary", activeId], updatedItinerary);
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      setShowRecovery(false);
    },
  });

  if (!activeId) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h1 className="text-2xl font-bold">Operations</h1>
          <p className="text-muted-foreground">Enter a trip on the dashboard first. The simulator runs against your data, not a hardcoded demo.</p>
          <Link className="text-primary underline" to="/">Go to dashboard</Link>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <div className="p-8 text-center">Loading trip {activeId}...</div>;
  if (error || !itinerary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>This trip was not found. Create one from the dashboard.</p>
          <Link className="text-primary underline" to="/">Back to dashboard</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-primary">Operations</p>
          <h1 className="text-3xl font-bold flex items-center gap-2 mt-1">
            <Zap className="text-primary" /> {itinerary.name}
          </h1>
          <p className="text-muted-foreground mt-1">{itinerary.traveler_name} · {itinerary.id}</p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="block mb-1 text-muted-foreground">Segment</span>
            <select className="h-10 rounded-md border border-input bg-background px-3 min-w-[180px]" value={currentSegment} onChange={(e) => setSegmentId(e.target.value)}>
              {itinerary.segments.map((segment) => (
                <option key={segment.id} value={segment.id}>{segment.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block mb-1 text-muted-foreground">Delay (min)</span>
            <input type="number" min={15} className="h-10 w-24 rounded-md border border-input bg-background px-3" value={delayMinutes} onChange={(e) => setDelayMinutes(Number(e.target.value) || 0)} />
          </label>
          <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${resetMutation.isPending ? "animate-spin" : ""}`} /> Reset
          </Button>
          <Button variant="destructive" onClick={() => disruptMutation.mutate()} disabled={disruptMutation.isPending || showRecovery}>
            <AlertTriangle className="w-4 h-4 mr-2" /> Inject delay
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Live dependency graph</h2>
          <DependencyGraph itinerary={itinerary} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Route map</h2>
          <TripMap key={`${itinerary.id}-${itinerary.segments.map((s) => s.status).join()}`} itinerary={itinerary} />
        </div>
      </div>

      <AnimatePresence>
        {showRecovery && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <AlertTriangle /> Disruption detected. Calculating blast radius...
            </div>
            {isLoadingRecovery ? (
              <div className="p-8 text-center animate-pulse bg-secondary/50 rounded-lg">Generating recovery plans...</div>
            ) : recoveryData ? (
              <div className="space-y-6">
                {recoveryData.explanation && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" /> AI resolution strategy
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{recoveryData.explanation.summary}</p>
                      <p className="text-sm text-muted-foreground mt-2">{recoveryData.explanation.reason}</p>
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recoveryData.plans.map((plan) => (
                    <Card key={plan.id} className={`flex flex-col ${plan.id === recoveryData.explanation?.recommended_plan_id ? "border-primary" : ""}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle>{plan.name}</CardTitle>
                          {plan.id === recoveryData.explanation?.recommended_plan_id && (
                            <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/50">Recommended</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col justify-between">
                        <div className="space-y-4 mb-6">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Cost impact</span>
                            <span className={plan.cost_change > 0 ? "text-destructive font-medium" : "text-green-500 font-medium"}>
                              {plan.cost_change > 0 ? "+" : ""}${plan.cost_change}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Delay added</span>
                            <span className="font-medium">{plan.time_change_minutes} min</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-medium text-primary">{plan.score.total}/100</span>
                          </div>
                        </div>
                        <Button className="w-full" variant={plan.id === recoveryData.explanation?.recommended_plan_id ? "default" : "outline"} onClick={() => applyPlanMutation.mutate(plan.id)} disabled={applyPlanMutation.isPending}>
                          {applyPlanMutation.isPending ? "Applying..." : "Apply plan"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
