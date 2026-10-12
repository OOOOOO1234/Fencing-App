import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export function SiteHeader({ name }: { name?: string }) {
  return (
    <header className="topbar">
      <Link className="brand" href={name ? "/library" : "/"}>
        Sabre Stats
      </Link>
      {name ? (
        <nav className="nav">
          <span className="muted">{name}</span>
          <Link href="/library">Library</Link>
          <Link href="/upload">Upload</Link>
          <Link href="/combine">Combine</Link>
          <LogoutButton />
        </nav>
      ) : null}
    </header>
  );
}
