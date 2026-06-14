import { Share2 } from "lucide-react";
import { Link } from "react-router-dom";

function Navbar() {
    return (
        <nav className="border-b border-zinc-800">
            <Link to="/">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-2">
                    <Share2 size={28} />
                    <h1 className="font-bold text-xl">P2P Share</h1>
                </div>
            </Link>
        </nav>
    );
}

export default Navbar;