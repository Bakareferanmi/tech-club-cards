import { forwardRef, useEffect, useState, type ReactNode } from "react";
import {
  CalendarFieldIcon,
  CodeBracketsIcon,
  IdFieldIcon,
  PeopleFieldIcon,
  PhoneScanIcon,
  UserFieldIcon,
} from "@/components/card-icons";
import { QrMark } from "@/components/qr-mark";
import { SIGNATURE_FILES, toDataUrl } from "@/lib/signatures";

export type AccessCardModel = {
  name: string;
  memberId: string;
  role: string;
  session: string;
  verifyUrl: string;
};

type Props = {
  data: AccessCardModel;
  className?: string;
};

function useEmbeddedSrc(src: string) {
  const [url, setUrl] = useState(src);
  useEffect(() => {
    let alive = true;
    toDataUrl(src)
      .then((next) => {
        if (alive) setUrl(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [src]);
  return url;
}

export const AccessCard = forwardRef<HTMLElement, Props>(function AccessCard(
  { data, className },
  ref,
) {
  const gm = useEmbeddedSrc(SIGNATURE_FILES.gm);
  const head = useEmbeddedSrc(SIGNATURE_FILES.headOfClub);
  const principal = useEmbeddedSrc(SIGNATURE_FILES.principal);
  const name = data.name.trim() || "Member Name";
  const memberId = data.memberId.trim() || "TECH0000";
  const role = data.role.trim() || "Member";
  const session = data.session.trim() || "2026 / 2027";
  const nameClass =
    name.length > 30
      ? "access-card__value access-card__value--xs"
      : name.length > 24
        ? "access-card__value access-card__value--sm"
        : "access-card__value";

  return (
    <article ref={ref} className={["access-card", className].filter(Boolean).join(" ")}>
      <header className="access-card__header">
        <div className="access-card__brand">
          <CodeBracketsIcon className="access-card__logo" />
          <span className="access-card__brand-rule" />
          <div className="access-card__wordmark">
            <p className="access-card__title">
              <span className="access-card__tech">TECH</span>
              <span className="access-card__club">CLUB</span>
            </p>
            <p className="access-card__tagline">LEARN · BUILD · GROW</p>
          </div>
        </div>
        <div className="access-card__motto">
          <span>BETTER MINDS</span>
          <span>BIGGER DREAMS</span>
          <i className="access-card__motto-rule" />
        </div>
      </header>

      <div className="access-card__body">
        <ul className="access-card__fields">
          <FieldRow icon={<UserFieldIcon />} label="NAME">
            <span className={nameClass}>{name}</span>
          </FieldRow>
          <FieldRow icon={<IdFieldIcon />} label="ID">
            <span className="access-card__value">{memberId}</span>
          </FieldRow>
          <FieldRow icon={<PeopleFieldIcon />} label="ROLE">
            <span className="access-card__value">{role}</span>
          </FieldRow>
          <FieldRow icon={<CalendarFieldIcon />} label="SESSION">
            <span className="access-card__value">{session}</span>
          </FieldRow>
        </ul>

        <aside className="access-card__qr-panel">
          <div className="access-card__qr-frame">
            <QrMark value={data.verifyUrl} title={`Verify ${memberId}`} />
          </div>
          <div className="access-card__scan">
            <PhoneScanIcon className="access-card__scan-icon" />
            <span>SCAN TO VERIFY</span>
          </div>
        </aside>
      </div>

      <footer className="access-card__footer">
        <SignatureBlock src={gm} alt="General Manager signature" caption="G.M" />
        <SignatureBlock src={head} alt="Head of Club signature" caption="HEAD OF CLUB" />
        <SignatureBlock src={principal} alt="Principal signature" caption="PRINCIPAL" />
      </footer>
      <div className="access-card__corner" aria-hidden="true" />
    </article>
  );
});

function FieldRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="access-card__field">
      <span className="access-card__icon">{icon}</span>
      <span className="access-card__field-rule" />
      <div className="access-card__field-text">
        <span className="access-card__label">{label}</span>
        {children}
      </div>
    </li>
  );
}

function SignatureBlock({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="access-card__sig">
      <img
        className="access-card__sig-img"
        src={src}
        alt={alt}
        draggable={false}
        loading="eager"
        decoding="sync"
      />
      <figcaption className="access-card__sig-cap">{caption}</figcaption>
    </figure>
  );
}
