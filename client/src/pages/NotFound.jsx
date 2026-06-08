import { Link } from "react-router-dom";

function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="text-center max-w-md">
                <h1 className="text-8xl font-bold text-zinc-300">
                    404
                </h1>

                <h2 className="mt-4 text-3xl font-bold">
                    Page Not Found
                </h2>

                <p className="mt-4 text-zinc-500">
                    The page you are looking for
                    does not exist or may have
                    been moved.
                </p>

                <Link
                    to="/"
                    className="
                        inline-block
                        mt-8
                        px-6
                        py-3
                        rounded-xl
                        bg-blue-600
                        text-white
                        font-semibold
                        transition-all
                        duration-200
                        hover:bg-blue-700
                        hover:-translate-y-0.5
                        active:scale-[0.98]
                    "
                >
                    Back to Home
                </Link>
            </div>
        </div>
    );
}

export default NotFound;