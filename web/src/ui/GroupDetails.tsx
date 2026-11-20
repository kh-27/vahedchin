import { t, tr } from "../lib/i18n";
/** FR-49: everything the PDF says about a group; FR-27 full-capacity badge. */

import type { Group } from "../core/types";
import { GENDER, examLabel, sessionLabel } from "../lib/labels";
import { fa, faNumber } from "../lib/text";

export function GroupDetails({ g, reportDate }: { g: Group; reportDate: string }) {
  const full = g.registered >= g.capacity;
  return (
    <div className="group-details">
      <div className="row wrap gap">
        <strong>{tr("گروه", "Group", "المجموعة")} {fa(g.group)}</strong>
        <span>{g.teacher || t("استاد نامشخص")}</span>
        <span className="tag">{t(GENDER[g.gender])}</span>
        <span className={`tag${full ? " bad" : ""}`} title={`${tr("ثبت‌نام تا زمان تهیه داده", "Enrolment as of the report", "التسجيل حتى تاريخ التقرير")} (${fa(reportDate)})`}>
          {fa(g.registered)} / {fa(g.capacity)} — {tr("باقی‌مانده", "Remaining", "المتبقي")}: {fa(Math.max(0, g.capacity - g.registered))}
          {full && tr("، پر", ", full", "، مكتمل")}
        </span>
        {g.waitlist > 0 && <span className="tag">{tr("انتظار", "Waitlist", "قائمة الانتظار")} {fa(g.waitlist)}</span>}
      </div>
      <ul className="plain small">
        {g.sessions.map((s, i) => (
          <li key={i}>
            {sessionLabel(s)}
            {s.place && <span className="muted"> — {fa(s.place)}</span>}
          </li>
        ))}
        {g.sessions.length === 0 && <li className="muted">{t("بدون ساعت کلاس")}</li>}
        {g.exams.map((e, i) => (
          <li key={`e${i}`}>{examLabel(e)}</li>
        ))}
        {g.exams.length === 0 && <li className="muted">{t("بدون امتحان")}</li>}
      </ul>
      {g.notes && <p className="small note">{fa(g.notes)}</p>}
      <p className="small muted">
        {faNumber(g.units)} {tr("واحد", "credits", "وحدات")}{g.practicalUnits > 0 && ` (${faNumber(g.practicalUnits)} ${t("عملی")})`}، {tr("اخذ توسط سایر مراکز", "Other centres", "المراكز الأخرى")}:{" "}
        {g.otherCenters ? t("بله") : t("خیر")}، {tr("حذف اضطراری", "Emergency withdrawal", "الانسحاب الطارئ")}: {g.emergencyDrop ? t("دارد") : t("ندارد")}
      </p>
    </div>
  );
}
