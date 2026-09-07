from datetime import timedelta
from typing import List, Dict
from models import Itinerary, Dependency, RiskState

def propagate_disruption(itinerary: Itinerary, disrupted_segment_id: str, delay_minutes: int) -> Itinerary:
    """
    Deterministically calculates downstream impact of a disruption.
    """
    # Create lookup dicts
    segments = {s.id: s for s in itinerary.segments}
    
    if disrupted_segment_id not in segments:
        return itinerary
        
    disrupted_seg = segments[disrupted_segment_id]
    disrupted_seg.status = RiskState.DISRUPTED
    disrupted_seg.end_time = disrupted_seg.end_time + timedelta(minutes=delay_minutes)
    disrupted_seg.start_time = disrupted_seg.start_time + timedelta(minutes=delay_minutes)
    
    # Build graph adj list
    adj: Dict[str, List[Dependency]] = {s.id: [] for s in itinerary.segments}
    for dep in itinerary.dependencies:
        adj[dep.source_id].append(dep)
        
    # BFS to propagate delays
    queue = [(disrupted_segment_id, delay_minutes)]
    visited = set([disrupted_segment_id])
    
    while queue:
        curr_id, curr_delay = queue.pop(0)
        
        for dep in adj[curr_id]:
            target_id = dep.target_id
            target_seg = segments[target_id]
            
            # If the current delay exceeds the buffer, it impacts the target
            impact_delay = curr_delay - dep.buffer_minutes
            
            if impact_delay > 0:
                if impact_delay > dep.max_tolerated_delay_minutes:
                    target_seg.status = RiskState.DISRUPTED
                else:
                    target_seg.status = RiskState.AT_RISK
                target_seg.start_time = target_seg.start_time + timedelta(minutes=impact_delay)
                target_seg.end_time = target_seg.end_time + timedelta(minutes=impact_delay)

                if target_id not in visited:
                    visited.add(target_id)
                    queue.append((target_id, impact_delay))
                    
    # Update itinerary segments
    itinerary.segments = list(segments.values())
    return itinerary
