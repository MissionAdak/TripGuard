export type RiskState = "SAFE" | "AT_RISK" | "HIGH_RISK" | "DISRUPTED" | "RECOVERED";
export type SegmentType = "FLIGHT" | "TRAIN" | "TRANSFER" | "HOTEL" | "ACTIVITY";

export type Segment = {
  id: string;
  itinerary_id: string;
  type: SegmentType;
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  location_start?: string | null;
  location_end?: string | null;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  cost: number;
  status: RiskState;
};

export type Dependency = {
  id: string;
  source_id: string;
  target_id: string;
};

export type Itinerary = {
  id: string;
  user_id: string;
  traveler_name: string;
  name: string;
  segments: Segment[];
  dependencies: Dependency[];
};

export type ItinerarySummary = {
  id: string;
  name: string;
  traveler_name: string;
  segment_count: number;
  status: RiskState;
  locations: string[];
  start_time?: string | null;
  end_time?: string | null;
};

export type RecoveryResponse = {
  plans: {
    id: string;
    name: string;
    description: string;
    cost_change: number;
    time_change_minutes: number;
    score: { total: number };
  }[];
  explanation?: {
    recommended_plan_id: string;
    summary: string;
    reason: string;
  } | null;
};

export type SegmentDraft = {
  type: SegmentType;
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  location_start: string;
  location_end: string;
  cost: string;
};
