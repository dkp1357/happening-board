from enum import Enum


class EventCategory(str, Enum):
    MILITARY_CONFLICT = "military_conflict"
    CIVIL_UNREST = "civil_unrest"
    TERROR_SECURITY = "terror_security"
    DIPLOMACY = "diplomacy"
    HUMANITARIAN = "humanitarian"
    INFRASTRUCTURE_CYBER = "infrastructure_cyber"
    OTHER = "other"
    

class SeverityLevel(int, Enum):
    INFO = 1       # Routine diplomatic or minor report
    LOW = 2        # Minor protest, localized dispute
    MEDIUM = 3     # Significant clash, border alert, notable unrest
    HIGH = 4       # Military strike, major casualties, key offensive
    CRITICAL = 5   # Major invasion, strategic infrastructure destruction, WMD / mass casualty
    
    
# Helper to map GDELT CAMEO event root code to EventCategory and default SeverityLevel
def cameo_to_category_and_severity(cameo_code: str, quad_class: int = 4) -> tuple[EventCategory, SeverityLevel]:
    code = cameo_code.strip()
    root = code[:2] if len(code) >= 2 else code

    if root in ("19", "fight", "190", "191", "192", "193", "194", "195"):
        return EventCategory.MILITARY_CONFLICT, SeverityLevel.HIGH
    elif root in ("20", "200", "201", "202", "203"):
        return EventCategory.MILITARY_CONFLICT, SeverityLevel.CRITICAL
    elif root in ("18", "180", "181", "182", "183"):
        return EventCategory.TERROR_SECURITY, SeverityLevel.MEDIUM
    elif root in ("14", "140", "141", "142", "143", "144", "145"):
        return EventCategory.CIVIL_UNREST, SeverityLevel.LOW
    elif root in ("15", "16", "17"):
        return EventCategory.MILITARY_CONFLICT, SeverityLevel.MEDIUM
    elif root in ("01", "02", "03", "04", "05"):
        return EventCategory.DIPLOMACY, SeverityLevel.INFO
    elif root in ("06", "07", "08"):
        return EventCategory.HUMANITARIAN, SeverityLevel.LOW

    # QuadClass fallback
    if quad_class == 4: # Material Conflict
        return EventCategory.MILITARY_CONFLICT, SeverityLevel.MEDIUM
    elif quad_class == 3: # Verbal Conflict
        return EventCategory.DIPLOMACY, SeverityLevel.LOW
    elif quad_class == 2: # Material Cooperation
        return EventCategory.HUMANITARIAN, SeverityLevel.INFO
    else:
        return EventCategory.OTHER, SeverityLevel.INFO