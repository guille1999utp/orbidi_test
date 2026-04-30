from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import UserBrief

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserBrief])
def list_users(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.execute(select(User).order_by(User.name)).scalars().all()
    return [UserBrief.model_validate(u) for u in rows]
