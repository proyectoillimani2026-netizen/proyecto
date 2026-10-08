import Link from "next/link";

export function PreviewEye({ back }: { back?: boolean }) {
  return (
    <Link
      className={back ? "eye-btn floating" : "eye-btn"}
      href={back ? "/admin" : "/"}
      aria-label={back ? "Dejar de ver como cliente" : "Ver como cliente"}
      title={back ? "Dejar de ver como cliente" : "Ver como cliente"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.4 11.4 2.6 8.2" />
        <path d="M8.1 9.7 7.1 5.8" />
        <path d="M12 8.8V4.6" />
        <path d="M15.9 9.7 16.9 5.8" />
        <path d="M19.6 11.4 21.4 8.2" />
        <path d="M3.2 14.6c2.2-2.8 5-4.2 8.8-4.2s6.6 1.4 8.8 4.2" />
        <path d="M6.2 16.4c1.6 1 3.5 1.5 5.8 1.5s4.2-.5 5.8-1.5" />
      </svg>
    </Link>
  );
}
