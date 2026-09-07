from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel

class RiskState(str, Enum):
    SAFE = "SAFE"
    AT_RISK = "AT_RISK"
    HIGH_RISK = "HIGH_RISK"
    DISRUPTED = "DISRUPTED"
    RECOVERED = "RECOVERED"

class SegmentType(str, Enum):
    FLIGHT = "FLIGHT"
    TRAIN = "TRAIN"
    TRANSFER = "TRANSFER"
    HOTEL = "HOTEL"
    ACTIVITY = "ACTIVITY"

class Segment(BaseModel):
    id: str
    itinerary_id: str
    type: SegmentType
    name: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location_start: Optional[str] = None
    location_end: Optional[str] = None
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    cost: float = 0.0
    status: RiskState = RiskState.SAFE
    is_locked: bool = False

class DependencyType(str, Enum):
    SEQUENTIAL = "SEQUENTIAL"      # A must finish before B starts
    LOCATION_SYNC = "LOCATION_SYNC" # B requires A to end at the same location B starts

class Dependency(BaseModel):
    id: str
    source_id: str
    target_id: str
    type: DependencyType = DependencyType.SEQUENTIAL
    buffer_minutes: int = 60 # Required buffer between segments
    max_tolerated_delay_minutes: int = 120 # Maximum delay on source before target is disrupted

class Itinerary(BaseModel):
    id: str
    user_id: str = "guest"
    traveler_name: str = "Guest traveler"
    name: str
    segments: List[Segment]
    dependencies: List[Dependency]


class SegmentInput(BaseModel):
    type: SegmentType
    name: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location_start: Optional[str] = None
    location_end: Optional[str] = None
    cost: float = 0.0


class ItineraryCreate(BaseModel):
    name: str
    traveler_name: str = "Guest traveler"
    user_id: str = "guest"
    segments: List[SegmentInput]


class ItinerarySummary(BaseModel):
    id: str
    name: str
    traveler_name: str
    segment_count: int
    status: RiskState
    locations: List[str]
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class GeocodeResult(BaseModel):
    query: str
    lat: Optional[float] = None
    lng: Optional[float] = None

class DisruptionEvent(BaseModel):
    segment_id: str
    delay_minutes: int
    reason: str

class PlanScore(BaseModel):
    cost: float
    time: float
    itinerary_preservation: float
    convenience: float
    traveler_preference: float
    total: float

class RecoveryPlan(BaseModel):
    id: str
    name: str # e.g., "Cheapest", "Fastest", "Balanced"
    description: str
    added_segments: List[Segment]
    removed_segment_ids: List[str]
    score: PlanScore
    cost_change: float
    time_change_minutes: int
    affected_activities_ids: List[str]

class AIExplanation(BaseModel):
    recommended_plan_id: str
    summary: str
    reason: str
    actions: List[str]

class RecoveryResponse(BaseModel):
    plans: List[RecoveryPlan]
    explanation: Optional[AIExplanation] = None
