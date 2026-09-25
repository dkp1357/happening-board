
from pydantic import BaseModel, Field

from app.models.common import EventCategory, SeverityLevel


class EventBase(BaseModel):
    title: str
    summary: str
    category: EventCategory = EventCategory.OTHER
    severity: SeverityLevel = SeverityLevel.INFO
    latitude: float
    longitude: float
    location_name: str | None = None
    country_code: str | None = None
    source_url: str
    source_domain: str | None = None
    actor1: str | None = None
    actor2: str | None = None
    key_actors: list[str] = Field(default_factory=list)
    goldstein_scale: float | None = None
    avg_tone: float | None = None
    event_timestamp: str
    
class EventCreate(EventBase):
    global_event_id: str | None = None
    ai_processed: bool = False

class EventResponse(EventBase):
    id: str
    global_event_id: str | None = None
    ai_processed: bool = False
    created_at: str
    
class EventListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    events: list[EventResponse]
    

# GeoJSON RFC 7946 Specification Models
class GeoJSONGeometry(BaseModel):
    type: str = "Point"
    coordinates: list[float]  # [longitude, latitude]

class GeoJSONProperties(BaseModel):
    id: str
    title: str
    summary: str
    category: str
    severity: int
    location_name: str | None
    country_code: str | None
    source_url: str
    source_domain: str | None
    key_actors: list[str]
    event_timestamp: str
    ai_processed: bool

class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: GeoJSONProperties

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[GeoJSONFeature]
    

# Analytics & Statistics Models
class CategoryStat(BaseModel):
    category: str
    count: int

class SeverityStat(BaseModel):
    severity: int
    count: int

class CountryStat(BaseModel):
    country_code: str
    count: int

class DashboardStats(BaseModel):
    total_events: int
    ai_processed_events: int
    categories: list[CategoryStat]
    severity_distribution: list[SeverityStat]
    top_hotspots: list[CountryStat]
    latest_event_time: str | None = None
