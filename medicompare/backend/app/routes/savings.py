from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Patient, SavingsHistory
from app.schemas.schemas import SavingsHistoryOut
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/savings-history", tags=["savings"])


@router.get("", response_model=List[SavingsHistoryOut])
def list_savings_history(
    patient_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = (
        db.query(SavingsHistory)
        .join(Patient, SavingsHistory.patient_id == Patient.id)
        .filter(Patient.owner_id == user.id)
    )
    if patient_id:
        query = query.filter(SavingsHistory.patient_id == patient_id)
    return query.order_by(SavingsHistory.created_at.desc()).all()
