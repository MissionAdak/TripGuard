from typing import List
from datetime import datetime, timedelta
from models import Itinerary, Segment, Dependency, SegmentType, RiskState, DependencyType, RecoveryPlan, PlanScore

def get_base_time():
    # Use a fixed date for deterministic demo
    return datetime(2026, 10, 15, 8, 0)

def get_mock_itinerary() -> Itinerary:
    base = get_base_time()
    
    seg1 = Segment(
        id="seg-1",
        itinerary_id="ITIN-100",
        type=SegmentType.FLIGHT,
        name="Flight Mumbai → Delhi",
        description="Air India AI-101",
        start_time=base,
        end_time=base + timedelta(hours=2),
        location_start="Mumbai (BOM)",
        location_end="Delhi (DEL)",
        cost=150.0
    )
    
    seg2 = Segment(
        id="seg-2",
        itinerary_id="ITIN-100",
        type=SegmentType.TRANSFER,
        name="Airport Transfer",
        description="Private Cab to Hotel",
        start_time=base + timedelta(hours=2, minutes=30),
        end_time=base + timedelta(hours=3, minutes=30),
        location_start="Delhi (DEL)",
        location_end="Taj Palace, Delhi",
        cost=30.0
    )
    
    seg3 = Segment(
        id="seg-3",
        itinerary_id="ITIN-100",
        type=SegmentType.HOTEL,
        name="Hotel Check-in",
        description="Taj Palace, Delhi",
        start_time=base + timedelta(hours=3, minutes=30),
        end_time=base + timedelta(days=1, hours=10),
        location_start="Taj Palace, Delhi",
        location_end="Taj Palace, Delhi",
        cost=200.0
    )
    
    seg4 = Segment(
        id="seg-4",
        itinerary_id="ITIN-100",
        type=SegmentType.ACTIVITY,
        name="Dinner Reservation",
        description="Bukhara, ITC Maurya",
        start_time=base + timedelta(hours=11), # 7 PM
        end_time=base + timedelta(hours=13),
        location_start="ITC Maurya",
        location_end="ITC Maurya",
        cost=100.0
    )
    
    seg5 = Segment(
        id="seg-5",
        itinerary_id="ITIN-100",
        type=SegmentType.TRAIN,
        name="Train Delhi → Jaipur",
        description="Shatabdi Express",
        start_time=base + timedelta(days=1, hours=11),
        end_time=base + timedelta(days=1, hours=16),
        location_start="New Delhi Railway Station",
        location_end="Jaipur Junction",
        cost=25.0
    )

    dep1 = Dependency(id="dep-1", source_id="seg-1", target_id="seg-2", buffer_minutes=30, max_tolerated_delay_minutes=60)
    dep2 = Dependency(id="dep-2", source_id="seg-2", target_id="seg-3", buffer_minutes=0, max_tolerated_delay_minutes=120)
    dep3 = Dependency(id="dep-3", source_id="seg-3", target_id="seg-4", buffer_minutes=120, max_tolerated_delay_minutes=240)
    dep4 = Dependency(id="dep-4", source_id="seg-3", target_id="seg-5", buffer_minutes=0, max_tolerated_delay_minutes=1440)

    return Itinerary(
        id="ITIN-100",
        name="Golden Triangle Tour",
        segments=[seg1, seg2, seg3, seg4, seg5],
        dependencies=[dep1, dep2, dep3, dep4]
    )

def get_mock_recovery_plans() -> List[RecoveryPlan]:
    base = get_base_time()
    # Mock alternatives for a 3-hour flight delay
    
    # Cheapest: take a later budget flight, skip dinner
    plan_a = RecoveryPlan(
        id="plan-a-cheapest",
        name="Cheapest",
        description="Rebook on later budget airline. Skip dinner reservation to save costs.",
        added_segments=[
            Segment(
                id="seg-1-alt-a", itinerary_id="ITIN-100", type=SegmentType.FLIGHT,
                name="Indigo BOM → DEL", start_time=base + timedelta(hours=4), end_time=base + timedelta(hours=6),
                cost=80.0
            )
        ],
        removed_segment_ids=["seg-1", "seg-4"],
        score=PlanScore(cost=90, time=40, itinerary_preservation=50, convenience=40, traveler_preference=50, total=60),
        cost_change=-70.0,
        time_change_minutes=240,
        affected_activities_ids=["seg-4"]
    )
    
    # Fastest: Same airline, premium class rebooking
    plan_b = RecoveryPlan(
        id="plan-b-fastest",
        name="Fastest",
        description="Rebook immediately on Vistara Premium Economy.",
        added_segments=[
            Segment(
                id="seg-1-alt-b", itinerary_id="ITIN-100", type=SegmentType.FLIGHT,
                name="Vistara BOM → DEL", start_time=base + timedelta(hours=1), end_time=base + timedelta(hours=3),
                cost=300.0
            )
        ],
        removed_segment_ids=["seg-1"],
        score=PlanScore(cost=20, time=95, itinerary_preservation=90, convenience=80, traveler_preference=70, total=65),
        cost_change=150.0,
        time_change_minutes=60,
        affected_activities_ids=[]
    )
    
    # Balanced: Next available Air India, push transfer and dinner
    plan_c = RecoveryPlan(
        id="plan-c-balanced",
        name="Balanced (Recommended)",
        description="Rebook on next Air India flight. Push transfer and dinner by 2 hours.",
        added_segments=[
            Segment(
                id="seg-1-alt-c", itinerary_id="ITIN-100", type=SegmentType.FLIGHT,
                name="Air India BOM → DEL", start_time=base + timedelta(hours=3), end_time=base + timedelta(hours=5),
                cost=150.0 # free rebooking
            ),
             Segment(
                id="seg-2-alt-c", itinerary_id="ITIN-100", type=SegmentType.TRANSFER,
                name="Airport Transfer (Rescheduled)", start_time=base + timedelta(hours=5, minutes=30), end_time=base + timedelta(hours=6, minutes=30),
                cost=30.0
            )
        ],
        removed_segment_ids=["seg-1", "seg-2"],
        score=PlanScore(cost=85, time=70, itinerary_preservation=85, convenience=75, traveler_preference=80, total=79),
        cost_change=0.0,
        time_change_minutes=180,
        affected_activities_ids=["seg-4"]
    )
    
    return [plan_a, plan_b, plan_c]
