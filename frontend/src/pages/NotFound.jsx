import Footer from "../components/Footer/Footer";

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 justify-center items-center">
      <h1>404: Page Not Found</h1>
      </main>
      <Footer />
    </div>
  );
}

export default NotFound;
