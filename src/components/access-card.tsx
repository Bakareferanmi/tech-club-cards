import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { QrMark } from "@/components/qr-mark";
import { toDataUrl } from "@/lib/signatures";

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

/** Text that shrinks to fit its fixed-width slot on the card template. */
function FitText({
  children,
  className,
  align = "left",
}: {
  children: string;
  className: string;
  align?: "left" | "center";
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const fit = () => {
      const box = boxRef.current;
      const text = textRef.current;
      if (!box || !text) return;
      const natural = text.offsetWidth;
      const avail = box.clientWidth;
      setScale(natural > avail && natural > 0 ? avail / natural : 1);
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => undefined);
  }, [children]);

  return (
    <span
      ref={boxRef}
      className={`access-card__text access-card__fit access-card__fit--${align} ${className}`}
    >
      <span
        ref={textRef}
        className="access-card__fit-text"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: align === "center" ? "center center" : "left center",
        }}
      >
        {children}
      </span>
    </span>
  );
}

export const AccessCard = forwardRef<HTMLElement, Props>(function AccessCard(
  { data, className },
  ref,
) {
  const bg = useEmbeddedSrc("/card-template.png");
  const name = data.name.trim() || "Member Name";
  const memberId = data.memberId.trim() || "TECH0000";
  const role = data.role.trim() || "Member";
  const session = (data.session.trim() || "2026/2027").replace(/\s*\/\s*/g, "/");

  return (
    <article ref={ref} className={["access-card", className].filter(Boolean).join(" ")}>
      <img className="access-card__bg" src={bg} alt="" draggable={false} decoding="sync" />

      <FitText className="access-card__name">{name}</FitText>

      <p className="access-card__text access-card__label access-card__label--id">ID</p>
      <FitText className="access-card__value access-card__value--id">{memberId}</FitText>

      <p className="access-card__text access-card__label access-card__label--session">
        SESSION
      </p>
      <FitText className="access-card__value access-card__value--session">{session}</FitText>

      <FitText className="access-card__role" align="center">
        {role.toUpperCase()}
      </FitText>

      <div className="access-card__qr">
        <QrMark value={data.verifyUrl} title={`Verify ${memberId}`} />
      </div>
    </article>
  );
});
