from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import Medicine
from app.schemas.schemas import MedicineOut
from app.services.matching import find_same_composition

router = APIRouter(prefix="/api/medicines", tags=["medicines"])


@router.get("/search", response_model=List[MedicineOut])
def search_medicines(
    q: Optional[str] = Query(None, description="Brand name, salt, or category"),
    max_price: Optional[float] = Query(None),
    generic_only: bool = Query(False),
    jan_aushadhi_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    query = db.query(Medicine)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Medicine.brand_name.ilike(like),
                Medicine.active_ingredient.ilike(like),
                Medicine.generic_name.ilike(like),
                Medicine.medicine_category.ilike(like),
            )
        )
    if max_price is not None:
        query = query.filter(Medicine.price <= max_price)
    if generic_only:
        query = query.filter(Medicine.generic_available.is_(True))
    if jan_aushadhi_only:
        query = query.filter(Medicine.jan_aushadhi_available.is_(True))

    return query.order_by(Medicine.brand_name).limit(100).all()


@router.get("/{medicine_id}", response_model=MedicineOut)
def get_medicine(medicine_id: int, db: Session = Depends(get_db)):
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    return medicine


@router.get("/{medicine_id}/alternatives", response_model=List[MedicineOut])
def get_alternatives(medicine_id: int, db: Session = Depends(get_db)):
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    return find_same_composition(db, medicine)
