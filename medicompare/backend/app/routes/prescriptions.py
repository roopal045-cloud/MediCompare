from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Patient, Prescription, PrescriptionMedicine
from app.schemas.schemas import (
    PrescriptionOut, PrescriptionMedicineOut, PrescriptionMedicineUpdate,
    PrescriptionMedicineCreate,
)
from app.utils.security import get_current_user
from app.utils.files import validate_upload, save_upload, sanitize_filename
from app.ai.service import ai_service
from app.services.matching import find_best_catalogue_match
from app.routes.patients import get_owned_patient_or_404

router = APIRouter(prefix="/api/prescriptions", tags=["prescriptions"])


def _run_extraction_and_populate(db: Session, prescription: Prescription, content: bytes, mime_type: str, force_demo: bool):
    medicines, used_demo, provider_used = ai_service.extract_prescription(
        content, mime_type, force_demo=force_demo
    )

    # Clear any previous extraction (e.g. on retry/re-analyze)
    for existing in list(prescription.medicines):
        db.delete(existing)
    db.flush()

    for item in medicines:
        matched = find_best_catalogue_match(db, item["medicine_name"], item.get("strength", ""))
        pm = PrescriptionMedicine(
            prescription_id=prescription.id,
            matched_medicine_id=matched.id if matched else None,
            medicine_name=item["medicine_name"],
            salt=item.get("salt"),
            strength=item.get("strength"),
            dosage=item.get("dosage"),
            duration=item.get("duration"),
            confidence=item.get("confidence", 0.5),
            is_verified=False,
            added_manually=False,
        )
        db.add(pm)

    prescription.is_demo = used_demo
    prescription.status = "needs_review"
    db.commit()
    db.refresh(prescription)
    return provider_used


@router.post("/upload", response_model=PrescriptionOut, status_code=201)
async def upload_prescription(
    patient_id: int = Form(...),
    file: Optional[UploadFile] = File(None),
    use_demo: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = get_owned_patient_or_404(patient_id, db, user)

    prescription = Prescription(patient_id=patient.id, status="processing")

    content = b""
    mime_type = "image/jpeg"
    original_filename = None

    if use_demo or file is None:
        # Demo mode: no real file required.
        prescription.is_demo = True
        original_filename = "demo_prescription.jpg"
    else:
        content = await file.read()
        validate_upload(file, len(content))
        stored_name = save_upload(file, content)
        prescription.stored_filename = stored_name
        original_filename = sanitize_filename(file.filename)
        mime_type = file.content_type or "image/jpeg"

    prescription.original_filename = original_filename
    db.add(prescription)
    db.commit()
    db.refresh(prescription)

    try:
        _run_extraction_and_populate(db, prescription, content, mime_type, force_demo=use_demo or file is None)
    except Exception as exc:  # noqa: BLE001
        # Never leave the user on a blank screen — surface a clean error.
        prescription.status = "error"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Prescription analysis failed: {exc}")

    return prescription


@router.post("/analyze", response_model=PrescriptionOut)
def reanalyze_prescription(
    prescription_id: int = Form(...),
    use_demo: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    prescription = _get_owned_prescription_or_404(prescription_id, db, user)
    try:
        _run_extraction_and_populate(db, prescription, b"", "image/jpeg", force_demo=True if prescription.is_demo else use_demo)
    except Exception as exc:  # noqa: BLE001
        prescription.status = "error"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Re-analysis failed: {exc}")
    return prescription


def _get_owned_prescription_or_404(prescription_id: int, db: Session, user: User) -> Prescription:
    prescription = (
        db.query(Prescription)
        .join(Patient, Prescription.patient_id == Patient.id)
        .filter(Prescription.id == prescription_id, Patient.owner_id == user.id)
        .first()
    )
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return prescription


@router.get("", response_model=List[PrescriptionOut])
def list_prescriptions(
    patient_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = (
        db.query(Prescription)
        .join(Patient, Prescription.patient_id == Patient.id)
        .filter(Patient.owner_id == user.id)
    )
    if patient_id:
        query = query.filter(Prescription.patient_id == patient_id)
    return query.order_by(Prescription.created_at.desc()).all()


@router.get("/{prescription_id}", response_model=PrescriptionOut)
def get_prescription(prescription_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_owned_prescription_or_404(prescription_id, db, user)


@router.put("/{prescription_id}/medicines/{medicine_id}", response_model=PrescriptionMedicineOut)
def update_prescription_medicine(
    prescription_id: int,
    medicine_id: int,
    payload: PrescriptionMedicineUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    prescription = _get_owned_prescription_or_404(prescription_id, db, user)
    pm = next((m for m in prescription.medicines if m.id == medicine_id), None)
    if not pm:
        raise HTTPException(status_code=404, detail="Medicine line not found on this prescription.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pm, field, value)

    # A human correction always re-anchors the catalogue match and is
    # treated as fully verified — it overrides the AI's guess.
    pm.matched_medicine_id = (
        find_best_catalogue_match(db, pm.medicine_name, pm.strength or "").id
        if find_best_catalogue_match(db, pm.medicine_name, pm.strength or "")
        else pm.matched_medicine_id
    )
    pm.is_verified = True
    pm.confidence = 1.0
    db.commit()
    db.refresh(pm)
    return pm


@router.post("/{prescription_id}/medicines", response_model=PrescriptionMedicineOut, status_code=201)
def add_prescription_medicine(
    prescription_id: int,
    payload: PrescriptionMedicineCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    prescription = _get_owned_prescription_or_404(prescription_id, db, user)
    matched = find_best_catalogue_match(db, payload.medicine_name, payload.strength or "")
    pm = PrescriptionMedicine(
        prescription_id=prescription.id,
        matched_medicine_id=matched.id if matched else None,
        medicine_name=payload.medicine_name,
        salt=payload.salt,
        strength=payload.strength,
        dosage=payload.dosage,
        duration=payload.duration,
        confidence=1.0,
        is_verified=True,
        added_manually=True,
    )
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return pm


@router.post("/{prescription_id}/verify", response_model=PrescriptionOut)
def verify_prescription(prescription_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    prescription = _get_owned_prescription_or_404(prescription_id, db, user)
    prescription.status = "verified"
    db.commit()
    db.refresh(prescription)
    return prescription
