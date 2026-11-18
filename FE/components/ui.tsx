// Mục đích file: Cung cấp các thành phần giao diện dùng chung như nút, thẻ và tiêu đề.
"use client";

import Image from "next/image";
import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import assets from "@/lib/figma-assets.json";

export type Tone =
  "blue" | "teal" | "red" | "amber" | "muted" | "white" | "ink";
const colors: Record<Tone, number[]> = {
  blue: [29, 78, 216],
  teal: [8, 127, 112],
  red: [201, 44, 64],
  amber: [153, 98, 26],
  muted: [88, 106, 130],
  white: [255, 255, 255],
  ink: [23, 45, 77],
};
export function Icon({
  name,
  tone = "blue",
  size = 22,
}: {
  name: string;
  tone?: Tone;
  size?: number;
}) {
  const choices = assets.icons.filter((icon) => icon.name === `Icon / ${name}`);
  const color = colors[tone];
  if (name === "settings") return (
    <span className="icon-wrap" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={`rgb(${color.join(",")})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.6-1.2-1.6-2.8-1.9.7a8 8 0 0 0-2.6-1.5L14.6 3h-3.2l-.3 2.7a8 8 0 0 0-2.6 1.5l-1.9-.7L5 9.3l1.6 1.2a7.7 7.7 0 0 0 0 3L5 14.7l1.6 2.8 1.9-.7a8 8 0 0 0 2.6 1.5l.3 2.7h3.2l.3-2.7a8 8 0 0 0 2.6-1.5l1.9.7 1.6-2.8-1.6-1.2Z"/></svg>
    </span>
  );
  const distance = (icon: (typeof assets.icons)[number]) =>
    icon.color.reduce((sum, value, i) => sum + (value - color[i]) ** 2, 0) +
    Math.abs(icon.width - size) * 10000;
  const icon = choices.toSorted((a, b) => distance(a) - distance(b))[0];
  if (!icon)
    return (
      <span
        className="icon-spacer"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  return (
    <span
      className="icon-wrap"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src={icon.path}
        alt=""
        width={icon.width}
        height={icon.height}
        unoptimized
      />
    </span>
  );
}

export function CampusImage({
  className = "",
  priority = false,
  variant = "login",
}: {
  className?: string;
  priority?: boolean;
  variant?: "login" | "home" | "faq" | "admin";
}) {
  const src = {
    login: assets.campus,
    home: assets.campusHome,
    faq: assets.campusFaq,
    admin: assets.campusAdmin,
  }[variant];
  return (
    <Image
      src={src}
      className={`campus-image ${className}`}
      alt="Khuôn viên Đại học Duy Tân tại Đà Nẵng"
      width={1200}
      height={800}
      priority={priority}
      loading={priority ? undefined : "eager"}
      unoptimized
    />
  );
}
export function Logo({
  className = "",
  variant = "sidebar",
}: {
  className?: string;
  variant?: "sidebar" | "login";
}) {
  return (
    <Image
      className={`dtu-logo ${className}`}
      src={variant === "login" ? assets.logoLogin : assets.logo}
      alt="Đại học Duy Tân"
      width={variant === "login" ? 190 : 176}
      height={variant === "login" ? 58 : 52}
      priority
      unoptimized
    />
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "secondary";
  children: ReactNode;
};
export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function ButtonLink({
  href,
  children,
  variant = "outline",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  return (
    <Link href={href} className={`btn btn-${variant} ${className}`}>
      {children}
    </Link>
  );
}
export function Card({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`card ${className}`} {...props}>
      {children}
    </section>
  );
}
export function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div className="heading-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function IconTile({
  name,
  tone = "blue",
  size = 40,
}: {
  name: string;
  tone?: Tone;
  size?: number;
}) {
  return (
    <span
      className={`icon-tile tone-${tone}`}
      style={{ width: size, height: size }}
    >
      <Icon name={name} tone={tone} />
    </span>
  );
}
export function Notice({
  title,
  children,
  tone = "teal",
  icon = "check",
}: {
  title: string;
  children: ReactNode;
  tone?: Tone;
  icon?: string;
}) {
  return (
    <aside className={`notice tone-${tone}`}>
      <IconTile name={icon} tone={tone} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}
export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}
export function SearchInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`search-input ${className}`}>
      <Icon name="search" tone="muted" size={20} />
      <input
        type="search"
        aria-label={props.placeholder ?? "Tìm kiếm"}
        {...props}
      />
    </label>
  );
}
export function Select({
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input select ${className}`} {...props}>
      {children}
    </select>
  );
}
export function EmptyState({
  children,
  title = "Chưa tìm thấy kết quả",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="empty-state">
      <IconTile name="search" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Pagination({
  label,
  language = "vi",
  page,
  onPage,
  canNext = false,
}: {
  label: string;
  language?: "vi" | "en" | "hi";
  page: number;
  onPage: (page: number) => void;
  canNext?: boolean;
}) {
  return (
    <div className="pagination">
      <span>{label}</span>
      <div>
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          {language === "en" ? "Previous" : language === "hi" ? "पिछला" : "Trước"}
        </Button>
        <Button
          variant="outline"
          disabled={!canNext}
          onClick={() => onPage(page + 1)}
        >
          {language === "en" ? "Next" : language === "hi" ? "अगला" : "Sau"}
        </Button>
      </div>
    </div>
  );
}
