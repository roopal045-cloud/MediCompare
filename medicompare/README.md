# MediCompare

**Understand your prescription. Compare verified medicine options. See potential savings — without changing your doctor's prescription.**

A hackathon MVP for a healthcare platform that helps patients and caregivers read a doctor's prescription, verify what was extracted, and compare the prescribed medicine against same-composition generic and Jan Aushadhi alternatives — with clear, honest pricing.

---

## 1. Project overview

MediCompare turns a photo of a prescription into a plain-language, price-comparable breakdown of every medicine on it. A patient (or someone caring for a patient) scans a prescription, confirms what the system read, and instantly sees whether a cheaper — but chemically identical — option exists at the same strength and dosage form, including government Jan Aushadhi outlets. The prescription itself is never altered; the app only compares and informs.

## 2. Problem statement

Patients are frequently prescribed a specific brand without realizing that a chemically identical, verified alternative — sometimes at a fraction of the price — is available at the same pharmacy or a Jan Aushadhi Kendra. There is no simple, trustworthy way to check this at the point of purchase, and manually cross-referencing salts, strengths, and manufacturers is not something most patients can or should do unaided.

## 3. Features

- **Prescription scanning** — image upload, PDF upload, or live camera capture, with basic client-side preview.
- **AI extraction with confidence scores** — every extracted field carries a 0–1 confidence value.
- **Human-in-the-loop verification** — low-confidence fields are visually flagged; every field is editable; medicines can also be added manually if OCR misses one entirely.
- **Deterministic medicine matching** — same active ingredient + strength + dosage form, decided by a database query, never by AI guesswork.
- **Three-tier price comparison** — Prescribed vs. Generic vs. Jan Aushadhi, shown as a "price ladder" plus a full sortable comparison table.
- **Savings history** — per-prescription and rolled up per patient, viewable by both patients and the caregivers who manage them.
- **Patient-friendly medicine information** — plain-language use/mechanism explanations, side effects, precautions, and safety guidance for every catalogue medicine.
- **Patient & caregiver accounts** — a caregiver can manage several patient profiles with full data isolation between caregivers; a patient manages their own single profile.
- **Manual medicine search** — browse the verified catalogue directly, with text search and price/generic/Jan Aushadhi filters.
- **Demo fallback mode** — the entire flow works with zero API keys configured, and automatically recovers if a configured AI provider fails.

## 4. Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy ORM, SQLite |
| Auth | JWT (PyJWT) + bcrypt password hashing |
| AI | Gemini API and OpenAI API (vision), behind a provider-agnostic `AIService`, with automatic demo fallback |
| Frontend | HTML5, CSS3 (custom design system, no framework/build step), vanilla JavaScript (Fetch API) |
| Fonts | Plus Jakarta Sans (display), Inter (body), JetBrains Mono (prices/data) |

No React, no Bootstrap, no CSS framework — every stylesheet is hand-written for this product.

## 5. Architecture

```
medicompare/
├── README.md
├── .gitignore
├── .env.example
│
├── frontend/                Plain HTML, CSS, JS — no build step
│   ├── index.html            Homepage
│   ├── login.html / register.html
│   ├── dashboard.html         Patient dashboard
│   ├── caregiver-dashboard.html
│   ├── scan.html              Upload / camera / demo trigger
│   ├── analysis.html          Extraction review + verification
│   ├── comparison.html        Price ladder + comparison table (the core screen)
│   ├── medicine.html          Patient-friendly medicine detail
│   ├── search.html            Manual catalogue search
│   ├── history.html           Savings history
│   ├── css/                    One stylesheet per page area + shared design system (style.css, responsive.css)
│   └── js/                      One script per page area + shared API client (app.js)
│
├── backend/                  FastAPI application
│   ├── requirements.txt
│   ├── seed.py                 Loads data/medicines.json into the catalogue
│   └── app/
│       ├── main.py              App entrypoint, CORS, global error handling
│       ├── config.py            Environment-driven settings (loads .env)
│       ├── database.py          SQLAlchemy engine/session
│       ├── models/               ORM models: users, patients, medicines, prescriptions,
│       │                         prescription_medicines, price_comparisons, savings_history
│       ├── schemas/              Pydantic request/response schemas
│       ├── routes/               auth, patients, medicines, prescriptions, comparisons, savings
│       ├── services/             normalization.py, matching.py (deterministic), comparison.py
│       ├── ai/                    base.py, demo_provider.py, gemini_provider.py,
│       │                          openai_provider.py, service.py (fallback orchestration)
│       └── utils/                 security.py (JWT + bcrypt), files.py (upload validation)
│
└── data/
    └── medicines.json          25-record seed catalogue (multiple brands per salt,
                                  generic + Jan Aushadhi tiers included)
```

