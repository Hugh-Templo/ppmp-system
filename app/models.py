from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship


class Office(SQLModel, table=True):
    """
    Represents one of the 40+ departments/offices in Ormoc City Hall.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    code: str = Field(unique=True)  # e.g., "O-HOPE", "O-BUDGET", "O-BAC", "O-CHO"
    budget_allocation: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    users: List["User"] = Relationship(back_populates="office")
    ppmps: List["PPMP"] = Relationship(back_populates="office")


class User(SQLModel, table=True):
    """
    User model with role-based access control.
    Roles: "end_user", "budget_office", "bac_admin"
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    role: str = Field(default="end_user")  # "end_user", "budget_office", "bac_admin"
    office_id: Optional[int] = Field(default=None, foreign_key="office.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    office: Optional[Office] = Relationship(back_populates="users")


class PPMP(SQLModel, table=True):
    """
    Base Project Procurement Management Plan model.
    Status transitions: Draft -> Pending Budget Review -> Approved -> Returned
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    fiscal_year: int = Field(index=True)
    office_id: int = Field(foreign_key="office.id")
    status: str = Field(default="Draft")  # "Draft", "Pending Budget Review", "Approved", "Returned"
    type: str = Field(default="Indicative")  # "Indicative" or "Final"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    remarks: Optional[str] = Field(default=None)  # Remarks from budget office when returning for revision

    # Relationships
    office: Office = Relationship(back_populates="ppmps")
    items: List["PPMPItem"] = Relationship(back_populates="ppmp")


class IndicativePPMP(SQLModel, table=True):
    """
    Indicative PPMP for RA 12009 compliance.
    Status transitions: Draft -> Posted -> Approved/Rejected
    """
    __tablename__ = "indicative_ppmp"
    
    # Base PPMP fields (copied from PPMP)
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    fiscal_year: int = Field(index=True)
    office_id: int = Field(foreign_key="office.id")
    status: str = Field(default="Draft")  # "Draft", "Pending Budget Review", "Approved", "Returned"
    type: str = Field(default="Indicative")  # "Indicative" or "Final"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # RA 12009 specific fields
    posting_status: str = Field(default="Draft")  # "Draft", "Posted", "Approved", "Rejected"
    posted_at: Optional[datetime] = Field(default=None)
    posted_by: Optional[int] = Field(default=None)  # User ID of budget office staff
    market_scoping_docs: Optional[str] = Field(default=None)  # URL or reference to market scoping documentation
    life_cycle_costing: Optional[float] = Field(default=0.0)  # Additional life-cycle costs
    rejection_remarks: Optional[str] = Field(default=None)  # Remarks for rejected PPMPs
    rejected_at: Optional[datetime] = Field(default=None)
    rejected_by: Optional[int] = Field(default=None)  # User ID of BAC admin who rejected
    approved_at: Optional[datetime] = Field(default=None)
    approved_by: Optional[int] = Field(default=None)  # User ID of BAC admin who approved
    remarks: Optional[str] = Field(default=None)  # Budget office feedback
    spreadsheet_id: Optional[str] = Field(default=None, index=True)  # Google Sheet ID for sync


class FinalPPMP(SQLModel, table=True):
    """
    Final PPMP for RA 12009 compliance.
    Status transitions: Draft -> Submitted -> Approved/Rejected
    """
    __tablename__ = "final_ppmp"
    
    # Base PPMP fields (copied from PPMP)
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    fiscal_year: int = Field(index=True)
    office_id: int = Field(foreign_key="office.id")
    status: str = Field(default="Draft")  # "Draft", "Pending Budget Review", "Approved", "Returned"
    type: str = Field(default="Final")  # "Indicative" or "Final"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # RA 12009 specific fields
    approval_status: str = Field(default="Draft")  # "Draft", "Submitted", "Approved", "Rejected"
    approved_at: Optional[datetime] = Field(default=None)
    approved_by: Optional[int] = Field(default=None)  # User ID of HoPE or designated official
    verification_notes: Optional[str] = Field(default=None)  # Notes from verification process


class PPMPItem(SQLModel, table=True):
    """
    Detailed line items inside a PPMP.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    ppmp_id: Optional[int] = Field(default=None, foreign_key="ppmp.id")
    indicative_ppmp_id: Optional[int] = Field(default=None, foreign_key="indicative_ppmp.id")
    sheet_row_id: Optional[int] = Field(default=None)  # row_id from Google Sheet for upsert
    description: str
    category: str  # e.g., "Office Supplies", "IT Equipment", "Catering"
    is_cse: bool = Field(default=False)  # Common-Use Supplies and Equipment (CSE) via PS-DBM
    quantity: int = Field(default=1)
    unit_of_measure: str  # e.g., "pc", "box", "ream"
    unit_cost: float = Field(default=0.0)
    estimated_budget: float = Field(default=0.0)  # quantity * unit_cost
    procurement_mode: str = Field(default="Competitive Bidding")  # e.g., "Shopping", "SVP", "Direct Contracting"
    
    # Milestone Schedule (Quarterly distribution of quantities/budget)
    q1_qty: int = Field(default=0)
    q2_qty: int = Field(default=0)
    q3_qty: int = Field(default=0)
    q4_qty: int = Field(default=0)

    # Relationships
    ppmp: PPMP = Relationship(back_populates="items")


class APP(SQLModel, table=True):
    """
    Consolidated Annual Procurement Plan.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    fiscal_year: int = Field(index=True, unique=True)
    status: str = Field(default="Draft")  # "Draft", "Approved"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = Field(default=None)

    # Relationships
    rows: List["APPRow"] = Relationship(back_populates="app")


class APPRow(SQLModel, table=True):
    """
    Consolidated row in the APP combining similar PPMPItems.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    app_id: int = Field(foreign_key="app.id")
    description: str
    category: str
    is_cse: bool = Field(default=False)
    total_quantity: int
    unit_of_measure: str
    unit_cost: float
    total_estimated_budget: float
    procurement_mode: str
    
    # Combined milestones
    q1_qty: int = Field(default=0)
    q2_qty: int = Field(default=0)
    q3_qty: int = Field(default=0)
    q4_qty: int = Field(default=0)

    # Relationships
    app: APP = Relationship(back_populates="rows")


# Legacy tables for background pipeline compatibility
class ProcessedRow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_file: str
    row_data: str
    imported_at: datetime = Field(default_factory=datetime.utcnow)


class DBMClassification(SQLModel, table=True):
    """
    DBM Classification codes for PS-DBM compliance.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True)  # e.g., "101", "202", "303"
    project_title: str
    classification: str  # e.g., "Common-Use Supplies and Equipment (CSE)", "Specialized Equipment"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SyncLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ran_at: datetime = Field(default_factory=datetime.utcnow)
    success: bool
    files_processed: int = 0
    message: Optional[str] = None
