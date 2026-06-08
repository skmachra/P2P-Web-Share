import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import ShareRoom from "./pages/ShareRoom";
import ReceiveRoom from "./pages/ReceiveRoom";
import NotFound from "./pages/NotFound";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/host/:roomId" element={<ShareRoom />} />
            <Route path="/share/:roomId" element={<ReceiveRoom />} />
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}

export default App;
