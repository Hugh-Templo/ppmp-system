from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, UniqueConstraint


class Office(SQLModel, table=True):
    """
    Represents one of the 40+ departments/offices in Ormoc City Hall.

    Soft-delete via ``is_active=False`` so PPMPs, signatory data, and the
    per-office NGPA_PPMP.xlsx folder under templates/end-users/ are retained.
    Recreating an office with the same code reactivates this row.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    code: str = Field(unique=True)  # e.g., "O-HOPE", "O-BUDGET", "O-BAC", "O-CHO"
    budget_allocation: float = Field(default=0.0)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Signatory fields — mirrored into the office's NGPA_PPMP.xlsx footer on save.
    submitted_by: Optional[str] = Field(default=None)
    submitted_by_designation: Optional[str] = Field(default=None)
    prepared_by: Optional[str] = Field(default=None)
    prepared_by_designation: Optional[str] = Field(default=None)
    aip_reference: Optional[str] = Field(default=None)
    responsibility_center_no: Optional[str] = Field(default=None)
    office_code_from_pr: Optional[str] = Field(default=None)
    # Relative path (from repo root) to this office's generated NGPA_PPMP.xlsx copy.
    ppmp_template_path: Optional[str] = Field(default=None)

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
    # Plaintext copy set when BAC admin creates/resets the password (for admin display only).
    # Login still verifies against hashed_password. Existing users are blank until reset.
    plain_password: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    role: str = Field(default="end_user")  # "end_user", "budget_office", "bac_admin"
    office_id: Optional[int] = Field(default=None, foreign_key="office.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    office: Optional[Office] = Relationship(back_populates="users")


class PPMP(SQLModel, table=True):
    """
    Base Project Procurement Management Plan model.
    Status: Draft -> Pending Budget Review -> Approved | Returned
    Posting (after Budget validates): Draft -> Posted (to BAC) ; Unpost -> Returned
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    fiscal_year: int = Field(index=True)
    office_id: int = Field(foreign_key="office.id")
    status: str = Field(default="Draft")  # "Draft", "Pending Budget Review", "Approved", "Returned"
    type: str = Field(default="Indicative")  # "Indicative" or "Final"
    # PPMP-level CSE flag chosen at creation; items default to this but can override.
    is_cse: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    remarks: Optional[str] = Field(default=None)  # Remarks from budget office when returning/unposting for revision
    # BAC handoff after Budget validates (Approved + Posted = eligible for consolidation)
    posting_status: str = Field(default="Draft")  # "Draft", "Posted"
    posted_at: Optional[datetime] = Field(default=None)
    posted_by: Optional[int] = Field(default=None)  # User ID of budget office staff

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

    Supplemental revisions (end user adds items after approval) are tracked as
    additional rows with version >= 2 for the same (office_id, fiscal_year).
    """
    __tablename__ = "final_ppmp"
    __table_args__ = (
        UniqueConstraint("office_id", "fiscal_year", "version", name="uq_final_ppmp_office_fy_version"),
    )

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
    submitted_at: Optional[datetime] = Field(default=None)  # When end user submitted the Final PPMP
    approved_at: Optional[datetime] = Field(default=None)
    approved_by: Optional[int] = Field(default=None)  # User ID of HoPE or designated official
    verification_notes: Optional[str] = Field(default=None)  # Notes from verification process
    remarks: Optional[str] = Field(default=None)  # Revision notes (future return flow)
    version: int = Field(default=1)  # 1 = Original Final PPMP; 2+ = Supplemental revisions


class PPMPItem(SQLModel, table=True):
    """
    Detailed line items inside a PPMP.
    NGPA_PPMP.xlsx columns 1-12 are the canonical source of fields.
    Legacy fields (category, quantity, unit_of_measure, unit_cost, q1..q4_qty) remain
    nullable for backward compatibility.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    ppmp_id: Optional[int] = Field(default=None, foreign_key="ppmp.id")
    indicative_ppmp_id: Optional[int] = Field(default=None, foreign_key="indicative_ppmp.id")
    sheet_row_id: Optional[int] = Field(default=None)

    # NGPA_PPMP.xlsx Column 1
    description: str

    # NGPA_PPMP.xlsx Column 2 (Goods / Infrastructure / Consulting Services / General Support Services)
    project_type: Optional[str] = Field(default=None)

    # NGPA_PPMP.xlsx Column 3 (free text: quantity/size by lot, item, or package)
    quantity_size: Optional[str] = Field(default=None)

    # Flag: CSE (PS-DBM) vs non-CSE — determined by originating Sheet tab
    is_cse: bool = Field(default=False)

    # NGPA_PPMP.xlsx Column 4
    procurement_mode: str = Field(default="Competitive Bidding")

    # NGPA_PPMP.xlsx Column 5 (Yes/No)
    pre_proc_conf: Optional[bool] = Field(default=False)

    # NGPA_PPMP.xlsx Columns 6, 7 (MM/YYYY)
    proc_start: Optional[str] = Field(default=None)
    proc_end: Optional[str] = Field(default=None)

    # NGPA_PPMP.xlsx Column 8 (MM/YYYY or "as needed")
    delivery_period: Optional[str] = Field(default=None)

    # NGPA_PPMP.xlsx Column 9
    fund_source: Optional[str] = Field(default=None)

    # NGPA_PPMP.xlsx Column 10 (Approved Budget for the Contract / Estimated Budget in PhP)
    estimated_budget: float = Field(default=0.0)

    # NGPA_PPMP.xlsx Column 11
    supporting_docs: Optional[str] = Field(default=None)

    # NGPA_PPMP.xlsx Column 12
    remarks: Optional[str] = Field(default=None)

    # Legacy (kept nullable for backward compatibility)
    category: Optional[str] = Field(default=None)
    quantity: Optional[int] = Field(default=None)
    unit_of_measure: Optional[str] = Field(default=None)
    unit_cost: Optional[float] = Field(default=None)
    q1_qty: int = Field(default=0)
    q2_qty: int = Field(default=0)
    q3_qty: int = Field(default=0)
    q4_qty: int = Field(default=0)

    # Relationships
    ppmp: Optional[PPMP] = Relationship(back_populates="items")


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
    Columns align with NGPA_CSE-APP / NGPA_nonCSE-APP output layout.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    app_id: int = Field(foreign_key="app.id")

    description: str
    is_cse: bool = Field(default=False)

    # NGPA aggregation dimensions
    project_type: Optional[str] = Field(default=None)
    procurement_mode: str
    fund_source: Optional[str] = Field(default=None)
    quantity_size: Optional[str] = Field(default=None)
    proc_start: Optional[str] = Field(default=None)
    proc_end: Optional[str] = Field(default=None)
    delivery_period: Optional[str] = Field(default=None)
    pre_proc_conf: Optional[bool] = Field(default=False)

    # Consolidated amounts
    total_estimated_budget: float
    end_user_offices: Optional[str] = Field(default=None)  # comma-separated list

    # Legacy (kept nullable)
    category: Optional[str] = Field(default=None)
    total_quantity: Optional[int] = Field(default=None)
    unit_of_measure: Optional[str] = Field(default=None)
    unit_cost: Optional[float] = Field(default=None)
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


class CseCatalogItem(SQLModel, table=True):
    """
    PS-DBM Common-Use Supplies and Equipment (CSE) catalogue row.
    Sourced from templates/APP-CSE 2027 Form .xlsx — used by the end-user
    item description combobox to classify entries as CSE vs nonCSE.
    """
    __tablename__ = "cse_catalog_item"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(default="", index=True)
    description: str = Field(index=True)
    unit_of_measure: str = Field(default="piece")
    category: str = Field(default="Common-Use Supplies and Equipment", index=True)
    is_cse: bool = Field(default=True)
    source: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AppSignatory(SQLModel, table=True):
    """
    Agency-wide signatory block for CSE and nonCSE APP exports/previews.
    Singleton row (id=1) edited by bac_admin.
    """
    __tablename__ = "app_signatory"

    id: Optional[int] = Field(default=None, primary_key=True)
    prepared_by: Optional[str] = Field(default=None)
    prepared_by_designation: Optional[str] = Field(default=None)
    recommended_by: Optional[str] = Field(default=None)
    recommended_by_designation: Optional[str] = Field(default=None)
    approved_by_name: Optional[str] = Field(default=None)
    approved_by_designation: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
