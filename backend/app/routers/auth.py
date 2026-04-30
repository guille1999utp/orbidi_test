from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import GoogleAuthIn, TokenOut, UserPublic
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=TokenOut)
def google_login(body: GoogleAuthIn, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth no configurado (GOOGLE_CLIENT_ID)",
        )
    try:
        info = google_id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de Google inválido")

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google no devolvió email")

    name = info.get("name") or email.split("@")[0]
    picture = info.get("picture")

    user = db.scalars(select(User).where(User.email == email)).first()
    if user:
        user.name = name
        user.avatar_url = picture
    else:
        user = User(email=email, name=name, avatar_url=picture)
        db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenOut(
        access_token=token,
        user=UserPublic.model_validate(user),
    )
