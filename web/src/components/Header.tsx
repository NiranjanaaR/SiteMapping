export default function Header({ userEmail }: { userEmail: string }) {
  const initial = userEmail.charAt(0).toUpperCase() || "?";
  return (
    <header className="header">
      <span className="logo" aria-hidden>
        🌊
      </span>
      <div className="titles">
        <span className="brand">Kystkonsulent</span>
        <span className="tagline">Marine siting screening · Norwegian coast</span>
      </div>
      <span className="spacer" />
      <div className="user" title={userEmail}>
        <span className="avatar">{initial}</span>
        <span>{userEmail}</span>
      </div>
    </header>
  );
}
