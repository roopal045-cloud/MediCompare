from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Patient
from app.schemas.schemas import PatientCreate, PatientOut
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=List[PatientOut])
def list_patients(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Patient).filter(Patient.owner_id == user.id).order_by(Patient.created_at.desc()).all()


@router.post("", response_model=PatientOut, status_code=201)
def create_patient(
    payload: PatientCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    if user.role.value == "patient":
        existing_count = db.query(Patient).filter(Patient.owner_id == user.id).count()
        if existing_count >= 1:
            raise HTTPException(
                status_code=400,
                detail="Patient accounts manage a single profile. Register as a caregiver to manage multiple patients.",
            )

    patient = Patient(owner_id=user.id, **payload.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def get_owned_patient_or_404(patient_id: int, db: Session, user: User) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.owner_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return patient


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_owned_patient_or_404(patient_id, db, user)
