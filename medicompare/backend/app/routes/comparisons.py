from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Patient, Prescription, PrescriptionMedicine, PriceComparison, SavingsHistory
from app.schemas.schemas import ComparisonRequest, ComparisonResult
from app.utils.security import get_current_user
from app.services.comparison import build_comparison

router = APIRouter(prefix="/api/comparisons", tags=["comparisons"])


@router.post("", response_model=ComparisonResult)
def create_comparison(
    payload: ComparisonRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    pm = (
        db.query(PrescriptionMedicine)
        .join(Prescription, PrescriptionMedicine.prescription_id == Prescription.id)
        .join(Patient, Prescription.patient_id == Patient.id)
        .filter(PrescriptionMedicine.id == payload.prescription_medicine_id, Patient.owner_id == user.id)
        .first()
    )
    if not pm:
        raise HTTPException(status_code=404, detail="Prescription medicine not found.")

    result = build_comparison(db, pm)

    if result["match_status"] == "matched":
        record = PriceComparison(
            prescription_medicine_id=pm.id,
            prescribed_price=result["prescribed_price"],
            lowest_generic_price=result["lowest_generic_price"],
            lowest_jan_aushadhi_price=result["lowest_jan_aushadhi_price"],
            potential_saving=result["potential_saving"],
        )
        db.add(record)
        db.commit()
        _update_savings_rollup(db, pm.prescription_id)

    return result


def _update_savings_rollup(db: Session, prescription_id: int):
    """Recompute the prescription-level savings rollup from every medicine's
    latest comparison, so the dashboard/history always reflects reality."""
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        return

    total_original = 0.0
    total_lowest = 0.0
    for pm in prescription.medicines:
        latest = (
            db.query(PriceComparison)
            .filter(PriceComparison.prescription_medicine_id == pm.id)
            .order_by(PriceComparison.created_at.desc())
            .first()
        )
        if latest and latest.prescribed_price is not None:
            total_original += latest.prescribed_price
            candidates = [p for p in [latest.lowest_generic_price, latest.lowest_jan_aushadhi_price] if p is not None]
            total_lowest += min(candidates) if candidates else latest.prescribed_price

    rollup = db.query(SavingsHistory).filter(SavingsHistory.prescription_id == prescription_id).first()
    if rollup is None:
        rollup = SavingsHistory(prescription_id=prescription_id, patient_id=prescription.patient_id)
        db.add(rollup)

    rollup.original_estimated_cost = round(total_original, 2)
    rollup.lowest_compared_cost = round(total_lowest, 2)
    rollup.potential_saving = round(max(0.0, total_original - total_lowest), 2)
    db.commit()
