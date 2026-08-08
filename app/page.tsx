export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#500000",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px",
      }}
    >
      <h1
        style={{
          fontSize: "64px",
          marginBottom: "20px",
        }}
      >
        The Campus Mint
      </h1>

      <p
        style={{
          fontSize: "22px",
          maxWidth: "750px",
          lineHeight: "1.6",
        }}
      >
        Building the future of college communities through digital
        ownership, student engagement, campus traditions, and university
        experiences.
      </p>

      <a
        href="#"
        style={{
          marginTop: "35px",
          background: "white",
          color: "#500000",
          padding: "16px 32px",
          borderRadius: "10px",
          textDecoration: "none",
          fontWeight: "bold",
        }}
      >
        Join the Waitlist
      </a>
    </main>
  );
}