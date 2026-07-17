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


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    office_id: Optional[int] = None
    is_active: Optional[bool] = None


def _serialize_user(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "role": u.role,
        "office_id": u.office_id,
        "is_active": u.is_active,
        "created_at": u.created_at,
    }


@router.post("/register")
def register(user_data: User, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Only BAC admins can register users
    if current_user.role != "bac_admin":
        raise HTTPException(status_code=403, detail="Access denied: Only BAC administrators can register users")

    existing_user = session.exec(
        select(User).where(User.username == user_data.username)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    existing_email = session.exec(
        select(User).where(User.email == user_data.email)
    ).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = get_password_hash(user_data.hashed_password)
    
    # Verify office exists if office_id provided
    if user_data.office_id:
        office = session.get(Office, user_data.office_id)
        if not office:
            raise HTTPException(status_code=400, detail="Office not found")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pwd,
        role=user_data.role,
        office_id=user_data.office_id,
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
        if payload.office_id is not None:
            office = session.get(Office, payload.office_id)
            if not office:
                raise HTTPException(status_code=400, detail="Office not found")
            target.office_id = payload.office_id
    else:
        # Budget / BAC accounts are not tied to a department office.
        target.office_id = None

    if payload.password:
        target.hashed_password = get_password_hash(payload.password)

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
