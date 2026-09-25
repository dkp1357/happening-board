from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.common import EventCategory, SeverityLevel

class EventBase(BaseModel):
    title: str
    summary: str
    category: EventCategory = EventCategory.OTHER
    severity: SeverityLevel = SeverityLevel.INFO
    latitude: float
    longitude: float
    location_name: Optional[str] = None
    country_code: Optional[str] = None
    source_url: str
    source_domain: Optional[str] = None
    actor1: Optional[str] = None
    actor2: Optional[str] = None
    key_actors: List[str] = Field(default_factory=list)
    goldstein_scale: Optional[float] = None
    avg_tone: Optional[float] = None
    event_timestamp: str
    
class EventCreate(EventBase):
    global_event_id: Optional[str] = None
    ai_processed: bool = False

class EventResponse(EventBase):
    id: str
    global_event_id: Optional[str] = None
    ai_processed: bool = False
    created_at: str
    
class EventListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    events: List[EventResponse]
    

# GeoJSON RFC 7946 Specification Models
class GeoJSONGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]

class GeoJSONProperties(BaseModel):
    id: str
    title: str
    summary: str
    category: str
    severity: int
    location_name: Optional[str]
    country_code: Optional[str]
    source_url: str
    source_domain: Optional[str]
    key_actors: List[str]
    event_timestamp: str
    ai_processed: bool

class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: GeoJSONProperties

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]
    

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
    categories: List[CategoryStat]
    severity_distribution: List[SeverityStat]
    top_hotspots: List[CountryStat]
    latest_event_time: Optional[str] = None
