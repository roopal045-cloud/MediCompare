"""
Pydantic v2 schemas used across the API.
"""
import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- Auth / Users ----------

class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)
    role: str = Field(pattern="^(patient|caregiver)$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Patients ----------

class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    age: Optional[int] = None
    relationship_label: Optional[str] = "Self"
    notes: Optional[str] = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    age: Optional[int]
    relationship_label: Optional[str]
    notes: Optional[str]
    created_at: datetime.datetime


# ---------- Medicines ----------

class MedicineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    brand_name: str
    generic_name: str
    active_ingredient: str
    strength: str
    dosage_form: str
    manufacturer: Optional[str]
    pack_size: Optional[str]
    mrp: Optional[float]
    price: float
    medicine_category: Optional[str]
    common_uses: Optional[str]
    common_side_effects: Optional[str]
    warnings: Optional[str]
    generic_available: bool
    jan_aushadhi_available: bool
    jan_aushadhi_price: Optional[float]
    source: str


# ---------- Prescription medicines ----------

class PrescriptionMedicineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    medicine_name: str
    salt: Optional[str]
    strength: Optional[str]
    dosage: Optional[str]
    duration: Optional[str]
    confidence: float
    is_verified: bool
    added_manually: bool
    matched_medicine_id: Optional[int]


class PrescriptionMedicineUpdate(BaseModel):
    medicine_name: Optional[str] = None
    salt: Optional[str] = None
    strength: Optional[str] = None
    dosage: Optional[str] = None
    duration: Optional[str] = None


class PrescriptionMedicineCreate(BaseModel):
    medicine_name: str
    salt: Optional[str] = None
    strength: Optional[str] = None
    dosage: Optional[str] = None
    duration: Optional[str] = None


class PrescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    status: str
    is_demo: bool
    original_filename: Optional[str]
    created_at: datetime.datetime
    medicines: List[PrescriptionMedicineOut] = []


# ---------- Comparisons ----------

class ComparisonOption(BaseModel):
    type: str  # "Prescribed" | "Generic" | "Jan Aushadhi"
    medicine_id: Optional[int]
    brand: str
    salt: str
    strength: str
    manufacturer: Optional[str]
    pack_size: Optional[str]
    price: float
    source: str


class ComparisonResult(BaseModel):
    prescription_medicine_id: int
    prescribed_name: str
    match_status: str  # "matched" | "unmatched"
    options: List[ComparisonOption]
    prescribed_price: Optional[float]
    lowest_generic_price: Optional[float]
    lowest_jan_aushadhi_price: Optional[float]
    potential_saving: float


class ComparisonRequest(BaseModel):
    prescription_medicine_id: int


# ---------- Savings history ----------

class SavingsHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    prescription_id: int
    patient_id: int
    original_estimated_cost: float
    lowest_compared_cost: float
    potential_saving: float
    created_at: datetime.datetime
