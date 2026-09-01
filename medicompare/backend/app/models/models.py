"""
ORM models.

users               -> login accounts (role = patient | caregiver)
patients            -> a patient profile. A "patient" user has exactly one
                        patient profile linked to their own account; a
                        "caregiver" user can own many patient profiles.
prescriptions       -> one uploaded/scanned prescription
prescription_medicines -> individual medicines detected on a prescription
medicines           -> the verified medicine catalogue
price_comparisons   -> a saved comparison result for a prescription medicine
savings_history     -> rollup of savings per prescription, for dashboards
"""
import datetime
import enum

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    patient = "patient"
    caregiver = "caregiver"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(160), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.patient)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patients = relationship("Patient", back_populates="owner", cascade="all, delete-orphan")


class Patient(Base):
    """A patient profile. Owned by a user (self, for patients; or a caregiver)."""
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(120), nullable=False)
    age = Column(Integer, nullable=True)
    relationship_label = Column(String(60), nullable=True)  # e.g. "Self", "Mother", "Father"
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="patients")
    prescriptions = relationship("Prescription", back_populates="patient", cascade="all, delete-orphan")


class Medicine(Base):
    """Verified / curated medicine catalogue entry."""
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    brand_name = Column(String(150), nullable=False, index=True)
    generic_name = Column(String(150), nullable=False)
    active_ingredient = Column(String(150), nullable=False, index=True)
    strength = Column(String(40), nullable=False)          # e.g. "40 mg"
    dosage_form = Column(String(40), nullable=False)        # e.g. "Tablet", "Capsule", "Syrup"
    manufacturer = Column(String(150), nullable=True)
    pack_size = Column(String(60), nullable=True)
    mrp = Column(Float, nullable=True)
    price = Column(Float, nullable=False)
    medicine_category = Column(String(100), nullable=True)  # e.g. "Antacid / PPI"
    common_uses = Column(Text, nullable=True)
    common_side_effects = Column(Text, nullable=True)
    warnings = Column(Text, nullable=True)
    generic_available = Column(Boolean, default=False)
    jan_aushadhi_available = Column(Boolean, default=False)
    jan_aushadhi_price = Column(Float, nullable=True)
    source = Column(String(120), default="Demo / reference price")
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    original_filename = Column(String(255), nullable=True)
    stored_filename = Column(String(255), nullable=True)
    status = Column(String(30), default="processing")  # processing | needs_review | verified
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("Patient", back_populates="prescriptions")
    medicines = relationship(
        "PrescriptionMedicine", back_populates="prescription", cascade="all, delete-orphan"
    )
    savings_record = relationship(
        "SavingsHistory", back_populates="prescription", uselist=False, cascade="all, delete-orphan"
    )


class PrescriptionMedicine(Base):
    """A single medicine line extracted (or manually added) from a prescription."""
    __tablename__ = "prescription_medicines"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    matched_medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=True)

    medicine_name = Column(String(150), nullable=False)
    salt = Column(String(150), nullable=True)
    strength = Column(String(40), nullable=True)
    dosage = Column(String(150), nullable=True)
    duration = Column(String(60), nullable=True)

    confidence = Column(Float, default=1.0)
    is_verified = Column(Boolean, default=False)
    added_manually = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    prescription = relationship("Prescription", back_populates="medicines")
    matched_medicine = relationship("Medicine")


class PriceComparison(Base):
    """A saved comparison snapshot for one prescription medicine."""
    __tablename__ = "price_comparisons"

    id = Column(Integer, primary_key=True, index=True)
    prescription_medicine_id = Column(Integer, ForeignKey("prescription_medicines.id"), nullable=False)
    prescribed_price = Column(Float, nullable=True)
    lowest_generic_price = Column(Float, nullable=True)
    lowest_jan_aushadhi_price = Column(Float, nullable=True)
    potential_saving = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    prescription_medicine = relationship("PrescriptionMedicine")


class SavingsHistory(Base):
    """Rollup of savings for an entire prescription (used on dashboards/history)."""
    __tablename__ = "savings_history"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False, unique=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    original_estimated_cost = Column(Float, default=0.0)
    lowest_compared_cost = Column(Float, default=0.0)
    potential_saving = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    prescription = relationship("Prescription", back_populates="savings_record")
