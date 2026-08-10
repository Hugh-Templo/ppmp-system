from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import User, Office
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    check_role,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class UserCreate(BaseModel):
    username: str
    email: str
    hashed_password: str
    role: str = "end_user"
    office_id: Optional[int] = None
    office_name: Optional[str] = None
    office_code: Optional[str] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    office_id: Optional[int] = None
    office_name: Optional[str] = None
    office_code: Optional[str] = None
    is_active: Optional[bool] = None


class AdminPasswordPayload(BaseModel):
    password: str


def _serialize_user(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "role": u.role,
        "office_id": u.office_id,
        "is_active": u.is_active,
        "created_at": u.created_at,
        "has_password": bool(u.plain_password),
    }


def _resolve_or_create_office(
    session: Session,
    office_id: Optional[int] = None,
    office_name: Optional[str] = None,
    office_code: Optional[str] = None,
) -> Optional[Office]:
    if office_id is not None:
        office = session.get(Office, office_id)
        if not office:
            raise HTTPException(status_code=400, detail="Office not found")
        return office

    normalized_name = (office_name or "").strip()
    normalized_code = (office_code or "").strip().upper()
    if not normalized_name and not normalized_code:
        return None
    if not normalized_name or not normalized_code:
        raise HTTPException(
            status_code=400,
            detail="Office name and code are required for end-user accounts",
        )

    existing_by_code = session.exec(
        select(Office).where(Office.code == normalized_code)
    ).first()
    if existing_by_code:
        if normalized_name and existing_by_code.name != normalized_name:
            existing_by_code.name = normalized_name
            session.add(existing_by_code)
        return existing_by_code

    existing_by_name = session.exec(
        select(Office).where(Office.name == normalized_name)
    ).first()
    if existing_by_name:
        if normalized_code and existing_by_name.code != normalized_code:
            existing_by_name.code = normalized_code
            session.add(existing_by_name)
        return existing_by_name

    office = Office(
        name=normalized_name,
        code=normalized_code,
        budget_allocation=0.0,
        is_active=True,
    )
    session.add(office)
    session.flush()
    return office


@router.post("/register")
def register(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Only BAC admins can register users
    if current_user.role != "bac_admin":
        raise HTTPException(status_code=403, detail="Access denied: Only BAC administrators can register users")

    username = user_data.username.strip()
    email = user_data.email.strip()
    role = (user_data.role or "end_user").strip().lower()
    if role not in ("end_user", "budget_office", "bac_admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    existing_user = session.exec(select(User).where(User.username == username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    existing_email = session.exec(select(User).where(User.email == email)).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = get_password_hash(user_data.hashed_password)
    plain_pwd = (user_data.hashed_password or "").strip() or None

    office_id = None
    if role == "end_user":
        office = _resolve_or_create_office(
            session,
            office_id=user_data.office_id,
            office_name=user_data.office_name,
            office_code=user_data.office_code,
        )
        if office is not None:
            office_id = office.id
    elif user_data.office_id is not None:
        office = session.get(Office, user_data.office_id)
        if not office:
            raise HTTPException(status_code=400, detail="Office not found")

    new_user = User(
        username=username,
        email=email,
        hashed_password=hashed_pwd,
        plain_password=plain_pwd,
        role=role,
        office_id=office_id,
        is_active=True,
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return {"message": "User created successfully", "username": new_user.username}


@router.get("/users")
def list_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    users = session.exec(select(User).order_by(User.username)).all()
    return [_serialize_user(u) for u in users]


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Update a registered user (BAC admin CRUD)."""
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.username is not None and payload.username != target.username:
        clash = session.exec(
            select(User).where(User.username == payload.username)
        ).first()
        if clash:
            raise HTTPException(status_code=400, detail="Username already registered")
        target.username = payload.username.strip()

    if payload.email is not None and payload.email != target.email:
        clash = session.exec(select(User).where(User.email == payload.email)).first()
        if clash:
            raise HTTPException(status_code=400, detail="Email already registered")
        target.email = payload.email.strip()

    if payload.role is not None:
        if payload.role not in ("end_user", "budget_office", "bac_admin"):
            raise HTTPException(status_code=400, detail="Invalid role")
        target.role = payload.role

    effective_role = target.role
    if effective_role == "end_user":
        if payload.office_id is not None or payload.office_name is not None or payload.office_code is not None:
            office = _resolve_or_create_office(
                session,
                office_id=payload.office_id,
                office_name=payload.office_name,
                office_code=payload.office_code,
            )
            if office is not None:
                target.office_id = office.id
    else:
        # Budget / BAC accounts are not tied to a department office.
        target.office_id = None

    if payload.password:
        target.hashed_password = get_password_hash(payload.password)
        target.plain_password = payload.password.strip() or None

    if payload.is_active is not None:
        if target.id == current_user.id and payload.is_active is False:
            raise HTTPException(
                status_code=400,
                detail="You cannot deactivate your own account",
            )
        target.is_active = payload.is_active

    session.add(target)
    session.commit()
    session.refresh(target)
    return {"message": "User updated successfully", "user": _serialize_user(target)}


@router.post("/users/{user_id}/reveal-password")
def reveal_user_password(
    user_id: int,
    payload: AdminPasswordPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Reveal an end-user or budget office saved password after verifying the bacadmin password."""
    admin_pwd = (payload.password or "").strip()
    if not admin_pwd:
        raise HTTPException(status_code=400, detail="Administrator password is required")
    if not verify_password(admin_pwd, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect administrator password")

    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role not in ("end_user", "budget_office"):
        raise HTTPException(
            status_code=400,
            detail="Only end-user and budget office passwords can be revealed",
        )
    if not target.plain_password:
        raise HTTPException(
            status_code=400,
            detail=(
                "No viewable password is stored for this account yet. "
                "Edit the user and set their password once so it can be shown."
            ),
        )

    return {
        "user_id": target.id,
        "username": target.username,
        "password": target.plain_password,
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_role(["bac_admin"])),
):
    """Delete a user account only. Office PPMPs and local template files are
    never removed — a new user assigned to the same office can view them."""
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account",
        )

    office_id = target.office_id
    session.delete(target)
    session.commit()
    return {
        "message": (
            "User account deleted. Office PPMP records and local template files "
            "were kept in the system."
        ),
        "user_id": user_id,
        "office_id": office_id,
        "ppmps_retained": True,
    }


@router.post("/token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.username == form_data.username)
    ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "office_id": current_user.office_id,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
    }
