import { forwardRef, useEffect, useState } from "react";
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
  const session = (data.session.trim() || "2026/2027").replace(/\s*\/\s*/g, "/");
  const nameClass =
    name.length > 19
      ? "access-card__name access-card__name--xs"
      : name.length > 15
        ? "access-card__name access-card__name--sm"
        : "access-card__name";

  return (
    <article ref={ref} className={["access-card", className].filter(Boolean).join(" ")}>
      <div className="access-card__deco" aria-hidden="true">
        <i className="access-card__dot access-card__dot--blue" />
        <i className="access-card__dot access-card__dot--yellow" />
        <i className="access-card__dot access-card__dot--pink" />
        <i className="access-card__dot access-card__dot--teal" />
        <i className="access-card__plus access-card__plus--a" />
        <i className="access-card__plus access-card__plus--b" />
        <i className="access-card__plus access-card__plus--c" />
        <i className="access-card__star-ink" />
        <i className="access-card__star" />
      </div>

      <div className="access-card__logo">{"</>"}</div>
      <p className="access-card__title">TECH CLUB</p>
      <p className="access-card__tagline">better minds, bigger dreams!</p>

      <p className={nameClass}>
        <span>{name}</span>
      </p>

      <div className="access-card__tags">
        <span className="access-card__pill access-card__pill--id">ID {memberId}</span>
        <span className="access-card__pill access-card__pill--session">SESSION {session}</span>
        <span className="access-card__pill access-card__pill--role">{role}</span>
      </div>

      <div className="access-card__qr">
        <QrMark value={data.verifyUrl} title={`Verify ${memberId}`} />
      </div>
      <p className="access-card__scan">SCAN TO VERIFY</p>

      <div className="access-card__sigs">
        <SignatureBlock src={gm} alt="General Manager signature" caption="G.M" tone="pink" />
        <SignatureBlock
          src={head}
          alt="Head of Club signature"
          caption="HEAD OF CLUB"
          tone="blue"
        />
        <SignatureBlock
          src={principal}
          alt="Principal signature"
          caption="PRINCIPAL"
          tone="teal"
        />
      </div>
    </article>
  );
});

function SignatureBlock({
  src,
  alt,
  caption,
  tone,
}: {
  src: string;
  alt: string;
  caption: string;
  tone: "pink" | "blue" | "teal";
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
      <figcaption className={`access-card__sig-cap access-card__sig-cap--${tone}`}>
        {caption}
      </figcaption>
    </figure>
  );
}
