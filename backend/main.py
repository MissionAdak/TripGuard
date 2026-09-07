from copy import deepcopy
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from engine.graph import propagate_disruption
from engine.recovery import apply_plan, generate_recovery_plans
from geocode import geocode_location
from models import (
    Dependency,
    DependencyType,
    DisruptionEvent,
    GeocodeResult,
    Itinerary,
    ItineraryCreate,
    ItinerarySummary,
    RecoveryResponse,
    RiskState,
    Segment,
)

app = FastAPI(title="TRIPGUARD API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_itineraries: dict[str, Itinerary] = {}
original_itineraries: dict[str, Itinerary] = {}
last_delay_minutes: dict[str, int] = {}


def _attach_coords(segment: Segment) -> Segment:
    if segment.location_start and (segment.start_lat is None or segment.start_lng is None):
        coords = geocode_location(segment.location_start)
        if coords:
            segment.start_lat, segment.start_lng = coords
    if segment.location_end and (segment.end_lat is None or segment.end_lng is None):
        coords = geocode_location(segment.location_end)
        if coords:
            segment.end_lat, segment.end_lng = coords
    if segment.end_lat is None and segment.start_lat is not None:
        segment.end_lat, segment.end_lng = segment.start_lat, segment.start_lng
    return segment


def _summary(itinerary: Itinerary) -> ItinerarySummary:
    statuses = [s.status for s in itinerary.segments]
    worst = RiskState.SAFE
    rank = {
        RiskState.SAFE: 0,
        RiskState.RECOVERED: 1,
        RiskState.AT_RISK: 2,
        RiskState.HIGH_RISK: 3,
        RiskState.DISRUPTED: 4,
    }
    for status in statuses:
        if rank[status] > rank[worst]:
            worst = status
    locations: list[str] = []
    for segment in itinerary.segments:
        for loc in (segment.location_start, segment.location_end):
            if loc and loc not in locations:
                locations.append(loc)
    starts = [s.start_time for s in itinerary.segments]
    ends = [s.end_time for s in itinerary.segments]
    return ItinerarySummary(
        id=itinerary.id,
        name=itinerary.name,
        traveler_name=itinerary.traveler_name,
        segment_count=len(itinerary.segments),
        status=worst,
        locations=locations,
        start_time=min(starts) if starts else None,
        end_time=max(ends) if ends else None,
    )


def _build_itinerary(payload: ItineraryCreate, itin_id: str | None = None) -> Itinerary:
    if not payload.segments:
        raise HTTPException(status_code=400, detail="Add at least one trip segment")

    itin_id = itin_id or f"ITIN-{uuid4().hex[:6].upper()}"
    ordered = sorted(payload.segments, key=lambda s: s.start_time)
    segments: list[Segment] = []
    for index, item in enumerate(ordered, start=1):
        segment = Segment(
            id=f"{itin_id}-seg-{index}",
            itinerary_id=itin_id,
            type=item.type,
            name=item.name,
            description=item.description,
            start_time=item.start_time,
            end_time=item.end_time,
            location_start=item.location_start,
            location_end=item.location_end,
            cost=item.cost,
        )
        segments.append(_attach_coords(segment))

    dependencies: list[Dependency] = []
    for index in range(len(segments) - 1):
        gap = int((segments[index + 1].start_time - segments[index].end_time).total_seconds() // 60)
        buffer = max(0, gap)
        dependencies.append(
            Dependency(
                id=f"{itin_id}-dep-{index + 1}",
                source_id=segments[index].id,
                target_id=segments[index + 1].id,
                type=DependencyType.SEQUENTIAL,
                buffer_minutes=buffer,
                max_tolerated_delay_minutes=max(60, buffer + 30),
            )
        )

    return Itinerary(
        id=itin_id,
        user_id=payload.user_id,
        traveler_name=payload.traveler_name,
        name=payload.name,
        segments=segments,
        dependencies=dependencies,
    )


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/itineraries", response_model=list[ItinerarySummary])
def list_itineraries():
    return [_summary(item) for item in active_itineraries.values()]


@app.post("/api/itineraries", response_model=Itinerary)
def create_itinerary(payload: ItineraryCreate):
    itinerary = _build_itinerary(payload)
    active_itineraries[itinerary.id] = itinerary
    original_itineraries[itinerary.id] = deepcopy(itinerary)
    return itinerary


@app.get("/api/itinerary/{itin_id}", response_model=Itinerary)
def get_itinerary(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return active_itineraries[itin_id]


@app.put("/api/itinerary/{itin_id}", response_model=Itinerary)
def update_itinerary(itin_id: str, payload: ItineraryCreate):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    itinerary = _build_itinerary(payload, itin_id=itin_id)
    existing = active_itineraries[itin_id]
    itinerary.user_id = existing.user_id
    active_itineraries[itin_id] = itinerary
    original_itineraries[itin_id] = deepcopy(itinerary)
    last_delay_minutes.pop(itin_id, None)
    return itinerary


@app.delete("/api/itinerary/{itin_id}")
def delete_itinerary(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    del active_itineraries[itin_id]
    original_itineraries.pop(itin_id, None)
    last_delay_minutes.pop(itin_id, None)
    return {"ok": True}


@app.post("/api/itinerary/{itin_id}/disrupt", response_model=Itinerary)
def disrupt_itinerary(itin_id: str, event: DisruptionEvent):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    itinerary = deepcopy(original_itineraries.get(itin_id, active_itineraries[itin_id]))
    updated = propagate_disruption(itinerary, event.segment_id, event.delay_minutes)
    active_itineraries[itin_id] = updated
    last_delay_minutes[itin_id] = event.delay_minutes
    return updated


@app.get("/api/itinerary/{itin_id}/recover", response_model=RecoveryResponse)
def get_recovery_plans(itin_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    delay = last_delay_minutes.get(itin_id, 180)
    return generate_recovery_plans(active_itineraries[itin_id], delay)


@app.post("/api/itinerary/{itin_id}/apply-plan/{plan_id}", response_model=Itinerary)
def apply_recovery_plan(itin_id: str, plan_id: str):
    if itin_id not in active_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    delay = last_delay_minutes.get(itin_id, 180)
    response = generate_recovery_plans(active_itineraries[itin_id], delay)
    selected = next((plan for plan in response.plans if plan.id == plan_id), None)
    if not selected:
        raise HTTPException(status_code=404, detail="Plan not found")
    updated = apply_plan(active_itineraries[itin_id], selected)
    for segment in updated.segments:
        _attach_coords(segment)
    active_itineraries[itin_id] = updated
    return updated


@app.post("/api/itinerary/{itin_id}/reset", response_model=Itinerary)
def reset_itinerary(itin_id: str):
    if itin_id not in original_itineraries:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    restored = deepcopy(original_itineraries[itin_id])
    active_itineraries[itin_id] = restored
    last_delay_minutes.pop(itin_id, None)
    return restored


@app.get("/api/geocode", response_model=GeocodeResult)
def geocode(q: str = Query(..., min_length=1)):
    coords = geocode_location(q)
    if not coords:
        return GeocodeResult(query=q)
    return GeocodeResult(query=q, lat=coords[0], lng=coords[1])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