### Why this stack

- **FastAPI + SQLite** — fast to build and run; swapping to PostgreSQL later is a one-line `DATABASE_URL` change, no model changes needed.
- **Plain HTML/CSS/JS frontend** — no build step, easy for a small team to read and modify, deploys as static files anywhere.
- **Deterministic matching in Python, not the LLM** — medicine equivalence is a database join on `active_ingredient + strength + dosage_form`, so the AI can never invent a "same" medicine that isn't actually the same. This is the single most important safety property of the system.

## 6. AI functionality

The AI layer lives entirely in `backend/app/ai/`:

- **`base.py`** — the `AIProvider` interface every provider implements (`extract_prescription(image_bytes, mime_type) -> list of medicines`).
- **`demo_provider.py`** — a deterministic 4-medicine sample extraction (Pantop 40, Ondem 4, Augmentin 625, Dolo 650), one of which is deliberately given low confidence so the verification UI always has something real to demonstrate.
- **`gemini_provider.py`** / **`openai_provider.py`** — call the respective vision-capable model with a strict "return a JSON array only" prompt, requesting `medicine_name`, `salt`, `strength`, `dosage`, `duration`, and `confidence` for every medicine found.
- **`service.py`** — `AIService`, the single entry point the rest of the backend uses. It reads `AI_PROVIDER` from the environment and either uses the demo provider directly, or tries the configured real provider and **transparently falls back to the demo provider on any exception** (missing key, network failure, malformed response, timeout).

AI output is never trusted blindly: every extracted medicine still goes through the deterministic catalogue matcher (`services/matching.py`) before it can be shown as "the same" as anything else, and every field remains editable by the user before any comparison is generated.

## 7. Demo / fallback mode

This is the most important reliability feature for a hackathon demo: **the app works end-to-end with no API keys at all.**

- Leaving `AI_PROVIDER=demo` (the default in `.env.example`) skips external AI calls entirely and returns the built-in sample prescription.
- The **"Try demo prescription"** button on the Scan page triggers this directly, regardless of what `AI_PROVIDER` is set to.
- If `AI_PROVIDER` is set to `gemini` or `openai` but the corresponding key is missing, invalid, or the API call fails for any reason, the backend catches the failure and **automatically re-runs extraction through the demo provider**, returning a normal `201 Created` response with `is_demo: true` — the request never fails and the UI never shows an error for this case.

This was explicitly verified: with `AI_PROVIDER=gemini` and no `GEMINI_API_KEY` set, `POST /api/prescriptions/upload` still returns `201` with 4 correctly extracted demo medicines.

## 8. Setup instructions

### Prerequisites

- Python 3.10+
- A modern browser
- (Optional) A Gemini or OpenAI API key, only if you want live OCR instead of demo mode

### Step 1 — Configure environment

```bash
cd medicompare
cp .env.example backend/.env
```

`backend/.env` defaults to `AI_PROVIDER=demo` with both keys empty — no editing required to run the full demo. To enable live AI extraction, edit `backend/.env`:

```env
AI_PROVIDER=gemini        # or "openai"
GEMINI_API_KEY=your-key-here
# OPENAI_API_KEY=your-key-here
```

### Step 2 — Backend

```bash
cd backend
pip install -r requirements.txt --break-system-packages   # or use a virtualenv
python3 seed.py                                            # seeds the medicine catalogue
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Backend is now running at **http://localhost:8000** (interactive API docs at **http://localhost:8000/docs**).

### Step 3 — Frontend

The frontend is fully static — no build step. In a separate terminal:

```bash
cd frontend
python3 -m http.server 5500
```

Open **http://localhost:5500/index.html** in your browser.

> The frontend's API base URL is hardcoded to `http://localhost:8000` in `frontend/js/app.js` (`const API_BASE`). Change that one constant if you deploy the backend elsewhere or on a different port.

