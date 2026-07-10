from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Category(str, Enum):
    BILLING = "Billing"
    TECHNICAL_ISSUE = "Technical Issue"
    ACCOUNT_ACCESS = "Account Access"
    BUG_REPORT = "Bug Report"
    FEATURE_REQUEST = "Feature Request"
    COMPLAINT = "Complaint"
    SECURITY_CONCERN = "Security Concern"
    GENERAL_INQUIRY = "General Inquiry"


class Priority(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Team(str, Enum):
    BILLING_SUPPORT = "Billing Support"
    TECHNICAL_SUPPORT = "Technical Support"
    ENGINEERING = "Engineering"
    ACCOUNT_MANAGEMENT = "Account Management"
    PRODUCT_TEAM = "Product Team"
    SECURITY_TEAM = "Security Team"
    CUSTOMER_SUCCESS = "Customer Success"
    TRIAGE = "Triage"


class Tone(str, Enum):
    NEUTRAL = "neutral"
    FRUSTRATED = "frustrated"
    ANGRY = "angry"
    URGENT = "urgent"
    CONFUSED = "confused"
    POSITIVE = "positive"


class TicketClassification(BaseModel):
    """Schema Claude must fill in exactly — enforced via output_config.format."""

    category: Category
    priority: Priority
    team: Team
    tone: Tone
    confidence: float = Field(ge=0, le=1, description="0-1 confidence in this classification")
    is_ambiguous: bool = Field(description="True if the ticket could reasonably fit more than one category")
    reasoning: str = Field(description="One-line explanation of the routing decision")


class RouteRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    manual_time_seconds: Optional[float] = Field(default=None, description="Real measured time a human took to triage this ticket, if available")
    compare: bool = Field(default=False, description="Also run the naive keyword baseline for side-by-side comparison")


class BaselineResult(BaseModel):
    category: Category
    priority: Priority
    team: Team
    reasoning: str


class ModelResult(BaseModel):
    """One provider's answer for a ticket, used when multiple live providers
    are configured and compare=True — shown side by side in the UI."""

    provider: str
    model_used: str
    mode: str
    latency_ms: int
    category: Category
    priority: Priority
    team: Team
    tone: Tone
    confidence: float
    is_ambiguous: bool
    reasoning: str


class TicketResult(BaseModel):
    id: str
    message: str
    category: Category
    priority: Priority
    team: Team
    tone: Tone
    confidence: float
    is_ambiguous: bool
    escalated: bool
    reasoning: str
    model_used: str
    mode: str  # "live" | "mock" | "repaired" | "fallback"
    latency_ms: int
    manual_time_seconds: Optional[float] = None
    created_at: str
    baseline: Optional[BaselineResult] = None
    model_results: Optional[list[ModelResult]] = None
    corrected_category: Optional[Category] = None
    corrected_priority: Optional[Priority] = None
    corrected_team: Optional[Team] = None
    feedback_note: Optional[str] = None


class FeedbackRequest(BaseModel):
    agree: bool = Field(description="True if a human reviewed this and confirmed the AI got it right")
    corrected_category: Optional[Category] = None
    corrected_priority: Optional[Priority] = None
    corrected_team: Optional[Team] = None
    note: Optional[str] = Field(default=None, max_length=500)


class DemoRunRequest(BaseModel):
    tickets: list[str] = Field(min_length=1, max_length=100)
