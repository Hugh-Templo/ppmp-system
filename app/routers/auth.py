from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
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
    users = session.exec(select(User)).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "office_id": u.office_id,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


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
