"""Data model of one term's offerings, as published in data/terms/<term>.json."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

SCHEMA_VERSION = 1

# Saturday = 0 ... Friday = 6 (Iranian week).
DAYS: dict[str, int] = {
    "شنبه": 0,
    "یکشنبه": 1,
    "دوشنبه": 2,
    "سه شنبه": 3,
    "چهارشنبه": 4,
    "پنجشنبه": 5,
    "جمعه": 6,
}

SessionKind = Literal["lecture", "problem_solving"]
SessionType = Literal["theory", "practical"]
Week = Literal["all", "odd", "even"]
Gender = Literal["mixed", "male", "female"]
ExamKind = Literal["final", "practical"]  # "امتحان" / "امتحان عملی"


@dataclass(frozen=True)
class Session:
    kind: SessionKind
    type: SessionType
    day: int | None  # weekly session; None for a single-date session (FR-65)
    date: str | None  # "YYYY/MM/DD" (Jalali) for a single-date session
    start: str  # "HH:MM"
    end: str
    week: Week
    week_number: int | None  # "هفته14": held only in that week of the term (A11), else None
    half: int | None  # 1 or 2 for "نیمه1 ت" / "نیمه2 ت" (first/second half of term), else None
    place: str


@dataclass(frozen=True)
class Exam:
    kind: ExamKind
    date: str  # "YYYY/MM/DD" (Jalali)
    start: str
    end: str


@dataclass(frozen=True)
class Department:
    faculty: str
    department: str
    level: str


@dataclass
class Group:
    code: str  # "1118061_01"
    course: str  # "1118061"
    group: str  # "01"
    name: str
    units: float
    practical_units: float
    capacity: int
    registered: int
    waitlist: int
    gender: Gender
    teacher: str
    sessions: list[Session]
    exams: list[Exam]
    notes: str
    other_centers: bool
    emergency_drop: bool
    department: int  # index into TermData.departments
    page: int


@dataclass
class TermData:
    term: str  # e.g. "4042"
    term_title: str
    university: str
    report_date: str  # "YYYY/MM/DD" (Jalali), time the report was generated
    report_time: str  # "HH:MM"
    source_file: str
    source_sha256: str
    pages: int
    departments: list[Department] = field(default_factory=list)
    groups: list[Group] = field(default_factory=list)

    def to_json(self) -> dict:
        return {
            "schemaVersion": SCHEMA_VERSION,
            "term": self.term,
            "termTitle": self.term_title,
            "university": self.university,
            "reportDate": self.report_date,
            "reportTime": self.report_time,
            "source": {"file": self.source_file, "sha256": self.source_sha256, "pages": self.pages},
            "departments": [asdict(d) for d in self.departments],
            "groups": [_group_json(g) for g in self.groups],
        }


def _group_json(g: Group) -> dict:
    return {
        "code": g.code,
        "course": g.course,
        "group": g.group,
        "name": g.name,
        "units": _num(g.units),
        "practicalUnits": _num(g.practical_units),
        "capacity": g.capacity,
        "registered": g.registered,
        "waitlist": g.waitlist,
        "gender": g.gender,
        "teacher": g.teacher,
        "sessions": [_session_json(s) for s in g.sessions],
        "exams": [asdict(e) for e in g.exams],
        "notes": g.notes,
        "otherCenters": g.other_centers,
        "emergencyDrop": g.emergency_drop,
        "department": g.department,
    }


def _session_json(s: Session) -> dict:
    d = asdict(s)
    d["weekNumber"] = d.pop("week_number")
    return d


def _num(x: float) -> int | float:
    return int(x) if float(x).is_integer() else x