### Step 4 — Try it

Register an account (patient or caregiver), then click **"Scan prescription" → "Try demo prescription"** to run the complete flow — extraction, verification, matching, comparison, savings — with zero configuration.

## 9. Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `SECRET_KEY` | JWT signing secret | dev placeholder — change before any non-demo deployment |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session length in minutes | `1440` (24h) |
| `DATABASE_URL` | SQLAlchemy connection string | local SQLite file (`backend/medicompare.db`) |
| `AI_PROVIDER` | `demo`, `gemini`, or `openai` | `demo` |
| `GEMINI_API_KEY` | Gemini API credential | empty |
| `OPENAI_API_KEY` | OpenAI API credential | empty |
| `UPLOAD_DIR` | Where uploaded prescription files are stored | `./uploads` (auto-created) |
| `MAX_UPLOAD_SIZE_MB` | Upload size limit | `8` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `*` |

`backend/.env` is git-ignored; only `.env.example` (placeholder values, no real secrets) is committed.

## 10. API overview

Interactive, always-current documentation is available at `/docs` (Swagger UI) once the backend is running. Summary:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create a patient or caregiver account |
| POST | `/api/auth/login` | Log in, receive a JWT |
| GET / POST | `/api/patients` | List / create patient profiles (caregivers can have many; patients have exactly one) |
| GET | `/api/patients/{id}` | Get one patient profile (owner-scoped) |
| POST | `/api/prescriptions/upload` | Upload a prescription file (or `use_demo=true`) — runs AI extraction and returns the full prescription with matched medicines |
| POST | `/api/prescriptions/analyze` | Re-run extraction on an existing prescription |
| GET | `/api/prescriptions` | List prescriptions, optionally filtered by `patient_id` |
| GET | `/api/prescriptions/{id}` | Get one prescription with its medicines |
| PUT | `/api/prescriptions/{id}/medicines/{medicine_id}` | Human correction of an extracted field — marks it verified |
| POST | `/api/prescriptions/{id}/medicines` | Manually add a medicine OCR missed |
| POST | `/api/prescriptions/{id}/verify` | Mark the prescription as verified, ready for comparison |
| GET | `/api/medicines/search` | Public catalogue search (`q`, `max_price`, `generic_only`, `jan_aushadhi_only`) |
| GET | `/api/medicines/{id}` | Public medicine detail |
| GET | `/api/medicines/{id}/alternatives` | Public same-composition alternatives |
| POST | `/api/comparisons` | Build (and persist) a price comparison for one prescription medicine |
| GET | `/api/savings-history` | List savings rollups, optionally filtered by `patient_id` |

All endpoints except auth, catalogue search/detail/alternatives require a `Bearer` JWT and are scoped strictly to the requesting user's own patients — verified by an explicit isolation test (see §11).

## 11. Safety & limitations

- This platform provides **informational and price-comparison assistance only**. It does not diagnose, prescribe, or recommend stopping any medication, and it does not replace professional medical advice.
- Comparisons are limited to medicines sharing the **same active ingredient, strength, and dosage form** as prescribed — anything less certain is never shown as an equivalent. This matching is deterministic (a database query), not an AI judgment call.
- Always confirm any substitution with a doctor or pharmacist before acting on a comparison shown here.
- Prices not sourced from a live feed are explicitly labelled **"Demo / reference price"** — the seed catalogue (25 records) is a realistic but fictional demo dataset, not a production price feed.
- **Privacy**: uploaded prescription files are stored under `backend/uploads` with a randomized filename (never the original name), used only for AI extraction, and not logged. This is a prototype; a production deployment would add encryption at rest, retention limits, and audit logging before handling real patient data.
- **Data isolation**: every patient-scoped endpoint filters by the authenticated user's own `owner_id` — verified with an explicit cross-account isolation test (a second caregiver account cannot see or fetch another caregiver's patients or prescriptions).
- This is a hackathon MVP, not a certified medical device or a production healthcare system.

## 12. Team members

- _Add team member names and roles here before submission._

---

Built as a hackathon MVP, prioritized per the original brief: prescription upload → AI extraction → confidence scoring → manual correction → deterministic matching → price comparison → savings calculation → medicine information, all working end-to-end, before polish. Patient/caregiver auth, multi-patient management, savings history, and manual search are all implemented, integrated, and tested.
