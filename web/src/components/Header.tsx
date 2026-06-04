export default function Header({
  userEmail,
  liveData,
}: {
  userEmail: string;
  liveData: boolean;
}) {
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
      <span
        className={`mode-badge ${liveData ? "live" : "demo"}`}
        title={
          liveData
            ? "Live data ON — single-point reports use the real APIs"
            : "Demo mode — set LIVE_DATA=true in .env and restart the server"
        }
      >
        {liveData ? "● LIVE DATA" : "● DEMO MODE"}
      </span>
      <span className="spacer" />
      <div className="user" title={userEmail}>
        <span className="avatar">{initial}</span>
        <span>{userEmail}</span>
      </div>
    </header>
  );
}
