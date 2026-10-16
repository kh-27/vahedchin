/** FR-49: everything the PDF says about a group; FR-27 full-capacity badge. */

import type { Group } from "../core/types";
import { GENDER, examLabel, sessionLabel } from "../lib/labels";
import { fa, faNumber } from "../lib/text";

export function GroupDetails({ g, reportDate }: { g: Group; reportDate: string }) {
  const full = g.registered >= g.capacity;
  return (
    <div className="group-details">
      <div className="row wrap gap">
        <strong>گروه {fa(g.group)}</strong>
        <span>{g.teacher || "استاد نامشخص"}</span>
        <span className="tag">{GENDER[g.gender]}</span>
        <span className={`tag${full ? " bad" : ""}`} title={`ثبت‌نام تا زمان تهیه داده (${fa(reportDate)})`}>
          {fa(g.registered)} از {fa(g.capacity)}
          {full && "، پر"}
        </span>
        {g.waitlist > 0 && <span className="tag">انتظار {fa(g.waitlist)}</span>}
      </div>
      <ul className="plain small">
        {g.sessions.map((s, i) => (
          <li key={i}>
            {sessionLabel(s)}
            {s.place && <span className="muted"> — {fa(s.place)}</span>}
          </li>
        ))}
        {g.sessions.length === 0 && <li className="muted">بدون ساعت کلاس</li>}
        {g.exams.map((e, i) => (
          <li key={`e${i}`}>{examLabel(e)}</li>
        ))}
        {g.exams.length === 0 && <li className="muted">بدون امتحان</li>}
      </ul>
      {g.notes && <p className="small note">{fa(g.notes)}</p>}
      <p className="small muted">
        {faNumber(g.units)} واحد{g.practicalUnits > 0 && ` (${faNumber(g.practicalUnits)} عملی)`}، اخذ توسط سایر مراکز:{" "}
        {g.otherCenters ? "بله" : "خیر"}، حذف اضطراری: {g.emergencyDrop ? "دارد" : "ندارد"}
      </p>
    </div>
  );
}
