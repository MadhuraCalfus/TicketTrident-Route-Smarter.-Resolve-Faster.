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
    WORRIED = "worried"
    POSITIVE = "positive"


class TicketStatus(str, Enum):
    NEW = "New"
    ROUTED = "Routed"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"


class TicketClassification(BaseModel):
    """Schema Claude must fill in exactly — enforced via output_config.format."""

    category: Category
    priority: Priority
    team: Team
    tone: Tone
    confidence: float = Field(ge=0, le=1, description="0-1 confidence in this classification")
    is_ambiguous: bool = Field(description="True if the ticket could reasonably fit more than one category")
    reasoning: str = Field(description="One-line explanation of the routing decision")


class ResolutionSuggestion(BaseModel):
    """Schema the model must fill in for the customer-facing self-service
    suggestion shown before a ticket is ever created — a different shape
    from TicketClassification since this isn't a routing decision."""

    can_likely_self_resolve: bool
    summary: str = Field(description="One short sentence naming the likely underlying issue")
    steps: list[str] = Field(max_length=6, description="Concrete steps the customer can try themselves")


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
    id: int
    user_id: Optional[int] = None
    message: str
    status: TicketStatus = TicketStatus.NEW
    # Unset until an Admin routes the ticket (status moves New -> Routed).
    category: Optional[Category] = None
    priority: Optional[Priority] = None
    team: Optional[Team] = None
    tone: Optional[Tone] = None
    confidence: Optional[float] = None
    is_ambiguous: Optional[bool] = None
    escalated: Optional[bool] = None
    reasoning: Optional[str] = None
    model_used: Optional[str] = None
    mode: Optional[str] = None  # "live" | "mock" | "repaired" | "fallback"
    latency_ms: Optional[int] = None
    manual_time_seconds: Optional[float] = None
    created_at: str
    baseline: Optional[BaselineResult] = None
    model_results: Optional[list[ModelResult]] = None
    corrected_category: Optional[Category] = None
    corrected_priority: Optional[Priority] = None
    corrected_team: Optional[Team] = None
    feedback_note: Optional[str] = None


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=6, max_length=200)


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    role: str  # "user" | "team" | "admin"
    name: str
    team: Optional[Team] = None


class TeamMemberCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=6, max_length=200)
    team: Team


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=200)


class NewTicketRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class TicketStatusUpdateRequest(BaseModel):
    status: TicketStatus


class TicketCommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class AdminAssignRequest(BaseModel):
    """What an Admin finalizes a routed ticket with — defaults to whatever
    the AI suggested, but the admin can change any of the three before
    confirming, which is what actually determines which team gets it."""

    category: Category
    priority: Priority
    team: Team


class FeedbackRequest(BaseModel):
    agree: bool = Field(description="True if a human reviewed this and confirmed the AI got it right")
    corrected_category: Optional[Category] = None
    corrected_priority: Optional[Priority] = None
    corrected_team: Optional[Team] = None
    note: Optional[str] = Field(default=None, max_length=500)


class DemoRunRequest(BaseModel):
    tickets: list[str] = Field(min_length=1, max_length=100)
