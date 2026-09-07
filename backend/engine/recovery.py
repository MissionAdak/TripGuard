from copy import deepcopy
from datetime import timedelta
from models import AIExplanation, Itinerary, RecoveryPlan, RecoveryResponse, PlanScore, RiskState, Segment


def _shift(segment: Segment, minutes: int) -> Segment:
    updated = segment.model_copy(deep=True)
    updated.start_time = updated.start_time + timedelta(minutes=minutes)
    updated.end_time = updated.end_time + timedelta(minutes=minutes)
    return updated


def generate_recovery_plans(itinerary: Itinerary, delay_minutes: int) -> RecoveryResponse:
    disrupted = next((s for s in itinerary.segments if s.status == RiskState.DISRUPTED), None)
    if not disrupted and itinerary.segments:
        disrupted = itinerary.segments[0]
    if not disrupted:
        return RecoveryResponse(plans=[], explanation=None)

    cheap = _shift(disrupted, delay_minutes + 60)
    cheap.id = f"{disrupted.id}-alt-cheap"
    cheap.name = f"Later option: {disrupted.name}"
    cheap.cost = round(max(0.0, disrupted.cost * 0.65), 2)
    cheap.status = RiskState.RECOVERED
    cheap.description = "Lower-cost later departure"

    fast = _shift(disrupted, max(30, delay_minutes // 3))
    fast.id = f"{disrupted.id}-alt-fast"
    fast.name = f"Priority rebook: {disrupted.name}"
    fast.cost = round(disrupted.cost * 1.8, 2)
    fast.status = RiskState.RECOVERED
    fast.description = "Faster paid rebooking"

    balanced = _shift(disrupted, delay_minutes)
    balanced.id = f"{disrupted.id}-alt-balanced"
    balanced.name = f"Next available: {disrupted.name}"
    balanced.cost = disrupted.cost
    balanced.status = RiskState.RECOVERED
    balanced.description = "Keep the same service, push the clock"

    plans = [
        RecoveryPlan(
            id="plan-cheapest",
            name="Cheapest",
            description=f"Take a later lower-cost option for {disrupted.name}.",
            added_segments=[cheap],
            removed_segment_ids=[disrupted.id],
            score=PlanScore(cost=90, time=40, itinerary_preservation=50, convenience=40, traveler_preference=55, total=58),
            cost_change=round(cheap.cost - disrupted.cost, 2),
            time_change_minutes=delay_minutes + 60,
            affected_activities_ids=[],
        ),
        RecoveryPlan(
            id="plan-fastest",
            name="Fastest",
            description=f"Pay more to recover {disrupted.name} quickly.",
            added_segments=[fast],
            removed_segment_ids=[disrupted.id],
            score=PlanScore(cost=25, time=92, itinerary_preservation=80, convenience=78, traveler_preference=70, total=68),
            cost_change=round(fast.cost - disrupted.cost, 2),
            time_change_minutes=max(30, delay_minutes // 3),
            affected_activities_ids=[],
        ),
        RecoveryPlan(
            id="plan-balanced",
            name="Balanced (Recommended)",
            description=f"Keep {disrupted.name} and shift downstream by {delay_minutes} minutes.",
            added_segments=[balanced],
            removed_segment_ids=[disrupted.id],
            score=PlanScore(cost=80, time=70, itinerary_preservation=88, convenience=75, traveler_preference=82, total=81),
            cost_change=0.0,
            time_change_minutes=delay_minutes,
            affected_activities_ids=[],
        ),
    ]

    explanation = AIExplanation(
        recommended_plan_id="plan-balanced",
        summary="The balanced plan keeps your booked service and only shifts the schedule.",
        reason=f"{disrupted.name} is the disruption source. Replacing it with the next available option avoids extra fare while giving later legs a realistic clock.",
        actions=[
            f"Replace {disrupted.name}",
            f"Shift connected legs by {delay_minutes} minutes",
            "Recheck hotel and activity timing",
        ],
    )
    return RecoveryResponse(plans=plans, explanation=explanation)


def apply_plan(itinerary: Itinerary, plan: RecoveryPlan) -> Itinerary:
    updated = deepcopy(itinerary)
    replacements = {rid: plan.added_segments[0] for rid in plan.removed_segment_ids if plan.added_segments}

    updated.segments = [s for s in updated.segments if s.id not in plan.removed_segment_ids]
    for added in plan.added_segments:
        added.itinerary_id = itinerary.id
        updated.segments.append(added)

    for dep in updated.dependencies:
        if dep.source_id in replacements:
            dep.source_id = replacements[dep.source_id].id
        if dep.target_id in replacements:
            dep.target_id = replacements[dep.target_id].id

    shift = plan.time_change_minutes
    replaced_ids = {s.id for s in plan.added_segments}
    for segment in updated.segments:
        if segment.id not in replaced_ids and segment.status in {RiskState.AT_RISK, RiskState.DISRUPTED, RiskState.HIGH_RISK}:
            segment.start_time += timedelta(minutes=shift)
            segment.end_time += timedelta(minutes=shift)
            segment.status = RiskState.RECOVERED

    return updated
